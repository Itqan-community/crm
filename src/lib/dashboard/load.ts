// Adapter that produces a DashboardData shape entirely from the
// internal Supabase tables — no live source calls in the hot path.
//
// What feeds the dashboard:
//   - dashboard_metric_daily   → headline value, delta, meta (rate,
//                                uniq/returning, breakdown, …), and
//                                the 7-day sparkline series.
//   - dashboard_social_snapshots → channel list for "الوصول عبر
//                                  الشبكات" + the headline reach total.
//
// Live sources are still queried — but only by the cron route and
// the admin-triggered backfill, which write into dashboard_metric_daily.
// /admin reads from there, so the page renders fast and works even
// when a source is temporarily down.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DashboardData } from '@/components/admin/dashboard/types';
import {
  ALL_METRIC_KEYS,
  loadAllSeries,
  loadLatestSnapshots,
  type LatestSnapshot,
  type MetricKey,
} from './daily';
import {
  type DashboardWindow,
  type SocialSnapshot,
  type SocialChannelKey,
  DISPLAYED_CHANNELS,
  SOCIAL_LABELS,
  WINDOW_DAYS,
} from './types';

// Sunday-first weekday names — index matches JS Date.getDay().
const DAY_NAMES_AR_BY_INDEX = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

// Top-level entry. Two Supabase queries in parallel — typically <100ms
// to first byte once the daily table is populated.
export async function loadDashboardData(window: DashboardWindow): Promise<DashboardData> {
  const offsetDays = WINDOW_DAYS[window];
  const [snapshots, socialByChannel, series] = await Promise.all([
    loadLatestSnapshots(offsetDays),
    loadLatestSocialSnapshots(),
    loadAllSeries(7),
  ]);
  return buildDashboard(snapshots, socialByChannel, series, window);
}

// Latest snapshot per channel.
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

// ---- Builder ----------------------------------------------------------------

function buildDashboard(
  snapshots: Map<MetricKey, LatestSnapshot>,
  social: Map<SocialChannelKey, SocialSnapshot>,
  series: Record<MetricKey, { now: number[]; prev: number[] }>,
  window: DashboardWindow,
): DashboardData {
  // Pull every metric we might use, defaulting to a zero snapshot so
  // the UI never crashes on a missing key.
  const get = (k: MetricKey): LatestSnapshot =>
    snapshots.get(k) ?? { value: 0, delta: 0, previousValue: 0, meta: {} };

  // Initialize the meta-bearing snapshots once so the field reads stay
  // tidy in the section builders below.
  const newsletter = get('newsletter');
  const engagement = get('engagement');
  const siteVisits = get('site_visits');
  const publishers = get('publishers');
  const beneficiaries = get('beneficiaries');
  const consumption = get('consumption');
  const shares = get('shares');

  return {
    range: rangeLabel(window),
    community: {
      newsletter: {
        value: newsletter.value,
        delta: newsletter.delta,
        rate: numFromMeta(newsletter.meta, 'rate'),
        prevRate: numFromMeta(newsletter.meta, 'prevRate'),
        opened: numFromMeta(newsletter.meta, 'opened'),
        sent: newsletter.value,
      },
      engagement: {
        value: engagement.value,
        delta: engagement.delta,
        breakdown: [
          { k: 'ردود ومناقشات', v: numFromMeta(engagement.meta, 'replies'),  c: 'var(--accent)' },
          { k: 'إعجابات',       v: numFromMeta(engagement.meta, 'likes'),    c: 'var(--gold)' },
          { k: 'إشارات وذكر',   v: numFromMeta(engagement.meta, 'mentions'), c: 'var(--info)' },
          { k: 'مشاركات',       v: numFromMeta(engagement.meta, 'shares'),   c: 'var(--warn)' },
        ],
      },
      socialReach: buildSocialReach(social),
      siteVisits: {
        value: siteVisits.value,
        delta: siteVisits.delta,
        uniq: numFromMeta(siteVisits.meta, 'uniq'),
        returning: numFromMeta(siteVisits.meta, 'returning'),
      },
    },
    platform: {
      publishers: {
        value: publishers.value,
        delta: publishers.delta,
        new: numFromMeta(publishers.meta, 'new_30d'),
      },
      beneficiaries: {
        value: beneficiaries.value,
        delta: beneficiaries.delta,
        new: numFromMeta(beneficiaries.meta, 'new_30d'),
      },
      consumption: {
        value: consumption.value,
        delta: consumption.delta,
        // Mix breakdown isn't tracked yet (needs Mixpanel) — emit
        // zero-width segments so the bar collapses honestly.
        mix: [
          { k: 'قراءة',  v: 0, c: 'var(--accent)' },
          { k: 'تحميل',  v: 0, c: 'var(--gold)' },
          { k: 'استماع', v: 0, c: 'var(--info)' },
          { k: 'مشاركة', v: 0, c: 'var(--warn)' },
        ],
      },
      shares: { value: shares.value, delta: shares.delta },
    },
    series: {
      newsletter:    series.newsletter,
      engagement:    series.engagement,
      socialReach:   series.social_reach,
      siteVisits:    series.site_visits,
      publishers:    series.publishers,
      beneficiaries: series.beneficiaries,
      consumption:   series.consumption,
      shares:        series.shares,
    },
    days: dayLabels(7),
  };
}

function buildSocialReach(
  social: Map<SocialChannelKey, SocialSnapshot>,
): DashboardData['community']['socialReach'] {
  const channels = DISPLAYED_CHANNELS.flatMap((key) => {
    const snap = social.get(key);
    if (!snap) return [];
    const v = snap.impressions ?? snap.page_views ?? snap.followers_total ?? 0;
    return [{ k: SOCIAL_LABELS[key], v, d: 0 }];
  });
  const value = channels.reduce((s, c) => s + c.v, 0);
  return { value, delta: 0, channels };
}

function rangeLabel(window: DashboardWindow): DashboardData['range'] {
  const today = new Date();
  const start = new Date(today.getTime() - (WINDOW_DAYS[window] - 1) * 86_400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  return {
    label: `${fmt(start)} – ${fmt(today)} ${today.getFullYear()}`,
    compare:
      window === 'day' ? 'مقارنة باليوم السابق' : 'مقارنة بالشهر السابق',
  };
}

// Returns weekday names matching the chart's data positions (oldest →
// newest). With the chart drawing left-to-right and the label row
// inside an RTL parent (justify-content: space-between), labels[0]
// renders on the right edge and labels[N-1] on the left.
//
// "Week starts on Sunday" — at the very least when today IS Sunday
// the rightmost label is أحد. For any other day the labels truthfully
// reflect what each chart point represents.
function dayLabels(days: number): string[] {
  const today = new Date();
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    labels.push(DAY_NAMES_AR_BY_INDEX[d.getDay()]);
  }
  // Reverse so the array's [0] aligns with the right-edge label in RTL
  // (the chart's "today" is the rightmost SVG point too, since SVG is
  // not flipped by parent direction).
  return labels.reverse();
}

function numFromMeta(meta: Record<string, unknown> | undefined, key: string): number {
  const v = (meta ?? {})[key];
  return typeof v === 'number' ? v : 0;
}

// Re-export so other modules can iterate.
export { ALL_METRIC_KEYS };
