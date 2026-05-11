// Tester / diagnostic surface for the dashboard. Lets a tester (or
// Claude) verify the data pipeline and trigger a backfill from
// outside the admin browser session, gated by CRON_SECRET so it's
// safe to leave wired up in production.
//
//   GET  /api/dashboard-tester                    → diagnostics JSON
//   GET  /api/dashboard-tester?action=backfill&days=30 → run backfill
//   GET  /api/dashboard-tester?action=capture     → write today's snapshot
//
// All variants require:
//   Authorization: Bearer ${CRON_SECRET}
//   — OR —
//   ?token=${CRON_SECRET}     (query-param fallback for browser/curl convenience)
//
// CRON_SECRET should already be set in Vercel for the daily cron;
// this route reuses it instead of introducing a second secret.

import { NextResponse, type NextRequest } from 'next/server';
import { sourceConfigured, SOURCE_LABELS } from '@/lib/stats/env';
import { backfillDailyMetrics } from '@/lib/dashboard/backfill';
import { writeDailyRows, todayISO, ALL_METRIC_KEYS, type MetricKey, type DailyRow } from '@/lib/dashboard/daily';
import { loadStatsBundle } from '@/lib/stats/loader';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // In a dev environment without the secret set, allow access so a
  // local developer can hit the endpoint from the browser without
  // ceremony. Production must have CRON_SECRET — otherwise we 401.
  if (!secret) return process.env.NODE_ENV !== 'production';
  const url = new URL(request.url);
  const fromHeader = request.headers.get('authorization') === `Bearer ${secret}`;
  const fromQuery = url.searchParams.get('token') === secret;
  return fromHeader || fromQuery;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'backfill') {
    const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') ?? '30', 10) || 30));
    try {
      const result = await backfillDailyMetrics({ days });
      return NextResponse.json({ ok: true, action: 'backfill', ...result });
    } catch (e) {
      return NextResponse.json(
        { ok: false, action: 'backfill', error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  if (action === 'campaigns') {
    // Returns the raw campaign list from MailerLite alongside the
    // numbers we derive from it — so the user can see the source
    // values directly and decide whether the dashboard's daily
    // opens distribution is honest.
    try {
      const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
      const n = await getNewsletter();
      if (!n) {
        return NextResponse.json({
          ok: true,
          action: 'campaigns',
          configured: false,
          hint: 'mailerlite_API_KEY is not set; nothing to fetch.',
        });
      }
      return NextResponse.json({
        ok: true,
        action: 'campaigns',
        configured: true,
        activeSubscribers: n.activeSubscribers,
        last7Days: n.last7Days,
        lastCampaign: n.lastCampaign,
        recentCampaigns: n.recentCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          subject: c.subject,
          sentAt: c.sentAt,
          sent: c.sent,
          opens_raw: c.opens, // unique_opens_count from MailerLite
          opens_derived_from_rate: Math.round((c.sent * c.openRate) / 100),
          openRate_pct: c.openRate,
          clicks: c.clicks,
          clickRate_pct: c.clickRate,
        })),
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, action: 'campaigns', error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  if (action === 'capture') {
    try {
      const written = await captureToday();
      return NextResponse.json({ ok: true, action: 'capture', ...written });
    } catch (e) {
      return NextResponse.json(
        { ok: false, action: 'capture', error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  // Default: diagnostics. Returns enough info to see which sources
  // are configured, how many rows live in the daily table, and what
  // today's freshest values look like — without leaking any secrets.
  const sources = (['newsletter', 'github', 'analytics', 'forum', 'quranApps', 'cms'] as const).map(
    (s) => ({ key: s, label: SOURCE_LABELS[s].ar, configured: sourceConfigured(s) }),
  );

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('dashboard_metric_daily')
    .select('metric_key, day, value, meta')
    .order('day', { ascending: false });
  type Row = { metric_key: string; day: string; value: number; meta: Record<string, unknown> };
  const byMetric = new Map<string, Row[]>();
  for (const r of (data ?? []) as Row[]) {
    if (!byMetric.has(r.metric_key)) byMetric.set(r.metric_key, []);
    byMetric.get(r.metric_key)!.push(r);
  }
  const metrics = ALL_METRIC_KEYS.map((k) => {
    const rows = byMetric.get(k) ?? [];
    const latest = rows[0];
    return {
      key: k,
      rows: rows.length,
      latestDay: latest?.day ?? null,
      latestValue: latest ? Number(latest.value) : null,
      latestMeta: latest?.meta ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    cronSecretSet: !!process.env.CRON_SECRET,
    sources,
    metrics,
    hint: 'POST/GET ?action=backfill&days=30 to populate · ?action=capture to write today',
  });
}

// Reusable today's-snapshot capture (same logic as the cron route,
// extracted so this endpoint can offer it on demand).
async function captureToday(): Promise<{ written: number; day: string }> {
  const bundle = await loadStatsBundle({ windowDays: 1 });
  const day = todayISO();
  const rows: DailyRow[] = [];

  if (bundle.forum) {
    const replies = (bundle.forum.newPosts ?? 0) + (bundle.forum.newDiscussions ?? 0);
    rows.push({
      day,
      metric_key: 'engagement',
      value: replies,
      meta: { replies, likes: 0, mentions: 0, shares: 0 },
    });
    rows.push({ day, metric_key: 'shares', value: bundle.forum.totalLikes ?? 0 });
  }
  if (bundle.newsletter?.lastCampaign) {
    const c = bundle.newsletter.lastCampaign;
    const opens =
      c.opens > 0 ? c.opens : Math.round((c.sent * c.openRate) / 100);
    rows.push({
      day,
      metric_key: 'newsletter',
      value: c.sent,
      meta: { rate: c.openRate, prevRate: bundle.newsletter.last7Days.avgOpenRate, opened: opens },
    });
  }
  if (bundle.analytics) {
    const a = bundle.analytics;
    rows.push({
      day,
      metric_key: 'site_visits',
      value: a.pageviews.value,
      meta: { uniq: a.activeUsers.value, returning: Math.max(0, a.sessions.value - a.newUsers) },
    });
  }
  if (bundle.cms) {
    rows.push({ day, metric_key: 'publishers',    value: bundle.cms.totalPublishers });
    rows.push({ day, metric_key: 'beneficiaries', value: bundle.cms.totalUsers });
    rows.push({ day, metric_key: 'consumption',   value: bundle.cms.totalAssets });
  }

  const result = await writeDailyRows(rows);
  return { ...result, day };
}
