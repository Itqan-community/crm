// Today's snapshot: query every configured source, build per-metric
// rows, and upsert into dashboard_metric_daily. Used by the daily cron
// (Vercel Cron @ 02:00 UTC) and by the on-demand tester endpoint.

import { loadStatsBundle } from '@/lib/stats/loader';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { writeDailyRows, todayISO, type DailyRow } from './daily';

export type CaptureResult = {
  day: string;
  rows: DailyRow[];
  written: number;
  skippedManual: number;
};

export async function captureTodaySnapshot(): Promise<CaptureResult> {
  const bundle = await loadStatsBundle({ windowDays: 1 });
  const day = todayISO();
  const rows: DailyRow[] = [];

  if (bundle.forum) {
    // Five separate signals (see backfillForum for the rationale):
    //   discussions  = new threads
    //   replies      = real replies (posts − discussions)
    //   likes        = post_likes count
    //   new_users    = signups
    //   active_users = DAU
    // value rolls up only event counts so weekly sums stay meaningful.
    const discussions = bundle.forum.newDiscussions ?? 0;
    const replies = bundle.forum.newReplies ?? 0;
    const likes = bundle.forum.newLikes ?? 0;
    const new_users = bundle.forum.newUsers ?? 0;
    const active_users = bundle.forum.activeUsers ?? 0;
    rows.push({
      day,
      metric_key: 'engagement',
      value: discussions + replies + likes,
      meta: { discussions, replies, likes, new_users, active_users },
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
    const opens = c.opens > 0 ? c.opens : Math.round((c.sent * c.openRate) / 100);
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

  // social_reach derives from the manual snapshots table. Re-read it
  // daily so a new snapshot entered today shows up in tomorrow's
  // series too.
  const socialReach = await computeSocialReachForDay(day);
  if (socialReach != null) {
    rows.push({ day, metric_key: 'social_reach', value: socialReach });
  }

  const written = await writeDailyRows(rows);
  return { day, rows, ...written };
}

async function computeSocialReachForDay(day: string): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('dashboard_social_snapshots')
    .select('channel, snapshot_date, impressions, page_views, followers_total')
    .lte('snapshot_date', day)
    .order('snapshot_date', { ascending: false });
  // Surface query errors instead of swallowing them as "no rows" — a DB
  // problem here should make the cron run fail loud so we notice it
  // instead of silently writing nothing.
  if (error) throw new Error(`social_reach query failed: ${error.message}`);
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
