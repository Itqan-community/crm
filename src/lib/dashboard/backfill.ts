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
  ]);
  const labels = ['forum', 'cms', 'social_reach'] as const;

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

    const byDay = new Map<string, number>();
    for (const r of [...posts, ...discussions]) {
      const day = normalizeDay(r.day);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(r.cnt));
    }

    return Array.from(byDay, ([day, value]) => ({
      day,
      metric_key: 'engagement' as const,
      value,
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
    // For each day in the window, the values are cumulative counts of
    // rows whose created_at falls on or before that day. A single
    // CTE-based query handles all three metrics — much cheaper than
    // 30 round-trips.
    const { rows } = await client.query<{
      day: string;
      publishers: string;
      beneficiaries: string;
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
         (SELECT COUNT(*) FROM users_user        WHERE created_at <= d.day + interval '1 day')::text AS beneficiaries,
         (SELECT COUNT(*) FROM content_asset     WHERE created_at <= d.day + interval '1 day')::text AS consumption
       FROM day_series d
       ORDER BY d.day`,
      [days],
    );

    const out: DailyRow[] = [];
    for (const r of rows) {
      out.push({ day: r.day, metric_key: 'publishers',    value: Number(r.publishers) });
      out.push({ day: r.day, metric_key: 'beneficiaries', value: Number(r.beneficiaries) });
      out.push({ day: r.day, metric_key: 'consumption',   value: Number(r.consumption) });
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
