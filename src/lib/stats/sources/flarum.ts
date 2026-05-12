// Flarum (forum) source — direct MySQL queries.
//
// Itqan's Flarum runs on its own MySQL DB. We connect using a single
// connection (no pool), run a handful of COUNT queries, and close.
// On Vercel serverless this is the right shape: pools accumulate
// connections per cold-start instance and exhaust the DB.
//
// Schema is standard Flarum: `users`, `discussions`, `posts`,
// `post_likes`. The stats project's forum collector demonstrates the
// exact column names we rely on (`joined_at`, `last_seen_at`,
// `created_at`, `discussion_id`, ...). We mirror those.

import { STATS_ENV } from '../env';
import type { DateRange, ForumMetrics } from '../types';
import { describeError } from '../util';

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function getForum(opts: {
  range: DateRange;
}): Promise<ForumMetrics | null> {
  if (!STATS_ENV.FLARUM_DB_URL) return null;

  type Mysql = typeof import('mysql2/promise');
  let mysql: Mysql;
  try {
    mysql = (await import('mysql2/promise')) as Mysql;
  } catch (err) {
    console.warn('[stats:forum] mysql2 import failed:', describeError(err));
    return null;
  }

  let conn: Awaited<ReturnType<Mysql['createConnection']>> | null = null;
  try {
    conn = await mysql.createConnection({
      uri: STATS_ENV.FLARUM_DB_URL,
      connectTimeout: 10_000,
      // Disable infile to harden against malicious server hints.
      // mysql2 default is already false, but be explicit.
    });

    const startStr = fmtDate(opts.range.start);
    const endStr = fmtDate(opts.range.end);

    const num = async (sql: string, params: string[]): Promise<number> => {
      const [rows] = await conn!.execute(sql, params);
      const first = (rows as Array<{ c: number | bigint | string }>)[0];
      const raw = first?.c ?? 0;
      return typeof raw === 'bigint' ? Number(raw) : Number(raw) || 0;
    };

    const numOrZero = async (sql: string, params: string[]): Promise<number> => {
      try {
        return await num(sql, params);
      } catch {
        // Some Flarum installs don't have post_likes — degrade silently.
        return 0;
      }
    };

    const [
      totalUsers,
      newUsers,
      activeUsers,
      totalDiscussions,
      newDiscussions,
      totalPosts,
      newPosts,
      totalLikes,
      newLikes,
    ] = await Promise.all([
      num('SELECT COUNT(*) AS c FROM users', []),
      num('SELECT COUNT(*) AS c FROM users WHERE joined_at >= ? AND joined_at <= ?', [startStr, endStr]),
      num('SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= ? AND last_seen_at <= ?', [startStr, endStr]),
      num('SELECT COUNT(*) AS c FROM discussions', []),
      num('SELECT COUNT(*) AS c FROM discussions WHERE created_at >= ? AND created_at <= ?', [startStr, endStr]),
      num('SELECT COUNT(*) AS c FROM posts', []),
      num('SELECT COUNT(*) AS c FROM posts WHERE created_at >= ? AND created_at <= ?', [startStr, endStr]),
      numOrZero('SELECT COUNT(*) AS c FROM post_likes', []),
      numOrZero('SELECT COUNT(*) AS c FROM post_likes WHERE created_at >= ? AND created_at <= ?', [startStr, endStr]),
    ]);

    return {
      totalUsers,
      totalDiscussions,
      totalPosts,
      totalLikes,
      newUsers,
      newDiscussions,
      newPosts,
      newLikes,
      activeUsers,
      avgPostsPerDiscussion:
        totalDiscussions > 0 ? totalPosts / totalDiscussions : 0,
    };
  } catch (err) {
    console.warn('[stats:forum] fetch failed:', describeError(err));
    throw err;
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch {
        // ignore — already closed / network gone
      }
    }
  }
}
