// One-time / on-demand backfill for dashboard_metric_daily. Queries
// the same source databases the stats infrastructure connects to
// (Flarum MySQL, CMS Postgres, Supabase for social snapshots) but
// asks each one for per-day aggregates instead of a single-window
// total. Returns the row count written.
//
// Sources we don't backfill yet (need separate work):
//   - GA (site_visits): the GA4 Data API supports a date dimension
//     so a single call would do; needs the OAuth refresh-token path.
//     Captured going-forward by the daily cron.
//   - MailerLite (newsletter): campaigns come with sent_at, so a
//     daily aggregate is straightforward — TODO once we have an API
//     key in env.
//   - GitHub: only relevant for the platform's contribution rhythm,
//     not directly a dashboard KPI.

import { STATS_ENV } from '@/lib/stats/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { describeError } from '@/lib/stats/util';
import { type DailyRow, writeDailyRows } from './daily';

const DEFAULT_DAYS = 30;

export async function backfillDailyMetrics(opts: { days?: number } = {}): Promise<{
  days: number;
  written: number;
  perSource: Record<string, number | string>;
}> {
  const days = Math.max(1, Math.min(365, opts.days ?? DEFAULT_DAYS));
  const perSource: Record<string, number | string> = {};

  const settled = await Promise.allSettled([
    backfillForum(days),
    backfillCms(days),
    backfillSocialReach(days),
    backfillNewsletter(days),
    backfillAnalytics(days),
    backfillShares(days),
  ]);
  const labels = [
    'forum',
    'cms',
    'social_reach',
    'newsletter',
    'analytics',
    'shares',
  ] as const;

  const allRows: DailyRow[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      perSource[labels[i]] = r.value.length;
      allRows.push(...r.value);
    } else {
      perSource[labels[i]] = `error: ${describeError(r.reason)}`;
    }
  }

  // Single bulk upsert. The (day, metric_key) primary key means
  // re-running the backfill is idempotent — values get refreshed,
  // no duplicate rows.
  const { written } = await writeDailyRows(allRows);
  return { days, written, perSource };
}

// ---- Forum (engagement) -----------------------------------------------------

async function backfillForum(days: number): Promise<DailyRow[]> {
  if (!STATS_ENV.FLARUM_DB_URL) return [];

  type Mysql = typeof import('mysql2/promise');
  const mysql = (await import('mysql2/promise')) as Mysql;
  const conn = await mysql.createConnection({
    uri: STATS_ENV.FLARUM_DB_URL,
    connectTimeout: 10_000,
  });

  try {
    // Engagement = posts + discussions per day. Flarum has a separate
    // table for each. We aggregate in JS rather than UNION-ing in SQL
    // so the query plan stays simple on either side.
    // mysql2's strict types insist on RowDataPacket — cast loosely
    // since we only consume two columns and don't need IDE hints.
    type Row = { day: string | Date; cnt: number | string };
    const startDate = isoDaysAgo(days);
    const [posts] = (await conn.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
       FROM posts
       WHERE created_at >= ?
       GROUP BY DATE(created_at)`,
      [startDate],
    )) as unknown as [Row[]];
    const [discussions] = (await conn.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
       FROM discussions
       WHERE created_at >= ?
       GROUP BY DATE(created_at)`,
      [startDate],
    )) as unknown as [Row[]];

    // Track posts and discussions separately so we can populate the
    // breakdown meta — "ردود ومناقشات" combines both. Likes /
    // mentions / shares aren't tracked yet, so they sit at 0.
    const byDay = new Map<string, { value: number; replies: number }>();
    const addToDay = (day: string, n: number) => {
      const cur = byDay.get(day) ?? { value: 0, replies: 0 };
      cur.value += n;
      cur.replies += n;
      byDay.set(day, cur);
    };
    for (const r of posts) addToDay(normalizeDay(r.day), Number(r.cnt));
    for (const r of discussions) addToDay(normalizeDay(r.day), Number(r.cnt));

    return Array.from(byDay, ([day, agg]) => ({
      day,
      metric_key: 'engagement' as const,
      value: agg.value,
      meta: { replies: agg.replies, likes: 0, mentions: 0, shares: 0 },
    }));
  } finally {
    await conn.end().catch(() => {});
  }
}

// ---- CMS (publishers / beneficiaries / consumption) -------------------------

