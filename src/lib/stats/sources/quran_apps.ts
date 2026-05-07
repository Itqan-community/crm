// Quran Apps Directory source — direct Postgres.
//
// Schema (from Itqan-community/quran-apps-directory backend):
//   apps             — main app rows; status: 'published' | 'draft' | ...
//   developers       — publisher orgs
//   apps_categories  — junction
//
// We deliberately keep queries shallow (COUNT + a few aggregates) so
// the verification table loads in <500ms even on a cold connection.

import { STATS_ENV } from '../env';
import type { QuranAppsMetrics } from '../types';

export async function getQuranApps(): Promise<QuranAppsMetrics | null> {
  if (!STATS_ENV.QURAN_APPS_DB_URL) return null;

  type Pg = typeof import('pg');
  let pg: Pg;
  try {
    pg = (await import('pg')) as Pg;
  } catch (err) {
    console.warn('[stats:quranApps] pg import failed:', describeError(err));
    return null;
  }

  const client = new pg.Client({
    connectionString: STATS_ENV.QURAN_APPS_DB_URL,
    statement_timeout: 10_000,
    query_timeout: 10_000,
    connectionTimeoutMillis: 10_000,
    // Most managed Postgres providers (Supabase, Neon, Railway) require TLS.
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const [
      totalApps,
      publishedApps,
      featuredApps,
      totalDevelopers,
      viewsAggregate,
    ] = await Promise.all([
      countQuery(client, 'SELECT COUNT(*)::int AS c FROM apps'),
      countQuery(client, "SELECT COUNT(*)::int AS c FROM apps WHERE status = 'published'"),
      countQuery(client, 'SELECT COUNT(*)::int AS c FROM apps WHERE featured = TRUE'),
      countQuery(client, 'SELECT COUNT(*)::int AS c FROM developers'),
      client.query<{
        total_views: string | number | null;
        total_reviews: string | number | null;
        avg_rating: string | number | null;
      }>(
        'SELECT COALESCE(SUM(view_count), 0)::bigint AS total_views, COALESCE(SUM(review_count), 0)::bigint AS total_reviews, COALESCE(AVG(NULLIF(avg_rating, 0)), 0)::float AS avg_rating FROM apps',
      ),
    ]);

    const agg = viewsAggregate.rows[0];

    return {
      totalApps,
      publishedApps,
      featuredApps,
      totalDevelopers,
      totalViews: toNumber(agg?.total_views),
      totalReviews: toNumber(agg?.total_reviews),
      avgRating: Number(agg?.avg_rating ?? 0) || 0,
    };
  } catch (err) {
    console.warn('[stats:quranApps] fetch failed:', describeError(err));
    return null;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

async function countQuery(
  client: import('pg').Client,
  sql: string,
): Promise<number> {
  const res = await client.query<{ c: number | string }>(sql);
  return Number(res.rows[0]?.c ?? 0) || 0;
}

function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
