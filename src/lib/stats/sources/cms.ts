// CMS (cms.itqan.dev) source — direct Postgres.
//
// cms-backend is a Django app. Tables follow Django convention
// `<app>_<model>`:
//   - publishers_publisher       — organizations that publish
//   - publishers_publishermember — user↔publisher membership
//   - publishers_domain          — domains owned per publisher
//   - users_user                 — public CMS users (the "beneficiaries")
//   - users_developer            — developer profiles (subset of users)
//   - content_asset              — published assets (recitations, etc.)
//
// BaseModel gives us `created_at` / `updated_at` on every row. The
// User model also has Django's built-in `is_active` flag (from
// AbstractUser).
//
// IMPORTANT: actual *consumption* of materials is tracked via Mixpanel
// (apps/usage_tracking/services/mixpanel_client.py), not in this DB.
// We surface content VOLUME here as a best-effort proxy and the
// verification table flags this clearly.

import { STATS_ENV } from '../env';
import type { CmsMetrics } from '../types';

const NEW_WINDOW_DAYS = 30;

export async function getCms(): Promise<CmsMetrics | null> {
  if (!STATS_ENV.CMS_DB_URL) return null;

  type Pg = typeof import('pg');
  let pg: Pg;
  try {
    pg = (await import('pg')) as Pg;
  } catch (err) {
    console.warn('[stats:cms] pg import failed:', describeError(err));
    return null;
  }

  const client = new pg.Client({
    connectionString: STATS_ENV.CMS_DB_URL,
    statement_timeout: 10_000,
    query_timeout: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const since = new Date(Date.now() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();

    const [
      totalPublishers,
      verifiedPublishers,
      newPublishers30d,
      totalPublisherMembers,
      totalUsers,
      newUsers30d,
      totalDevelopers,
      totalAssets,
      readyAssets,
      categoryRows,
    ] = await Promise.all([
      count(client, 'SELECT COUNT(*)::int AS c FROM publishers_publisher'),
      count(client, 'SELECT COUNT(*)::int AS c FROM publishers_publisher WHERE is_verified = TRUE'),
      count(client, 'SELECT COUNT(*)::int AS c FROM publishers_publisher WHERE created_at >= $1', [sinceIso]),
      count(client, 'SELECT COUNT(*)::int AS c FROM publishers_publishermember'),
      count(client, 'SELECT COUNT(*)::int AS c FROM users_user WHERE is_active = TRUE'),
      count(client, 'SELECT COUNT(*)::int AS c FROM users_user WHERE created_at >= $1', [sinceIso]),
      count(client, 'SELECT COUNT(*)::int AS c FROM users_developer'),
      count(client, 'SELECT COUNT(*)::int AS c FROM content_asset'),
      count(client, "SELECT COUNT(*)::int AS c FROM content_asset WHERE status = 'ready'"),
      client.query<{ category: string; c: string | number }>(
        'SELECT category, COUNT(*)::int AS c FROM content_asset GROUP BY category ORDER BY c DESC',
      ),
    ]);

    return {
      totalPublishers,
      verifiedPublishers,
      newPublishers30d,
      totalPublisherMembers,
      totalUsers,
      newUsers30d,
      totalDevelopers,
      totalAssets,
      readyAssets,
      totalAssetsByCategory: categoryRows.rows.map((r) => ({
        category: r.category ?? 'uncategorized',
        count: Number(r.c) || 0,
      })),
    };
  } catch (err) {
    console.warn('[stats:cms] fetch failed:', describeError(err));
    return null;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function count(
  client: import('pg').Client,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const res = await client.query<{ c: number | string }>(sql, params);
  return Number(res.rows[0]?.c ?? 0) || 0;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
