// Top-level composition. One call → all sources fetched in parallel,
// failures isolated, return a typed bundle for the verification table.
//
// Caching note: each source already declares a 5-minute revalidation
// for HTTP fetches via Next's `next: { revalidate, tags }`. DB sources
// re-query on every page load — that's fine for an admin dashboard
// (low traffic, the COUNTs are cheap). When traffic grows we'll wrap
// the loader in `unstable_cache` with the same 5-minute TTL.

import { type StatsSource } from './env';
import { getNewsletter } from './sources/mailerlite';
import { getGithub } from './sources/github';
import { getAnalytics } from './sources/analytics';
import { getForum, getForumEngagementTiers } from './sources/flarum';
import { getQuranApps } from './sources/quran_apps';
import { getCms } from './sources/cms';
import { describeError } from './util';
import type { DateRange, StatsBundle } from './types';

const DEFAULT_WINDOW_DAYS = 7;

export type LoadOptions = {
  // Number of trailing days to use for window-bound metrics
  // (forum new-X, GitHub commits/PRs, GA pageviews). Default: 7.
  windowDays?: number;
};

// `days` counts calendar days INCLUDING today, so the window opens at
// 00:00 UTC of (today − (days−1)) — the same bucket boundary
// backfill.ts uses when it groups by DATE(created_at).
//
// The midnight snap is load-bearing: without it `days = 1` (what the
// daily capture asks for) produced start === end === now, a zero-width
// window, and every "new X in this window" count came back 0. Wider
// windows lost the hours-so-far slice of their first day.
function makeRange(days: number): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

export async function loadStatsBundle(
  opts: LoadOptions = {},
): Promise<StatsBundle> {
  const days = Math.max(1, Math.min(365, opts.windowDays ?? DEFAULT_WINDOW_DAYS));
  const range = makeRange(days);

  // Promise.allSettled — one source's failure must never break the page.
  const settled = await Promise.allSettled([
    getNewsletter(),
    getGithub({ range }),
    getAnalytics({ range }),
    getForum({ range }),
    getForumEngagementTiers({ range }),
    getQuranApps(),
    getCms(),
  ]);

  // Tiers share the forum's env var and error bucket — a failure there
  // is still "the forum source is broken" as far as the banner cares.
  const sources: StatsSource[] = [
    'newsletter',
    'github',
    'analytics',
    'forum',
    'forum',
    'quranApps',
    'cms',
  ];
  // Sources are designed so that:
  //   - null  → not configured (env vars missing) — silent, surfaces in env banner
  //   - throw → configured but the call failed — captured here with the real error
  const errors: StatsBundle['errors'] = [];
  const values = settled.map((r, i) => {
    if (r.status === 'rejected') {
      errors.push({ source: sources[i], message: describeError(r.reason) });
      return null;
    }
    return r.value;
  });

  const [newsletter, github, analytics, forum, forumTiers, quranApps, cms] =
    values as [
      StatsBundle['newsletter'],
      StatsBundle['github'],
      StatsBundle['analytics'],
      StatsBundle['forum'],
      StatsBundle['forumTiers'],
      StatsBundle['quranApps'],
      StatsBundle['cms'],
    ];

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      days,
    },
    newsletter,
    github,
    analytics,
    forum,
    forumTiers,
    quranApps,
    cms,
    errors,
    generatedAt: new Date().toISOString(),
  };
}
