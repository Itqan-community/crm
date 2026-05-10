// Google Analytics 4 source — itqan.dev pageviews / visitors / sessions.
//
// Authentication: OAuth2 refresh-token flow, same shape as stats's
// analytics collector. The Itqan GA4 property IDs are well-known
// (they ride on every page in the GA tracking snippet) so we hardcode
// them here — same approach stats takes in
// src/app/api/setup/ga-properties/route.ts (the DEFAULT_PROPERTIES
// constant). Avoids forcing every deploy to set a numeric env var.
//
// `stat_app_GA_PROPERTY_ID` still works as an override if you want to
// point this at a different property without code changes.
//
// We compare current-window vs previous-window so the table can show
// a delta. GA Data API supports two `dateRanges` in one call.

import { STATS_ENV } from '../env';
import type { AnalyticsMetrics, ChangeMetric, DateRange } from '../types';

// GA4 property IDs for the Itqan estate. These are public values
// (visible in any of these sites' tracking snippets) — not secrets.
// Mirrors stats's DEFAULT_PROPERTIES list.
const ITQAN_GA_PROPERTIES = {
  itqanLanding: '481677039', // itqan.dev — the user-asked KPI
  cms: '518600697', // cms.itqan.dev
  community: '518403346', // community.itqan.dev (Flarum forum)
  quranApps: '481625748', // quran-apps.itqan.dev
} as const;

function resolvePropertyId(): string {
  return STATS_ENV.GA_PROPERTY_ID || ITQAN_GA_PROPERTIES.itqanLanding;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function previousWindow(range: DateRange): DateRange {
  const days = Math.max(
    1,
    Math.round(
      (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const end = new Date(range.start.getTime() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getAnalytics(opts: {
  range: DateRange;
}): Promise<AnalyticsMetrics | null> {
  if (
    !STATS_ENV.GA_OAUTH_CLIENT_ID ||
    !STATS_ENV.GA_OAUTH_CLIENT_SECRET ||
    !STATS_ENV.GA_OAUTH_REFRESH_TOKEN
  ) {
    return null;
  }

  // Lazy-load googleapis so unconfigured environments don't pay the
  // import cost on cold start.
  type GoogleApis = typeof import('googleapis');
  let google: GoogleApis['google'];
  try {
    ({ google } = (await import('googleapis')) as GoogleApis);
  } catch (err) {
    console.warn('[stats:analytics] googleapis import failed:', describeError(err));
    return null;
  }

  try {
    const oauth2 = new google.auth.OAuth2(
      STATS_ENV.GA_OAUTH_CLIENT_ID,
      STATS_ENV.GA_OAUTH_CLIENT_SECRET,
    );
    oauth2.setCredentials({ refresh_token: STATS_ENV.GA_OAUTH_REFRESH_TOKEN });

    const data = google.analyticsdata({ version: 'v1beta', auth: oauth2 });
    const property = `properties/${resolvePropertyId()}`;

    const cur = { startDate: isoDay(opts.range.start), endDate: isoDay(opts.range.end) };
    const prev = previousWindow(opts.range);
    const prevDr = { startDate: isoDay(prev.start), endDate: isoDay(prev.end) };

    const [coreResp, pagesResp, countriesResp] = await Promise.all([
      data.properties.runReport({
        property,
        requestBody: {
          dateRanges: [cur, prevDr],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'newUsers' },
          ],
        },
      }),
      data.properties.runReport({
        property,
        requestBody: {
          dateRanges: [cur],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: '10',
        },
      }),
      data.properties.runReport({
        property,
        requestBody: {
          dateRanges: [cur],
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: '10',
        },
      }),
    ]);

    const coreRows = coreResp.data.rows ?? [];
    const curRow = coreRows.find((r) => r.dimensionValues === undefined || r.dimensionValues.length === 0)
      ?? coreRows[0];
    const prevRow = coreRows[1];

    const num = (row: typeof coreRows[number] | undefined, idx: number) =>
      Number(row?.metricValues?.[idx]?.value ?? '0') || 0;

    const cm = (idx: number): ChangeMetric => ({
      value: num(curRow, idx),
      prev: prevRow ? num(prevRow, idx) : null,
    });

    return {
      pageviews: cm(0),
      activeUsers: cm(1),
      sessions: cm(2),
      bounceRate: num(curRow, 3) * 100,
      avgSessionSeconds: num(curRow, 4),
      newUsers: num(curRow, 5),
      topPages: (pagesResp.data.rows ?? []).map((r) => ({
        path: r.dimensionValues?.[0]?.value ?? '',
        views: Number(r.metricValues?.[0]?.value ?? '0') || 0,
      })),
      topCountries: (countriesResp.data.rows ?? []).map((r) => ({
        country: r.dimensionValues?.[0]?.value ?? '',
        visitors: Number(r.metricValues?.[0]?.value ?? '0') || 0,
      })),
    };
  } catch (err) {
    console.warn('[stats:analytics] fetch failed:', describeError(err));
    throw err;
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
