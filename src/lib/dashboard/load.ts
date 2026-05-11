// Adapter that produces a DashboardData shape from:
//   1. The stats infrastructure bundle (loadStatsBundle from src/lib/stats)
//   2. Manually-entered social snapshots in dashboard_social_snapshots
// Sources that aren't configured (env vars missing) fall back to safe
// zeros so the page always renders. The original mock data lives in
// src/lib/dashboard-mock.ts and is used only by the design-canvas
// preview, not by /admin.

import { loadStatsBundle } from '@/lib/stats/loader';
import type { StatsBundle } from '@/lib/stats/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DashboardData } from '@/components/admin/dashboard/types';
import { loadAllSeries, type MetricKey } from './daily';
import {
  type DashboardWindow,
  type SocialSnapshot,
  type SocialChannelKey,
  DISPLAYED_CHANNELS,
  SOCIAL_LABELS,
  WINDOW_DAYS,
} from './types';

const DAY_LABELS_AR = ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'];

// Top-level entry. Pulls everything in parallel — page render is
// gated by the slowest of (a) stats bundle, (b) Supabase social query.
export async function loadDashboardData(window: DashboardWindow): Promise<DashboardData> {
  const days = WINDOW_DAYS[window];
  const [bundle, socialByChannel, dailySeries] = await Promise.all([
    loadStatsBundle({ windowDays: days }),
    loadLatestSocialSnapshots(),
    loadAllSeries(7),
  ]);
  return mapBundle(bundle, socialByChannel, dailySeries, window);
}

// Latest snapshot per channel — DISTINCT ON would be cleaner but we
// avoid raw SQL via the JS client. The table is small (one row per
// channel per week) so fetching all and grouping in memory is cheap.
async function loadLatestSocialSnapshots(): Promise<Map<SocialChannelKey, SocialSnapshot>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('dashboard_social_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false });
  if (error || !data) return new Map();
  const byChannel = new Map<SocialChannelKey, SocialSnapshot>();
  for (const row of data as SocialSnapshot[]) {
    if (!byChannel.has(row.channel)) byChannel.set(row.channel, row);
  }
  return byChannel;
}

// ---- Mapping --------------------------------------------------------

function mapBundle(
  bundle: StatsBundle,
  social: Map<SocialChannelKey, SocialSnapshot>,
  daily: Record<MetricKey, { now: number[]; prev: number[] }>,
  window: DashboardWindow,
): DashboardData {
  const days = WINDOW_DAYS[window];
  return {
    range: rangeLabel(bundle.range, window),
    community: {
      newsletter: mapNewsletter(bundle),
      engagement: mapEngagement(bundle, days),
      socialReach: mapSocial(social),
      siteVisits: mapVisits(bundle),
    },
    platform: {
      publishers: mapPublishers(bundle),
      beneficiaries: mapBeneficiaries(bundle),
      consumption: mapConsumption(bundle),
      shares: mapShares(bundle),
    },
    series: {
      newsletter:    daily.newsletter,
      engagement:    daily.engagement,
      socialReach:   daily.social_reach,
      siteVisits:    daily.site_visits,
      publishers:    daily.publishers,
      beneficiaries: daily.beneficiaries,
      consumption:   daily.consumption,
      shares:        daily.shares,
    },
    days: dayLabels(days),
  };
}

function rangeLabel(
  range: StatsBundle['range'],
  window: DashboardWindow,
): DashboardData['range'] {
  const end = new Date(range.end);
  const start = new Date(range.start);
  const fmt = (d: Date) =>
    d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  const year = end.getFullYear();
  return {
    label: `${fmt(start)} – ${fmt(end)} ${year}`,
    compare:
      window === 'day' ? 'مقارنة باليوم السابق' : 'مقارنة بالشهر السابق',
  };
}

function mapNewsletter(bundle: StatsBundle): DashboardData['community']['newsletter'] {
  const n = bundle.newsletter;
  if (!n) return zeroNewsletter();
  // Prefer the most recent campaign for the headline; fall back to the
  // 7-day average when there's no recent send.
  const campaign = n.lastCampaign;
  if (!campaign) {
    return {
      value: n.last7Days.totalSent,
      delta: 0,
      rate: n.last7Days.avgOpenRate,
      prevRate: 0,
      opened: 0,
      sent: n.last7Days.totalSent,
    };
  }
  // Delta = lastCampaign open rate vs the 7-day average (proxy until
  // we capture a real prior-week snapshot).
  const delta =
    n.last7Days.avgOpenRate > 0
      ? campaign.openRate - n.last7Days.avgOpenRate
      : 0;
  return {
    value: campaign.sent,
    delta: Math.round(delta * 10) / 10,
    rate: campaign.openRate,
    prevRate: n.last7Days.avgOpenRate,
    opened: campaign.opens,
    sent: campaign.sent,
  };
}

function zeroNewsletter(): DashboardData['community']['newsletter'] {
  return { value: 0, delta: 0, rate: 0, prevRate: 0, opened: 0, sent: 0 };
}