async function backfillCms(days: number): Promise<DailyRow[]> {
  if (!STATS_ENV.CMS_DB_URL) return [];

  type Pg = typeof import('pg');
  const pg = (await import('pg')) as Pg;
  // CMS prod requires TLS — mirror the existing source module's
  // approach to avoid the "no pg_hba.conf entry" error.
  const client = new pg.Client({
    connectionString: STATS_ENV.CMS_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();

  try {
    // For each day in the window:
    //   value      = cumulative count of rows where created_at ≤ day
    //   new_30d    = count of rows created in the 30 days ending on day
    // One CTE-based query handles all three metrics for all N days —
    // much cheaper than 30 × 3 round-trips.
    const { rows } = await client.query<{
      day: string;
      publishers: string;
      publishers_new30: string;
      beneficiaries: string;
      beneficiaries_new30: string;
      consumption: string;
    }>(
      `WITH day_series AS (
         SELECT generate_series(
           (CURRENT_DATE - ($1::int - 1))::date,
           CURRENT_DATE,
           '1 day'::interval
         )::date AS day
       )
       SELECT
         to_char(d.day, 'YYYY-MM-DD') AS day,
         (SELECT COUNT(*) FROM publishers_publisher WHERE created_at <= d.day + interval '1 day')::text AS publishers,
         (SELECT COUNT(*) FROM publishers_publisher WHERE created_at >  d.day - interval '29 days' AND created_at <= d.day + interval '1 day')::text AS publishers_new30,
         (SELECT COUNT(*) FROM users_user           WHERE created_at <= d.day + interval '1 day')::text AS beneficiaries,
         (SELECT COUNT(*) FROM users_user           WHERE created_at >  d.day - interval '29 days' AND created_at <= d.day + interval '1 day')::text AS beneficiaries_new30,
         (SELECT COUNT(*) FROM content_asset        WHERE created_at <= d.day + interval '1 day')::text AS consumption
       FROM day_series d
       ORDER BY d.day`,
      [days],
    );

    const out: DailyRow[] = [];
    for (const r of rows) {
      out.push({
        day: r.day,
        metric_key: 'publishers',
        value: Number(r.publishers),
        meta: { new_30d: Number(r.publishers_new30) },
      });
      out.push({
        day: r.day,
        metric_key: 'beneficiaries',
        value: Number(r.beneficiaries),
        meta: { new_30d: Number(r.beneficiaries_new30) },
      });
      out.push({
        day: r.day,
        metric_key: 'consumption',
        value: Number(r.consumption),
      });
    }
    return out;
  } finally {
    await client.end().catch(() => {});
  }
}

// ---- Social reach (from manual snapshots) -----------------------------------

async function backfillSocialReach(days: number): Promise<DailyRow[]> {
  // We only have weekly manual snapshots, not daily reach. For each
  // day in the window we pick the most recent snapshot (per channel)
  // that's ≤ that day, sum their headline metric (impressions or
  // page_views or followers_total), and write that as the day's
  // value. This produces a step function — the reach line flattens
  // between weekly entries and jumps when a new snapshot lands.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('dashboard_social_snapshots')
    .select('channel, snapshot_date, impressions, page_views, followers_total')
    .order('snapshot_date', { ascending: true });
  if (!data || data.length === 0) return [];

  const out: DailyRow[] = [];
  for (let i = 0; i < days; i++) {
    const day = isoDaysAgoExact(days - 1 - i);
    const byChannel = new Map<string, { v: number; date: string }>();
    for (const row of data) {
      if (row.snapshot_date > day) continue;
      const v =
        row.impressions ?? row.page_views ?? row.followers_total ?? 0;
      const prior = byChannel.get(row.channel);
      if (!prior || row.snapshot_date > prior.date) {
        byChannel.set(row.channel, { v, date: row.snapshot_date });
      }
    }
    if (byChannel.size === 0) continue;
    const total = Array.from(byChannel.values()).reduce((s, c) => s + c.v, 0);
    out.push({ day, metric_key: 'social_reach', value: total });
  }
  return out;
}

// ---- Newsletter (MailerLite) -----------------------------------------------

async function backfillNewsletter(days: number): Promise<DailyRow[]> {
  if (!STATS_ENV.MAILERLITE_API_KEY) return [];
  // Lift the existing single-window source — it already returns
  // recentCampaigns ordered newest-first. Each campaign has its own
  // sent_at; we bucket those into per-day rows. Days with no send
  // get NO row (gap in the line), since "0 sent" would lie when the
  // truth is "no campaign that day".
  const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
  const n = await getNewsletter();
  if (!n) return [];

  const cutoff = new Date(Date.now() - days * 86_400_000);
  const byDay = new Map<
    string,
    { sent: number; opens: number; rateSum: number; campaigns: number }
  >();
  for (const c of n.recentCampaigns) {
    if (!c.sentAt) continue;
    const sent = new Date(c.sentAt);
    if (sent < cutoff) continue;
    const k = c.sentAt.slice(0, 10);
    const agg = byDay.get(k) ?? { sent: 0, opens: 0, rateSum: 0, campaigns: 0 };
    agg.sent += c.sent;
    agg.opens += c.opens;
    agg.rateSum += c.openRate;
    agg.campaigns += 1;
    byDay.set(k, agg);
  }

  return Array.from(byDay, ([day, agg]) => ({
    day,
    metric_key: 'newsletter' as const,
    value: agg.sent,
    meta: {
      rate: agg.campaigns > 0 ? Math.round((agg.rateSum / agg.campaigns) * 10) / 10 : 0,
      opened: agg.opens,
      // prevRate carries the rolling 7-day average from the live
      // newsletter object — same for every backfilled row, the ring
      // card uses it as the "compared to" baseline.
      prevRate: Math.round(n.last7Days.avgOpenRate * 10) / 10,
    },
  }));
}

// ---- Site visits (Google Analytics) ----------------------------------------

async function backfillAnalytics(days: number): Promise<DailyRow[]> {
  if (
    !STATS_ENV.GA_OAUTH_CLIENT_ID ||
    !STATS_ENV.GA_OAUTH_CLIENT_SECRET ||
    !STATS_ENV.GA_OAUTH_REFRESH_TOKEN ||
    !STATS_ENV.GA_PROPERTY_ID_itqan_dev
  ) {
    return [];
  }

  type GoogleApis = typeof import('googleapis');
  const { google } = (await import('googleapis')) as GoogleApis;
  const oauth2 = new google.auth.OAuth2(
    STATS_ENV.GA_OAUTH_CLIENT_ID,
    STATS_ENV.GA_OAUTH_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: STATS_ENV.GA_OAUTH_REFRESH_TOKEN });

  const data = google.analyticsdata({ version: 'v1beta', auth: oauth2 });
  const property = `properties/${STATS_ENV.GA_PROPERTY_ID_itqan_dev}`;
  // Single bulk request — `date` dimension expands the window into one
  // row per day. ~30 rows per metric, sub-second response from GA.
  const startDate = isoDaysAgoExact(days - 1);
  const endDate = isoDaysAgoExact(0);
  const resp = await data.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'newUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
  });

  const out: DailyRow[] = [];
  for (const row of resp.data.rows ?? []) {
    const ga = row.dimensionValues?.[0]?.value ?? ''; // YYYYMMDD
    if (!/^\d{8}$/.test(ga)) continue;
    const day = `${ga.slice(0, 4)}-${ga.slice(4, 6)}-${ga.slice(6, 8)}`;
    const m = row.metricValues ?? [];
    const pageviews = Number(m[0]?.value ?? 0);
    const activeUsers = Number(m[1]?.value ?? 0);
    const sessions = Number(m[2]?.value ?? 0);
    const newUsers = Number(m[3]?.value ?? 0);
    out.push({
      day,
      metric_key: 'site_visits',
      value: pageviews,
      meta: {
        uniq: activeUsers,
        returning: Math.max(0, sessions - newUsers),
      },
    });
  }
  return out;
}

