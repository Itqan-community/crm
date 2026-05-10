// Google Analytics 4 source — itqan.dev pageviews / visitors / sessions.
//
// Authentication: OAuth2 refresh-token flow, same shape as stats's
// analytics collector. Property IDs come from env (one per site)
// rather than being hardcoded — the four GA_PROPERTY_ID_* vars in
// Vercel mirror what stats stores in its AnalyticsProperty table.
//
// This source currently reports on itqan.dev only (the
// user-requested "زيارات itqan.dev" KPI). The other three property
// ids are read from env but unused — kept available so a follow-up
// can expose per-site breakdowns without touching env config.
//
// We compare current-window vs previous-window so the table can show
// a delta. GA Data API supports two `dateRanges` in one call.

import { STATS_ENV } from '../env';
import type { AnalyticsMetrics, ChangeMetric, DateRange } from '../types';

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
    !STATS_ENV.GA_OAUTH_REFRESH_TOKEN ||
    !STATS_ENV.GA_PROPERTY_ID_itqan_dev
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
    const property = `properties/${STATS_ENV.GA_PROPERTY_ID_itqan_dev}`;

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
