// Server-side data loader for the dashboard. Three-tier merge per metric:
//   1. Itqan stats project (Itqan-community/stats) — live data via HTTP
//   2. Direct MailerLite API — newsletter open rate fallback
//   3. Supabase `dashboard_metrics` — manually-entered values
//
// Each metric's `source` field on the returned blob tells the UI which
// pipeline produced its value (so we can show "MailerLite" / "GitHub" /
// "GA" / "يدوي" badges on the cards).

import { createSupabaseServerClient } from './supabase/server';
import {
  addWeeks,
  formatGregorianRange,
  formatHijri,
  formatHijriRange,
  lastNWeekStarts,
  startOfKsaWeek,
  weekKey,
} from './dates';
import { loadNewsletterWeeklyStats } from './mailerlite-stats';
import { fetchAllStats } from './stats-client';
import type { DashboardData, MetricSource } from '@/components/admin/dashboard/types';

const HIJRI_DAY_FMT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  day: 'numeric',
  timeZone: 'Asia/Riyadh',
});

// Manual-only keys: things stats can't supply (other social channels).
// Everything else is derived from stats with a manual fallback.
export const METRIC_KEYS = {
  // newsletter (manual override only — primary path is MailerLite/stats)
  newsletterSent: 'newsletter.sent',
  newsletterOpened: 'newsletter.opened',
  // engagement breakdown — manual cosmetic overrides; main value comes from forum
  engagementTotal: 'engagement.total',
  engagementReplies: 'engagement.replies',
  engagementLikes: 'engagement.likes',
  engagementMentions: 'engagement.mentions',
  engagementShares: 'engagement.shares',
  // social reach — only LinkedIn comes from stats; X/Instagram/YouTube stay manual
  socialReachX: 'social_reach.x',
  socialReachInstagram: 'social_reach.instagram',
  socialReachLinkedin: 'social_reach.linkedin',
  socialReachYoutube: 'social_reach.youtube',
  // site visits — manual override; stats supplies via GA
  siteVisitsTotal: 'site_visits.total',
  siteVisitsUnique: 'site_visits.unique',
  siteVisitsReturning: 'site_visits.returning',
  // platform — manual overrides; stats supplies via Quran Apps + Forum
  publishersTotal: 'publishers.total',
  publishersNew: 'publishers.new',
  beneficiariesTotal: 'beneficiaries.total',
  beneficiariesNew: 'beneficiaries.new',
  consumptionRead: 'consumption.read',
  consumptionDownload: 'consumption.download',
  consumptionListen: 'consumption.listen',
  consumptionShare: 'consumption.share',
  shares: 'shares.total',
} as const;

export const ALL_METRIC_KEYS = Object.values(METRIC_KEYS);

type MetricsByWeek = Record<string, Record<string, number>>;

async function loadMetricsTable(weekStarts: Date[]): Promise<MetricsByWeek> {
  if (weekStarts.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const startKeys = weekStarts.map(weekKey);
  const { data, error } = await supabase
    .from('dashboard_metrics')
    .select('week_start, metric_key, value')
    .in('week_start', startKeys);
  if (error) {
    console.warn('[dashboard-queries] metrics table read failed', error.message);
    return Object.fromEntries(startKeys.map((k) => [k, {}]));
  }
  const out: MetricsByWeek = Object.fromEntries(startKeys.map((k) => [k, {}]));
  for (const row of data ?? []) {
    const key = row.week_start as string;
    if (!out[key]) out[key] = {};
    out[key][row.metric_key as string] = Number(row.value);
  }
  return out;
}

function pct(now: number, prev: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null;
  if (prev === 0) return now === 0 ? 0 : null;
  return ((now - prev) / prev) * 100;
}

function series(
  metrics: MetricsByWeek,
  prevMetrics: MetricsByWeek,
  weeksNow: Date[],
  weeksPrev: Date[],
  key: string,
): { now: number[]; prev: number[] } {
  return {
    now: weeksNow.map((d) => metrics[weekKey(d)]?.[key] ?? 0),
    prev: weeksPrev.map((d) => prevMetrics[weekKey(d)]?.[key] ?? 0),
  };
}

// Pick the first finite/non-zero value from a list of (value, source) pairs.
// Used to express the precedence chain: stats > mailerlite > manual > 0.
function pick(
  candidates: Array<[number | null | undefined, MetricSource]>,
  fallbackSource: MetricSource = 'manual',
): { value: number; source: MetricSource } {
  for (const [v, s] of candidates) {
    if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
      return { value: v, source: s };
    }
  }
  // All zero/missing: still return the most-preferred non-null candidate's
  // source so the UI labels accurately even when the value is genuinely 0.
  for (const [v, s] of candidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return { value: v, source: s };
  }
  return { value: 0, source: fallbackSource };
}