// ---- Shares (forum post_likes cumulative) ----------------------------------

async function backfillShares(days: number): Promise<DailyRow[]> {
  if (!STATS_ENV.FLARUM_DB_URL) return [];

  type Mysql = typeof import('mysql2/promise');
  const mysql = (await import('mysql2/promise')) as Mysql;
  const conn = await mysql.createConnection({
    uri: STATS_ENV.FLARUM_DB_URL,
    connectTimeout: 10_000,
  });
  try {
    // post_likes has a `created_at` column (Flarum's likes extension).
    // For each day in the window, count likes whose created_at ≤ that
    // day — that's the cumulative "total community likes" we surface
    // as "مشاركات المجتمع".
    type Row = { day: string | Date; cnt: number | string };
    const startDate = isoDaysAgo(days);
    const [rows] = (await conn.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
       FROM post_likes
       WHERE created_at >= ?
       GROUP BY DATE(created_at)`,
      [startDate],
    )) as unknown as [Row[]];

    // Also fetch the baseline count BEFORE the window so we can build
    // cumulative totals correctly — without it the first day starts at
    // its own count rather than the running total.
    const [baseline] = (await conn.query(
      `SELECT COUNT(*) AS cnt FROM post_likes WHERE created_at < ?`,
      [startDate],
    )) as unknown as [Array<{ cnt: number | string }>];
    let running = Number(baseline[0]?.cnt ?? 0);

    // Build cumulative per day, filling gaps so every day in the window
    // emits a row.
    const dailyDelta = new Map<string, number>();
    for (const r of rows) dailyDelta.set(normalizeDay(r.day), Number(r.cnt));
    const out: DailyRow[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = isoDaysAgoExact(i);
      running += dailyDelta.get(day) ?? 0;
      out.push({ day, metric_key: 'shares', value: running });
    }
    return out;
  } finally {
    await conn.end().catch(() => {});
  }
}

// ---- Helpers ----------------------------------------------------------------

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}
function isoDaysAgoExact(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
function normalizeDay(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}
