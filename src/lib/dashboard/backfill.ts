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
    // Engagement breakdown — five per-day counts from Flarum:
    //   discussions     ← discussions.created_at        (new threads)
    //   replies         ← posts.created_at − discussions (real replies)
    //   likes           ← post_likes.created_at         (if extension installed)
    //   new_users       ← users.joined_at               (signups)
    //   active_users    ← users.last_seen_at            (DAU)
    //
    // Note: SUM(active_users) across a multi-day window is total
    // user-days, not distinct WAU/MAU — Flarum's `last_seen_at` is a
    // single timestamp per user, so we can't reconstruct distinct
    // weekly-actives from daily snapshots. The headline `value` rolls
    // up only event counts (discussions + replies + likes) so the
    // hero number stays meaningful when aggregated.
    type Row = { day: string | Date; cnt: number | string };
    // Snap to 00:00:00 of the earliest emitted day so the SQL window
    // matches the bucket loop exactly.
    const startDate = `${isoDaysAgoExact(days - 1)} 00:00:00`;

    // post_likes may not exist on every Flarum install (the Likes
    // extension is optional). Swallow the query error and treat each
    // day's likes as 0 — the rest of the breakdown still lands.
    const safeLikes = conn
      .query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
         FROM post_likes
         WHERE created_at >= ?
         GROUP BY DATE(created_at)`,
        [startDate],
      )
      .catch(() => [[]] as [Row[]]);

    const [posts, discussions, likes, joined, active] = (await Promise.all([
      conn.query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
         FROM posts
         WHERE created_at >= ?
         GROUP BY DATE(created_at)`,
        [startDate],
      ),
      conn.query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
         FROM discussions
         WHERE created_at >= ?
         GROUP BY DATE(created_at)`,
        [startDate],
      ),
      safeLikes,
      conn.query(
        `SELECT DATE(joined_at) AS day, COUNT(*) AS cnt
         FROM users
         WHERE joined_at >= ?
         GROUP BY DATE(joined_at)`,
        [startDate],
      ),
      conn.query(
        `SELECT DATE(last_seen_at) AS day, COUNT(DISTINCT id) AS cnt
         FROM users
         WHERE last_seen_at >= ?
         GROUP BY DATE(last_seen_at)`,
        [startDate],
      ),
    ])) as unknown as [[Row[]], [Row[]], [Row[]], [Row[]], [Row[]]];

    type DayAgg = {
      discussions: number;
      replies: number; // posts − discussions for that same day
      likes: number;
      new_users: number;
      active_users: number;
      _rawPosts: number;
    };
    const byDay = new Map<string, DayAgg>();
    const ensure = (day: string): DayAgg => {
      let cur = byDay.get(day);
      if (!cur) {
        cur = {
          discussions: 0,
          replies: 0,
          likes: 0,
          new_users: 0,
          active_users: 0,
          _rawPosts: 0,
        };
        byDay.set(day, cur);
      }
      return cur;
    };
    for (const r of posts[0]) ensure(normalizeDay(r.day))._rawPosts += Number(r.cnt);
    for (const r of discussions[0]) ensure(normalizeDay(r.day)).discussions += Number(r.cnt);
    for (const r of likes[0]) ensure(normalizeDay(r.day)).likes += Number(r.cnt);
    for (const r of joined[0]) ensure(normalizeDay(r.day)).new_users += Number(r.cnt);
    for (const r of active[0]) ensure(normalizeDay(r.day)).active_users += Number(r.cnt);

    // Replies = total posts on day − first-posts (one per new
    // discussion). Clamp at 0 against any tz drift between the two
    // tables.
    for (const agg of byDay.values()) {
      agg.replies = Math.max(0, agg._rawPosts - agg.discussions);
    }

    return Array.from(byDay, ([day, agg]) => ({
      day,
      metric_key: 'engagement' as const,
      value: agg.discussions + agg.replies + agg.likes,
      meta: {
        discussions: agg.discussions,
        replies: agg.replies,
        likes: agg.likes,
        new_users: agg.new_users,
        active_users: agg.active_users,
      },
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
  const { data, error } = await supabase
    .from('dashboard_social_snapshots')
    .select('channel, snapshot_date, impressions, page_views, followers_total')
    .order('snapshot_date', { ascending: true });
  if (error) throw new Error(`social_reach query failed: ${error.message}`);
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
  const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
  const n = await getNewsletter();
  if (!n) return [];

  // Email opens decay: ~50% same day, then a fast fall-off over the
  // next week, with a thin 7-day tail. MailerLite's API gives us only
  // TOTAL opens per campaign (no per-day breakdown), so we redistribute
  // that total using a 14-day industry-typical curve. The sum stays
  // equal to MailerLite's reported total; only the daily allocation is
  // modelled. Indices = days since send (0 = send day).
  const OPENS_DECAY = [
    0.50, 0.25, 0.12, 0.05, 0.03, 0.02, 0.012,
    0.008, 0.005, 0.003, 0.002, 0.001, 0.0005, 0.0005,
  ];

  const windowStart = new Date(Date.now() - (days - 1) * 86_400_000);
  windowStart.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type Agg = {
    sent: number;
    sendCampaigns: number;
    rateSum: number;
    opensDecayed: number;
  };
  const byDay = new Map<string, Agg>();
  const add = (k: string, patch: Partial<Agg>) => {
    const cur = byDay.get(k) ?? { sent: 0, sendCampaigns: 0, rateSum: 0, opensDecayed: 0 };
    cur.sent += patch.sent ?? 0;
    cur.sendCampaigns += patch.sendCampaigns ?? 0;
    cur.rateSum += patch.rateSum ?? 0;
    cur.opensDecayed += patch.opensDecayed ?? 0;
    byDay.set(k, cur);
  };

  // Sort campaigns oldest → newest so the "latest campaign rate" walk
  // below sees them in chronological order.
  const sorted = [...n.recentCampaigns]
    .filter((c) => !!c.sentAt)
    .sort((a, b) => (a.sentAt! < b.sentAt! ? -1 : 1));

  for (const c of sorted) {
    const sendDate = new Date(c.sentAt!);
    sendDate.setHours(0, 0, 0, 0);

    // Total opens — use API count if present, else derive from
    // sent × rate (MailerLite list endpoint often omits the count).
    const totalOpens =
      c.opens > 0 ? c.opens : Math.round((c.sent * c.openRate) / 100);

    // Distribute totalOpens across OPENS_DECAY.length days starting
    // from sendDate. Only rows whose event-day falls inside our
    // window get written.
    for (let offset = 0; offset < OPENS_DECAY.length; offset++) {
      const eventDate = new Date(sendDate);
      eventDate.setDate(sendDate.getDate() + offset);
      if (eventDate < windowStart || eventDate > today) continue;
      const key = eventDate.toISOString().slice(0, 10);
      const opensThisDay = Math.round(totalOpens * OPENS_DECAY[offset]);
      add(key, { opensDecayed: opensThisDay });

      // Send day carries the campaign's metadata (sent + rate).
      if (offset === 0) {
        add(key, { sent: c.sent, sendCampaigns: 1, rateSum: c.openRate });
      }
    }
  }

  // Walk days oldest → newest and propagate the most recent non-zero
  // campaign rate forward. So the "open rate" column on a non-send
  // day reflects the latest active campaign's performance, instead
  // of falsely reading as 0%.
  const dayKeys = Array.from(byDay.keys()).sort();
  let lastActiveRate = 0;
  const dailyRate = new Map<string, number>();
  for (const k of dayKeys) {
    const agg = byDay.get(k)!;
    if (agg.sendCampaigns > 0) {
      const r = agg.rateSum / agg.sendCampaigns;
      if (r > 0) lastActiveRate = r;
    }
    dailyRate.set(k, lastActiveRate);
  }

  return Array.from(byDay, ([day, agg]) => ({
    day,
    metric_key: 'newsletter' as const,
    value: agg.sent,
    meta: {
      rate: Math.round((dailyRate.get(day) ?? 0) * 10) / 10,
      opened: agg.opensDecayed,
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
    // Snap to 00:00:00 of the earliest emitted day so the per-day
    // delta + baseline split lines up with the bucket boundaries —
    // see the matching comment in backfillForum().
    const startDate = `${isoDaysAgoExact(days - 1)} 00:00:00`;
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

function isoDaysAgoExact(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
function normalizeDay(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}