export async function loadDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const weekStarts = lastNWeekStarts(8, now);
  const currentStart = weekStarts[weekStarts.length - 1];
  const previousStart = addWeeks(currentStart, -1);
  const weekEnd = new Date(currentStart.getTime() + 7 * 24 * 3_600_000 - 1);
  const previousEnd = new Date(currentStart.getTime() - 1);

  const prevWeekStarts = weekStarts.map((d) => addWeeks(d, -8));
  const allWeeks = [...weekStarts, ...prevWeekStarts];

  const [allMetrics, mailerWeekly, statsCurrent, statsPrev] = await Promise.all([
    loadMetricsTable(allWeeks),
    loadNewsletterWeeklyStats(weekStarts),
    fetchAllStats({ range: { start: currentStart, end: weekEnd } }),
    fetchAllStats({ range: { start: previousStart, end: previousEnd } }),
  ]);

  const cur = (key: string) => allMetrics[weekKey(currentStart)]?.[key] ?? 0;
  const prev = (key: string) => allMetrics[weekKey(previousStart)]?.[key] ?? 0;

  // ----- Newsletter -----
  // Prefer the live MailerLite read over stats so we get the open RATE for
  // exactly our Sun→Sat KSA week. Stats's newsletter endpoint exposes a
  // global avg (across all campaigns), not per-week.
  let newsletterSentCur = cur(METRIC_KEYS.newsletterSent);
  let newsletterOpenedCur = cur(METRIC_KEYS.newsletterOpened);
  let newsletterSentPrev = prev(METRIC_KEYS.newsletterSent);
  let newsletterOpenedPrev = prev(METRIC_KEYS.newsletterOpened);
  let newsletterSource: MetricSource = 'manual';
  let newsletterRateOverride: number | null = null;
  let newsletterPrevRateOverride: number | null = null;
  if (mailerWeekly) {
    const c = mailerWeekly[weekKey(currentStart)];
    const p = mailerWeekly[weekKey(previousStart)];
    if (c && (c.sent > 0 || c.opened > 0)) {
      newsletterSentCur = c.sent;
      newsletterOpenedCur = c.opened;
      newsletterSource = 'mailerlite';
    }
    if (p && (p.sent > 0 || p.opened > 0)) {
      newsletterSentPrev = p.sent;
      newsletterOpenedPrev = p.opened;
    }
  }
  // If MailerLite isn't configured but stats is, use stats's global
  // averages directly (no synthetic sent/opened) — the rate is the
  // honest signal we have, week-specific values are unavailable.
  if (newsletterSource === 'manual' && statsCurrent.newsletter) {
    const n = statsCurrent.newsletter;
    if (n.totalCampaignsSent > 0 || n.activeSubscribers > 0) {
      newsletterSentCur = n.activeSubscribers;
      newsletterOpenedCur = 0;
      newsletterRateOverride = n.avgOpenRate;
      newsletterPrevRateOverride = statsPrev.newsletter?.avgOpenRate ?? n.avgOpenRate;
      newsletterSource = 'stats:newsletter';
    }
  }
  const rate =
    newsletterRateOverride ??
    (newsletterSentCur > 0 ? (newsletterOpenedCur / newsletterSentCur) * 100 : 0);
  const prevRate =
    newsletterPrevRateOverride ??
    (newsletterSentPrev > 0 ? (newsletterOpenedPrev / newsletterSentPrev) * 100 : 0);

  // ----- Engagement (Forum) -----
  // Use only WEEKLY quantities — stats's `totalPosts` / `totalLikes` /
  // `totalDiscussions` are cumulative all-time totals and would dominate
  // the running total + flatline the WoW delta. The forum endpoint
  // exposes weekly buckets via `newPosts.value`, `newDiscussions.value`,
  // and `newUsers.value`.
  const curForum = statsCurrent.forum?.metrics;
  const prevForum = statsPrev.forum?.metrics;
  const forumPostsCur = curForum?.newPosts.value ?? cur(METRIC_KEYS.engagementReplies);
  const forumDiscCur = curForum?.newDiscussions.value ?? cur(METRIC_KEYS.engagementMentions);
  const forumNewUsersCur = curForum?.newUsers.value ?? 0;
  const forumPostsPrev = prevForum?.newPosts.value ?? prev(METRIC_KEYS.engagementReplies);
  const forumDiscPrev = prevForum?.newDiscussions.value ?? prev(METRIC_KEYS.engagementMentions);
  const forumNewUsersPrev = prevForum?.newUsers.value ?? 0;
  // Manual "shares" sub-component: stats doesn't model reposts/shares
  // separately, so this stays a manual field.
  const engagementSharesCur = cur(METRIC_KEYS.engagementShares);
  const engagementSharesPrev = prev(METRIC_KEYS.engagementShares);
  const engagementTotalCur =
    forumPostsCur + forumDiscCur + forumNewUsersCur + engagementSharesCur;
  const engagementTotalPrev =
    forumPostsPrev + forumDiscPrev + forumNewUsersPrev + engagementSharesPrev;
  const engagementSource: MetricSource = curForum
    ? engagementSharesCur > 0
      ? 'mixed'
      : 'stats:forum'
    : 'manual';

  // ----- Social reach -----
  // LinkedIn live; X / Instagram / YouTube remain manual.
  const linkedinCur = statsCurrent.linkedin?.metrics?.totalImpressions ?? 0;
  const linkedinPrev = statsPrev.linkedin?.metrics?.totalImpressions ?? 0;
  const social = {
    x: cur(METRIC_KEYS.socialReachX),
    instagram: cur(METRIC_KEYS.socialReachInstagram),
    linkedin: linkedinCur || cur(METRIC_KEYS.socialReachLinkedin),
    youtube: cur(METRIC_KEYS.socialReachYoutube),
  };
  const socialPrevVals = {
    x: prev(METRIC_KEYS.socialReachX),
    instagram: prev(METRIC_KEYS.socialReachInstagram),
    linkedin: linkedinPrev || prev(METRIC_KEYS.socialReachLinkedin),
    youtube: prev(METRIC_KEYS.socialReachYoutube),
  };
  const socialTotal = social.x + social.instagram + social.linkedin + social.youtube;
  const socialTotalPrev =
    socialPrevVals.x + socialPrevVals.instagram + socialPrevVals.linkedin + socialPrevVals.youtube;
  const socialSource: MetricSource =
    linkedinCur > 0 && (social.x > 0 || social.instagram > 0 || social.youtube > 0)
      ? 'mixed'
      : linkedinCur > 0
        ? 'stats:linkedin'
        : 'manual';

  // ----- Site visits (GA via stats) -----
  // The stats project's analytics endpoint hard-codes a 7d-vs-14d window
  // and ignores ?start/?end. Use the `change` it returns directly rather
  // than computing pct(currentRange, prevRange) — the latter would be 0.
  const ga = statsCurrent.analytics?.metrics;
  const sitePicked = pick([
    [ga?.pageviews?.value, 'stats:analytics'],
    [cur(METRIC_KEYS.siteVisitsTotal), 'manual'],
  ]);
  const sitePickedPrev = pick([
    [
      ga?.pageviews && Number.isFinite(ga.pageviews.change)
        ? // back-compute the previous-period value so deltas downstream
          // (CSV export, etc.) line up with the displayed change
          Math.round(ga.pageviews.value / (1 + ga.pageviews.change / 100))
        : undefined,
      'stats:analytics',
    ],
    [prev(METRIC_KEYS.siteVisitsTotal), 'manual'],
  ]);
  const siteUniqPicked = pick([
    [ga?.uniqueVisitors?.value, 'stats:analytics'],
    [cur(METRIC_KEYS.siteVisitsUnique), 'manual'],
  ]);
  const siteReturning = cur(METRIC_KEYS.siteVisitsReturning);

  // ----- Publishers (Quran Apps + GitHub) -----
  // The stats project models "publishers" as the QuranApp directory
  // (CMS-tracked external apps). GitHub repos are a secondary signal.
  const appsCur = statsCurrent.apps?.totalApps ?? 0;
  const appsPrev = statsPrev.apps?.totalApps ?? 0;
  const publishersPicked = pick([
    [appsCur, 'stats:apps'],
    [cur(METRIC_KEYS.publishersTotal), 'manual'],
  ]);
  const publishersPickedPrev = pick([
    [appsPrev, 'stats:apps'],
    [prev(METRIC_KEYS.publishersTotal), 'manual'],
  ]);
  const publishersNew = cur(METRIC_KEYS.publishersNew);

  // ----- Beneficiaries (Forum users + Newsletter subscribers) -----
  // Cumulative is the right shape for "total beneficiaries". Source is
  // 'mixed' only if both contributors are non-zero — otherwise label
  // honestly with whichever live source we actually used.
  const forumUsers = curForum?.totalUsers ?? 0;
  const newsletterSubs = statsCurrent.newsletter?.activeSubscribers ?? 0;
  const beneficiariesLive = forumUsers + newsletterSubs;
  const forumUsersPrev = prevForum?.totalUsers ?? 0;
  const newsletterSubsPrev = statsPrev.newsletter?.activeSubscribers ?? 0;
  const beneficiariesLivePrev = forumUsersPrev + newsletterSubsPrev;
  const beneficiariesLiveSource: MetricSource =
    forumUsers > 0 && newsletterSubs > 0
      ? 'mixed'
      : forumUsers > 0
        ? 'stats:forum'
        : newsletterSubs > 0
          ? 'stats:newsletter'
          : 'manual';
  const beneficiariesPicked = pick([
    [beneficiariesLive, beneficiariesLiveSource],
    [cur(METRIC_KEYS.beneficiariesTotal), 'manual'],
  ]);
  const beneficiariesPickedPrev = pick([
    [beneficiariesLivePrev, beneficiariesLiveSource],
    [prev(METRIC_KEYS.beneficiariesTotal), 'manual'],
  ]);
  const beneficiariesNew =
    curForum?.newUsers.value ?? cur(METRIC_KEYS.beneficiariesNew);

  // ----- Consumption (manual) -----
  // Stats's apps endpoint exposes only cumulative `totalViews` / `totalClicks`
  // (3.97M views all-time); we can't honestly compare week-over-week from
  // that, so consumption stays a manual entry. A future stats endpoint
  // that exposes weekly app-views would let us flip this on.
  const consumption = {
    read: cur(METRIC_KEYS.consumptionRead),
    download: cur(METRIC_KEYS.consumptionDownload),
    listen: cur(METRIC_KEYS.consumptionListen),
    share: cur(METRIC_KEYS.consumptionShare),
  };
  const consumptionTotal =
    consumption.read + consumption.download + consumption.listen + consumption.share;
  const consumptionPrevTotal =
    prev(METRIC_KEYS.consumptionRead) +
    prev(METRIC_KEYS.consumptionDownload) +
    prev(METRIC_KEYS.consumptionListen) +
    prev(METRIC_KEYS.consumptionShare);
  const consumptionSource: MetricSource = 'manual';

  // ----- Community shares -----
  // Forum endpoint's `newPosts.value` is the weekly bucket; `totalPosts`
  // is cumulative and would mask weekly movement.
  const sharesPicked = pick([
    [curForum?.newPosts.value, 'stats:forum'],
    [cur(METRIC_KEYS.shares), 'manual'],
  ]);
  const sharesPickedPrev = pick([
    [prevForum?.newPosts.value, 'stats:forum'],
    [prev(METRIC_KEYS.shares), 'manual'],
  ]);

  // ----- Day labels for hero chart -----
  const weekDays = weekStarts.map((d) => HIJRI_DAY_FMT.format(d));

  // ----- Series (sparklines) -----
  // We don't have weekly stats history from the stats project (would need
  // 8 round-trips). For now sparklines come from `dashboard_metrics`
  // (manual entry over time). A future cron can write live-pulled values
  // into this table on a Sunday boundary.
  const newsletterSeries = series(
    allMetrics,
    allMetrics,
    weekStarts,
    prevWeekStarts,
    METRIC_KEYS.newsletterSent,
  );
  if (mailerWeekly) {
    newsletterSeries.now = weekStarts.map((d) => mailerWeekly[weekKey(d)]?.sent ?? 0);
  }

  return {
    range: {
      startISO: currentStart.toISOString(),
      endISO: weekEnd.toISOString(),
      hijriLabel: formatHijriRange(currentStart, weekEnd),
      gregorianLabel: formatGregorianRange(currentStart, weekEnd),
      compareHijriLabel: `${formatHijri(previousStart)} – ${formatHijri(previousEnd)}`,
    },
    community: {
      newsletter: {
        value: newsletterSentCur,
        delta: pct(newsletterSentCur, newsletterSentPrev),
        rate,
        prevRate,
        opened: newsletterOpenedCur,
        sent: newsletterSentCur,
        source: newsletterSource,
      },
      engagement: {
        value: engagementTotalCur,
        delta: pct(engagementTotalCur, engagementTotalPrev),
        breakdown: [
          { k: 'ردود ومنشورات', v: forumPostsCur, c: 'var(--accent)' },
          { k: 'نقاشات جديدة', v: forumDiscCur, c: 'var(--info)' },
          { k: 'أعضاء جدد', v: forumNewUsersCur, c: 'var(--gold)' },
          { k: 'مشاركات', v: engagementSharesCur, c: 'var(--warn)' },
        ],
        source: engagementSource,
      },
      socialReach: {
        value: socialTotal,
        delta: pct(socialTotal, socialTotalPrev),
        channels: [
          { k: 'X (تويتر)', v: social.x, d: pct(social.x, socialPrevVals.x) },
          {
            k: 'إنستقرام',
            v: social.instagram,
            d: pct(social.instagram, socialPrevVals.instagram),
          },
          {
            k: 'لينكدإن',
            v: social.linkedin,
            d: pct(social.linkedin, socialPrevVals.linkedin),
          },
          {
            k: 'يوتيوب',
            v: social.youtube,
            d: pct(social.youtube, socialPrevVals.youtube),
          },
        ].filter((c) => c.v > 0 || c.d !== null),
        source: socialSource,
      },
      siteVisits: {
        value: sitePicked.value,
        delta: pct(sitePicked.value, sitePickedPrev.value),
        uniq: siteUniqPicked.value,
        returning: siteReturning,
        source: sitePicked.source,
      },
    },
    platform: {
      publishers: {
        value: publishersPicked.value,
        delta: pct(publishersPicked.value, publishersPickedPrev.value),
        new: publishersNew,
        source: publishersPicked.source,
      },
      beneficiaries: {
        value: beneficiariesPicked.value,
        delta: pct(beneficiariesPicked.value, beneficiariesPickedPrev.value),
        new: beneficiariesNew,
        source: beneficiariesPicked.source,
      },
      consumption: {
        value: consumptionTotal,
        delta: pct(consumptionTotal, consumptionPrevTotal),
        mix: [
          { k: 'قراءة', v: consumption.read, c: 'var(--accent)' },
          { k: 'تحميل', v: consumption.download, c: 'var(--gold)' },
          { k: 'استماع', v: consumption.listen, c: 'var(--info)' },
          { k: 'مشاركة', v: consumption.share, c: 'var(--warn)' },
        ],
        source: consumptionSource,
      },
      shares: {
        value: sharesPicked.value,
        delta: pct(sharesPicked.value, sharesPickedPrev.value),
        source: sharesPicked.source,
      },
    },
    series: {
      newsletter: newsletterSeries,
      engagement: series(allMetrics, allMetrics, weekStarts, prevWeekStarts, METRIC_KEYS.engagementTotal),
      socialReach: series(allMetrics, allMetrics, weekStarts, prevWeekStarts, METRIC_KEYS.socialReachX),
      siteVisits: series(allMetrics, allMetrics, weekStarts, prevWeekStarts, METRIC_KEYS.siteVisitsTotal),
      publishers: series(allMetrics, allMetrics, weekStarts, prevWeekStarts, METRIC_KEYS.publishersTotal),
      beneficiaries: series(allMetrics, allMetrics, weekStarts, prevWeekStarts, METRIC_KEYS.beneficiariesTotal),
      consumption: series(allMetrics, allMetrics, weekStarts, prevWeekStarts, METRIC_KEYS.consumptionRead),
      shares: series(allMetrics, allMetrics, weekStarts, prevWeekStarts, METRIC_KEYS.shares),
    },
    days: weekDays,
  };
}

export async function loadMetricsForWeeks(weekStarts: Date[]): Promise<MetricsByWeek> {
  return loadMetricsTable(weekStarts);
}

export function makeWeekStartFromKsa(date: Date = new Date()): Date {
  return startOfKsaWeek(date);
}
