// Daily metric capture for the /admin dashboard.
//
//   GET  /api/cron/dashboard-metrics           → captures today's row
//   GET  /api/cron/dashboard-metrics?backfill=30 → backfills last N days
//
// Vercel Cron hits the GET (no body) once a day per vercel.json. The
// ?backfill query param is for one-off catchups — call it manually
// after deploying or after a source has been down.
//
// Auth: header `Authorization: Bearer ${CRON_SECRET}` is required.
// Vercel Cron sends this automatically when the project has a
// CRON_SECRET env var; manual invokes can use the same header.

import { NextResponse, type NextRequest } from 'next/server';
import { loadStatsBundle } from '@/lib/stats/loader';
import { backfillDailyMetrics } from '@/lib/dashboard/backfill';
import { writeDailyRows, todayISO, type DailyRow } from '@/lib/dashboard/daily';

export const dynamic = 'force-dynamic';
// Allow up to 5 minutes for the backfill path (Pro plans only — Hobby
// caps at 60s, so the cron path is fine but backfill on Hobby may
// need to be invoked once per source via query param).
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured → allow in dev so the developer can curl
    // the endpoint. Production should always set CRON_SECRET.
    return process.env.NODE_ENV !== 'production';
  }
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const backfillParam = url.searchParams.get('backfill');
  if (backfillParam) {
    const days = Math.max(1, Math.min(365, parseInt(backfillParam, 10) || 30));
    const result = await backfillDailyMetrics({ days });
    return NextResponse.json({ mode: 'backfill', ...result });
  }

  // Daily capture mode — one row per metric for today.
  const bundle = await loadStatsBundle({ windowDays: 1 });
  const day = todayISO();
  const rows: DailyRow[] = [];

  if (bundle.forum) {
    const replies = (bundle.forum.newPosts ?? 0) + (bundle.forum.newDiscussions ?? 0);
    rows.push({
      day,
      metric_key: 'engagement',
      value: replies,
      // Breakdown we can populate from forum: replies+discussions
      // count as "ردود ومناقشات". Likes/mentions/shares aren't
      // tracked yet — leave them at 0 until a source surfaces them.
      meta: { replies, likes: 0, mentions: 0, shares: 0 },
    });
    rows.push({
      day,
      metric_key: 'shares',
      value: bundle.forum.totalLikes ?? 0,
    });
  }
  if (bundle.newsletter?.lastCampaign) {
    const c = bundle.newsletter.lastCampaign;
    // MailerLite's list response sometimes omits unique_opens_count
    // while still returning open_rate. Fall back to sent × rate.
    const opens =
      c.opens > 0 ? c.opens : Math.round((c.sent * c.openRate) / 100);
    rows.push({
      day,
      metric_key: 'newsletter',
      value: c.sent,
      // Headline UI shows the open rate as a ring, so we stash it
      // alongside the sent count to avoid querying MailerLite again
      // from /admin.
      meta: {
        rate: c.openRate,
        prevRate: bundle.newsletter.last7Days.avgOpenRate,
        opened: opens,
      },
    });
  }
  if (bundle.analytics) {
    const a = bundle.analytics;
    rows.push({
      day,
      metric_key: 'site_visits',
      value: a.pageviews.value,
      meta: {
        uniq: a.activeUsers.value,
        returning: Math.max(0, a.sessions.value - a.newUsers),
      },
    });
  }
  if (bundle.cms) {
    rows.push({
      day,
      metric_key: 'publishers',
      value: bundle.cms.totalPublishers,
      meta: { new_30d: bundle.cms.newPublishers30d },
    });
    rows.push({
      day,
      metric_key: 'beneficiaries',
      value: bundle.cms.totalUsers,
      meta: { new_30d: bundle.cms.newUsers30d },
    });
    rows.push({ day, metric_key: 'consumption', value: bundle.cms.totalAssets });
  }

  // social_reach derives from the manual snapshots table. The cron
  // re-reads it daily so a new snapshot entered today shows up in
  // tomorrow's series too.
  const socialReach = await computeSocialReachForDay(day);
  if (socialReach != null) {
    rows.push({ day, metric_key: 'social_reach', value: socialReach });
  }

  const written = await writeDailyRows(rows);
  return NextResponse.json({
    mode: 'capture',
    day,
    rows: rows.map((r) => ({ key: r.metric_key, value: r.value })),
    ...written,
  });
}

async function computeSocialReachForDay(day: string): Promise<number | null> {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('dashboard_social_snapshots')
    .select('channel, snapshot_date, impressions, page_views, followers_total')
    .lte('snapshot_date', day)
    .order('snapshot_date', { ascending: false });
  if (!data || data.length === 0) return null;
  const byChannel = new Map<string, number>();
  for (const row of data) {
    if (byChannel.has(row.channel)) continue;
    const v =
      (row.impressions as number | null) ??
      (row.page_views as number | null) ??
      (row.followers_total as number | null) ??
      0;
    byChannel.set(row.channel, v);
  }
  return Array.from(byChannel.values()).reduce((s, v) => s + v, 0);
}