function mapEngagement(
  bundle: StatsBundle,
  _days: number,
): DashboardData['community']['engagement'] {
  // Map what we have from the forum into the breakdown items. Mentions
  // and shares aren't tracked anywhere yet — show 0 until either the
  // forum exposes them or we add a manual-entry surface.
  const f = bundle.forum;
  const replies = f ? (f.newPosts ?? 0) + (f.newDiscussions ?? 0) : 0;
  // Likes are total-only in ForumMetrics; window-bound likes need a
  // schema change in the stats branch — stub at 0 for now.
  const likes = 0;
  const mentions = 0;
  const shares = 0;
  return {
    value: replies + likes + mentions + shares,
    delta: 0,
    breakdown: [
      { k: 'ردود ومناقشات', v: replies, c: 'var(--accent)' },
      { k: 'إعجابات', v: likes, c: 'var(--gold)' },
      { k: 'إشارات وذكر', v: mentions, c: 'var(--info)' },
      { k: 'مشاركات', v: shares, c: 'var(--warn)' },
    ],
  };
}

function mapSocial(
  social: Map<SocialChannelKey, SocialSnapshot>,
): DashboardData['community']['socialReach'] {
  // Pick the headline number per channel: impressions > page_views >
  // followers_total. That mirrors what each platform's analytics tab
  // shows as the "reach" KPI.
  const channels = DISPLAYED_CHANNELS.flatMap((key) => {
    const snap = social.get(key);
    if (!snap) return [];
    const v = snap.impressions ?? snap.page_views ?? snap.followers_total ?? 0;
    return [{ k: SOCIAL_LABELS[key], v, d: 0 }]; // delta=0 until we have ≥2 snapshots
  });
  const value = channels.reduce((s, c) => s + c.v, 0);
  return { value, delta: 0, channels };
}

function mapVisits(bundle: StatsBundle): DashboardData['community']['siteVisits'] {
  const a = bundle.analytics;
  if (!a) return { value: 0, delta: 0, uniq: 0, returning: 0 };
  const value = a.pageviews.value;
  const prev = a.pageviews.prev;
  const delta = prev != null && prev > 0 ? ((value - prev) / prev) * 100 : 0;
  return {
    value,
    delta: Math.round(delta * 10) / 10,
    uniq: a.activeUsers.value,
    returning: Math.max(0, a.sessions.value - a.newUsers),
  };
}

function mapPublishers(bundle: StatsBundle): DashboardData['platform']['publishers'] {
  const c = bundle.cms;
  if (!c) return { value: 0, delta: 0, new: 0 };
  return { value: c.totalPublishers, delta: 0, new: c.newPublishers30d };
}

function mapBeneficiaries(bundle: StatsBundle): DashboardData['platform']['beneficiaries'] {
  const c = bundle.cms;
  if (!c) return { value: 0, delta: 0, new: 0 };
  return { value: c.totalUsers, delta: 0, new: c.newUsers30d };
}

function mapConsumption(bundle: StatsBundle): DashboardData['platform']['consumption'] {
  const c = bundle.cms;
  if (!c) {
    return {
      value: 0,
      delta: 0,
      mix: [
        { k: 'قراءة', v: 0, c: 'var(--accent)' },
        { k: 'تحميل', v: 0, c: 'var(--gold)' },
        { k: 'استماع', v: 0, c: 'var(--info)' },
        { k: 'مشاركة', v: 0, c: 'var(--warn)' },
      ],
    };
  }
  // Headline is asset count (cms.totalAssets) — best proxy until
  // Mixpanel ingestion lands. Mix breakdown stays aspirational with
  // zero values for now (the segmented bar collapses) so the UI
  // doesn't lie about a split it can't measure.
  return {
    value: c.totalAssets,
    delta: 0,
    mix: [
      { k: 'قراءة', v: 0, c: 'var(--accent)' },
      { k: 'تحميل', v: 0, c: 'var(--gold)' },
      { k: 'استماع', v: 0, c: 'var(--info)' },
      { k: 'مشاركة', v: 0, c: 'var(--warn)' },
    ],
  };
}

function mapShares(bundle: StatsBundle): DashboardData['platform']['shares'] {
  // No "shares" metric in any current source. Surface the forum's
  // total likes as a stand-in for "community reactions" until we
  // add a real shares counter.
  const f = bundle.forum;
  if (!f) return { value: 0, delta: 0 };
  return { value: f.totalLikes ?? 0, delta: 0 };
}

function dayLabels(days: number): string[] {
  // For 'اليوم' (1d) and 'الشهر' (30d) we still render a 7-bucket
  // sparkline canvas — the labels stay weekday-named for visual
  // consistency with the design. Once real series are wired we'll
  // generate proper bucket labels per window.
  if (days <= 7) return DAY_LABELS_AR.slice(-days).concat(DAY_LABELS_AR).slice(0, 7);
  return DAY_LABELS_AR;
}
