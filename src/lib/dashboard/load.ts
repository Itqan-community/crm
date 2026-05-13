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
  loadCalendarWeekSeries,
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
} from './types';
import {
  comparisonLabel,
  dateKey,
  defaultAnchor,
  formatPeriodGregorian,
  formatPeriodHijri,
  fromDateKey,
  periodRange,
  previousPeriodRange,
  type PeriodRange,
} from './calendar';

// Sunday-first labels, displayed in an RTL flex row so days[0]=أحد
// lands on the right edge — matching the chart's data array which is
// built Saturday→Sunday so its SVG-rightmost point is also Sunday.
const DAY_LABELS_SUN_FIRST = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

// Top-level entry. Three Supabase queries in parallel — typically
// <100ms once the daily table is populated.
//
// `anchorKey` is an optional YYYY-MM-DD that pins the period to a
// specific day/week/month (driven by the date picker in the toolbar).
// When absent we default to the LAST FULLY COMPLETED period before
// today — i.e. for `window=week`, the previous Sun→Sat. That gives a
// stable baseline; looking at an in-progress week is noisy and the
// previous-week comparison would be against the in-progress one too.
export async function loadDashboardData(
  window: DashboardWindow,
  anchorKey?: string,
): Promise<DashboardData> {
  const anchor =
    (anchorKey ? fromDateKey(anchorKey) : null) ?? defaultAnchor(window);
  const current = periodRange(window, anchor);
  const previous = previousPeriodRange(current);
  const [snapshots, socialByChannel, series] = await Promise.all([
    loadLatestSnapshots(current, previous),
    loadLatestSocialSnapshots(),
    // Chart shows the calendar week (Sun-Sat) containing the anchor.
    // For week-window this IS the period; for day-window the user
    // sees the day-in-context; for month-window we render the week
    // containing the period's start (1st of month).
    loadCalendarWeekSeries(anchor),
  ]);
  return buildDashboard(snapshots, socialByChannel, series, window, current, previous);
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
  current: PeriodRange,
  previous: PeriodRange,
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
    range: rangeLabel(window, current, previous),
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
        // Order matches the editor on /admin: events first
        // (مواضيع / ردود / إعجابات), then user state
        // (فاعلون / جدد). active_users summed over a multi-day
        // window is user-days, not distinct WAU — see the comment
        // in backfillForum() for why we accept that.
        breakdown: [
          { k: 'مواضيع جديدة',     v: numFromMeta(engagement.meta, 'discussions'),  c: 'var(--accent)' },
          { k: 'ردود',             v: numFromMeta(engagement.meta, 'replies'),      c: 'var(--gold)' },
          { k: 'إعجابات',          v: numFromMeta(engagement.meta, 'likes'),        c: 'var(--info)' },
          { k: 'مستخدمون فاعلون',  v: numFromMeta(engagement.meta, 'active_users'), c: 'var(--warn)' },
          { k: 'مستخدمون جدد',     v: numFromMeta(engagement.meta, 'new_users'),    c: 'var(--accent-soft)' },
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
        // For cumulative metrics, "new in window" = current cum −
        // cum from windowDays ago. Works for day / week / month.
        new: Math.max(0, publishers.value - publishers.previousValue),
      },
      beneficiaries: {
        value: beneficiaries.value,
        delta: beneficiaries.delta,
        new: Math.max(0, beneficiaries.value - beneficiaries.previousValue),
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
    days: dayLabels(),
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

function rangeLabel(
  window: DashboardWindow,
  current: PeriodRange,
  previous: PeriodRange,
): DashboardData['range'] {
  const hijri = formatPeriodHijri(current);
  const gregorian = formatPeriodGregorian(current);
  const compareHijri = formatPeriodHijri(previous);
  const compareGregorian = formatPeriodGregorian(previous);
  const cmpLabel = comparisonLabel(window);
  return {
    // Hijri-primary headline. Caller renders Gregorian as a small
    // secondary line — see Toolbar.tsx.
    label: hijri,
    compare: `مقارنة بـ ${compareHijri}`,
    hijriLabel: hijri,
    gregorianLabel: gregorian,
    compareHijriLabel: compareHijri,
    compareGregorianLabel: compareGregorian,
    comparisonLabel: cmpLabel,
    anchorKey: dateKey(current.start),
  };
}

// Static Sun-first labels — RTL flex puts labels[0]=أحد on the right
// edge, matching the calendar-week series which puts Sunday's value
// at index 6 (SVG-rightmost). Same array for every window selection.
function dayLabels(): string[] {
  return [...DAY_LABELS_SUN_FIRST];
}

function numFromMeta(meta: Record<string, unknown> | undefined, key: string): number {
  const v = (meta ?? {})[key];
  return typeof v === 'number' ? v : 0;
}

// Re-export so other modules can iterate.
export { ALL_METRIC_KEYS };
