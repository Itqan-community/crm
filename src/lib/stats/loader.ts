// Top-level composition. One call → all sources fetched in parallel,
// failures isolated, return a typed bundle for the verification table.
//
// Caching note: each source already declares a 5-minute revalidation
// for HTTP fetches via Next's `next: { revalidate, tags }`. DB sources
// re-query on every page load — that's fine for an admin dashboard
// (low traffic, the COUNTs are cheap). When traffic grows we'll wrap
// the loader in `unstable_cache` with the same 5-minute TTL.

import { sourceConfigured, type StatsSource } from './env';
import { getNewsletter } from './sources/mailerlite';
import { getGithub } from './sources/github';
import { getAnalytics } from './sources/analytics';
import { getForum } from './sources/flarum';
import { getQuranApps } from './sources/quran_apps';
import { getCms } from './sources/cms';
import type { DateRange, StatsBundle } from './types';

const DEFAULT_WINDOW_DAYS = 7;

export type LoadOptions = {
  // Number of trailing days to use for window-bound metrics
  // (forum new-X, GitHub commits/PRs, GA pageviews). Default: 7.
  windowDays?: number;
};

function makeRange(days: number): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { start, end };
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
    getQuranApps(),
    getCms(),
  ]);

  const sources: StatsSource[] = [
    'newsletter',
    'github',
    'analytics',
    'forum',
    'quranApps',
    'cms',
  ];
  const errors: StatsBundle['errors'] = [];
  const values = settled.map((r, i) => {
    if (r.status === 'rejected') {
      errors.push({ source: sources[i], message: describeError(r.reason) });
      return null;
    }
    // A null result from a configured source means the source threw and
    // returned null silently. Surface that as an error too — but only
    // when configured, so unconfigured sources don't pollute the banner.
    if (r.value === null && sourceConfigured(sources[i])) {
      errors.push({
        source: sources[i],
        message: 'returned null (check server logs)',
      });
    }
    return r.value;
  });

  const [newsletter, github, analytics, forum, quranApps, cms] = values as [
    StatsBundle['newsletter'],
    StatsBundle['github'],
    StatsBundle['analytics'],
    StatsBundle['forum'],
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
    quranApps,
    cms,
    errors,
    generatedAt: new Date().toISOString(),
  };
}
