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
import type { DateRange, ForumEngagementTiers, ForumMetrics } from '../types';
import { describeError, previousWindow } from '../util';

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
      newReplies: Math.max(0, newPosts - newDiscussions),
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

// ---- Engagement tiers (lurkers → power posters) -----------------------------

// Counts DISTINCT PEOPLE per activity depth in the window, which is a
// different question from the event counts getForum() returns: summing
// a daily "active users" count across a week gives user-days, not
// people. These have to be computed over the whole window at once.
//
// Two of the six are honest approximations, and the types say so:
//
//   browsers          `users.last_seen_at` holds only the MOST RECENT
//                     visit, so anyone who came back after the window
//                     closed is invisible here. Accurate for a window
//                     ending today, lossy for any older one.
//   returningReaders  Flarum keeps no login history, so there is no
//                     exact answer. `discussion_user.last_read_at` is
//                     one timestamp per (user, discussion) pair, which
//                     gives a user several datapoints across threads —
//                     enough for a proxy, but re-reading a thread
//                     overwrites its marker, so this undercounts.
//                     null when the query fails (older schema).
export async function getForumEngagementTiers(opts: {
  range: DateRange;
}): Promise<ForumEngagementTiers | null> {
  if (!STATS_ENV.FLARUM_DB_URL) return null;

  type Mysql = typeof import('mysql2/promise');
  let mysql: Mysql;
  try {
    mysql = (await import('mysql2/promise')) as Mysql;
  } catch (err) {
    console.warn('[stats:forum-tiers] mysql2 import failed:', describeError(err));
    return null;
  }

  let conn: Awaited<ReturnType<Mysql['createConnection']>> | null = null;
  try {
    conn = await mysql.createConnection({
      uri: STATS_ENV.FLARUM_DB_URL,
      connectTimeout: 10_000,
    });

    const start = fmtDate(opts.range.start);
    const end = fmtDate(opts.range.end);
    const prev = previousWindow(opts.range);
    const prevStart = fmtDate(prev.start);
    const prevEnd = fmtDate(prev.end);

    // `type = 'comment'` excludes Flarum's synthetic event posts
    // (discussionRenamed, discussionTagged, ...), which are rows in
    // `posts` but are not something a person wrote. Note getForum()
    // and backfill.ts deliberately do NOT filter this way — their
    // counts are raw post volume, so their numbers run slightly higher.
    const POSTERS = `
      SELECT user_id, COUNT(*) AS c
      FROM posts
      WHERE created_at >= ? AND created_at <= ?
        AND type = 'comment' AND hidden_at IS NULL AND user_id IS NOT NULL
      GROUP BY user_id`;

    const [tiersRows] = (await conn.execute(
      `SELECT COUNT(*) AS posted,
              COALESCE(SUM(c >= 3), 0)  AS posted3,
              COALESCE(SUM(c >= 10), 0) AS posted10
       FROM (${POSTERS}) t`,
      [start, end],
    )) as unknown as [Array<Record<string, number | string | null>>];

    const [browserRows] = (await conn.execute(
      'SELECT COUNT(*) AS c FROM users WHERE last_seen_at >= ? AND last_seen_at <= ?',
      [start, end],
    )) as unknown as [Array<{ c: number | string }>];

    // UNION (not UNION ALL) dedupes, so someone who both posted and
    // liked is one person. If post_likes is missing — the Likes
    // extension is optional — this degrades to the posters alone,
    // which is the correct union against an empty set.
    let likedOrPosted: number;
    try {
      const [rows] = (await conn.execute(
        `SELECT COUNT(*) AS c FROM (
           SELECT user_id FROM posts
             WHERE created_at >= ? AND created_at <= ?
               AND type = 'comment' AND hidden_at IS NULL AND user_id IS NOT NULL
           UNION
           SELECT user_id FROM post_likes WHERE created_at >= ? AND created_at <= ?
         ) u`,
        [start, end, start, end],
      )) as unknown as [Array<{ c: number | string }>];
      likedOrPosted = num(rows[0]?.c);
    } catch {
      likedOrPosted = num(tiersRows[0]?.posted);
    }

    let returningReaders: number | null = null;
    try {
      const [rows] = (await conn.execute(
        `SELECT COUNT(DISTINCT a.user_id) AS c
         FROM discussion_user a
         JOIN discussion_user b ON b.user_id = a.user_id
         WHERE a.last_read_at >= ? AND a.last_read_at <= ?
           AND b.last_read_at >= ? AND b.last_read_at <= ?`,
        [start, end, prevStart, prevEnd],
      )) as unknown as [Array<{ c: number | string }>];
      returningReaders = num(rows[0]?.c);
    } catch (err) {
      console.warn('[stats:forum-tiers] returning readers:', describeError(err));
    }

    return {
      browsers: num(browserRows[0]?.c),
      returningReaders,
      likedOrPosted,
      posted: num(tiersRows[0]?.posted),
      posted3Plus: num(tiersRows[0]?.posted3),
      posted10Plus: num(tiersRows[0]?.posted10),
      previousWindow: { start: prev.start.toISOString(), end: prev.end.toISOString() },
    };
  } catch (err) {
    console.warn('[stats:forum-tiers] fetch failed:', describeError(err));
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

// COUNT/SUM come back as number, bigint or a decimal string depending
// on the driver and the aggregate; normalize once.
function num(raw: number | bigint | string | null | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === 'bigint') return Number(raw);
  return Number(raw) || 0;
}
