// Flarum (forum) — per-week community metrics.
//
// The existing `flarum.ts` source answers "what happened in the last
// N days" for the verification table. This one answers "what happened
// in each of these N weeks" for the community report, which is a
// different query shape: bucketing by week inside MySQL and returning
// one grouped result per metric, instead of running the same COUNT
// once per week (5 metrics × 13 weeks = 65 round-trips).
//
// Bucketing uses seconds-since-range-start rather than MySQL's WEEK()
// so the week boundary is ours (KSA Sunday 00:00, matching
// dashboard/calendar.ts) and not the server's @@default_week_format
// or session timezone. Flarum stores datetimes in UTC, and the
// anchors we bind are UTC wall-clock strings, so the two agree.
//
// Connection shape mirrors flarum.ts: one connection, no pool —
// pools accumulate per cold-start instance on Vercel and exhaust the DB.

import { STATS_ENV } from '../env';
import type { WeeklyPeriod } from '../weekly';
import { describeError } from '../util';

const WEEK_SECONDS = 7 * 24 * 60 * 60;

export type ForumWeeklyCounts = {
  // Discussions started in the week.
  newDiscussions: number;
  // Posts that aren't the opening post of a discussion.
  replies: number;
  // Distinct members who read at least one discussion in the week.
  readers: number;
  // Distinct members who liked, posted, or replied in the week.
  contributors: number;
  // Distinct members with ≥3 posts (topics + replies) in the week.
  coreContributors: number;
};

export type ForumWeeklySeries = {
  weeks: WeeklyPeriod[];
  // Parallel to `weeks`.
  counts: ForumWeeklyCounts[];
  // Human-readable notes about signals this Flarum install couldn't
  // provide, so the table can say "0 because unavailable" rather than
  // letting a missing extension read as a quiet week.
  degraded: string[];
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// `col` is always a code-owned literal; every value is bound.
function bucket(col: string): string {
  return `FLOOR(TIMESTAMPDIFF(SECOND, CAST(? AS DATETIME), ${col}) / ${WEEK_SECONDS})`;
}

export type BucketRow = { w: number | string | null; c: number | string | null };

// Grouped rows → a dense array indexed by week position. Exported for
// tests: mysql2 hands back BIGINT/DECIMAL aggregates as strings, and a
// week with no activity is simply an absent row, so both paths matter.
export function spreadBuckets(rows: BucketRow[], length: number): number[] {
  const out = new Array<number>(length).fill(0);
  for (const row of rows) {
    // Guard before Number(): Number(null) is 0, which would silently
    // credit an unbucketed row to the oldest week in the table.
    if (row.w == null) continue;
    const w = Number(row.w);
    if (!Number.isInteger(w) || w < 0 || w >= length) continue;
    out[w] = Number(row.c) || 0;
  }
  return out;
}

export async function getForumWeekly(opts: {
  weeks: WeeklyPeriod[];
}): Promise<ForumWeeklySeries | null> {
  if (!STATS_ENV.FLARUM_DB_URL) return null;
  if (opts.weeks.length === 0) {
    return { weeks: [], counts: [], degraded: [] };
  }

  type Mysql = typeof import('mysql2/promise');
  let mysql: Mysql;
  try {
    mysql = (await import('mysql2/promise')) as Mysql;
  } catch (err) {
    console.warn('[stats:forum-weekly] mysql2 import failed:', describeError(err));
    return null;
  }

  const weeks = opts.weeks;
  const n = weeks.length;
  const anchor = fmtDate(weeks[0].start);
  const rangeStart = anchor;
  // Half-open upper bound: the inclusive end is 23:59:59.999, and
  // truncating that to seconds would drop the final second's rows.
  const rangeEnd = fmtDate(new Date(weeks[n - 1].end.getTime() + 1));

  let conn: Awaited<ReturnType<Mysql['createConnection']>> | null = null;
  try {
    conn = await mysql.createConnection({
      uri: STATS_ENV.FLARUM_DB_URL,
      connectTimeout: 10_000,
    });

    const grouped = async (sql: string, params: string[]): Promise<number[]> => {
      const [rows] = await conn!.execute(sql, params);
      return spreadBuckets(rows as BucketRow[], n);
    };

    // ---- Capability probe ---------------------------------------------------
    // Flarum's core columns have shifted across versions and the likes
    // table only exists when flarum/likes is installed. One catalogue
    // read lets every query below degrade instead of throwing.
    const [colRows] = await conn.execute(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('discussions', 'posts', 'post_likes', 'discussion_user')`,
      [],
    );
    const cols = new Set(
      (colRows as Array<{ t: string; c: string }>).map((r) => `${r.t}.${r.c}`),
    );
    const has = (tableColumn: string) => cols.has(tableColumn);
    // Optional predicate: applied only when the column is really there.
    const opt = (tableColumn: string, clause: string) => (has(tableColumn) ? ` AND ${clause}` : '');

    const degraded: string[] = [];

    const discussionFilter =
      opt('discussions.hidden_at', 'hidden_at IS NULL') +
      opt('discussions.is_private', 'is_private = 0');

    // `type = 'comment'` excludes Flarum's event posts (renames, tag
    // changes) — those are rows in `posts` but not things a human wrote.
    const postFilter =
      opt('posts.type', "type = 'comment'") +
      opt('posts.hidden_at', 'hidden_at IS NULL') +
      opt('posts.is_private', 'is_private = 0');

    const hasNumber = has('posts.number');
    const hasReads = has('discussion_user.last_read_at');
    const hasLikes = has('post_likes.created_at');

    // A schema missing the visibility columns can't exclude hidden or
    // private threads, so say so rather than quietly inflating counts.
    const filterCols = [
      'discussions.hidden_at',
      'discussions.is_private',
      'posts.hidden_at',
      'posts.is_private',
    ];
    if (!filterCols.every(has)) {
      degraded.push('أعمدة الإخفاء/الخصوصية ناقصة — قد تُحتسب مواضيع مخفية أو خاصة.');
    }
    if (!hasNumber) {
      degraded.push('عمود posts.number غير موجود — صف «الردود» يظهر صفراً.');
    }
    if (!hasLikes) {
      degraded.push(
        cols.has('post_likes.post_id')
          ? 'إضافة الإعجابات لا تسجّل تاريخ الإعجاب — صف «لايك أو منشور أو رد» يحتسب المشاركات فقط.'
          : 'جدول الإعجابات (post_likes) غير موجود — صف «لايك أو منشور أو رد» يحتسب المشاركات فقط.',
      );
    }
    if (!hasReads) {
      degraded.push('جدول القراءة (discussion_user) غير متاح — صف القرّاء يظهر صفراً.');
    }

    // ---- Queries ------------------------------------------------------------

    const discussionsP = grouped(
      `SELECT ${bucket('created_at')} AS w, COUNT(*) AS c
         FROM discussions
        WHERE created_at >= ? AND created_at < ?${discussionFilter}
        GROUP BY w`,
      [anchor, rangeStart, rangeEnd],
    );

    // `number > 1` is the only honest reply count: Flarum writes an
    // opening post for every discussion, and post 1 is always it.
    // Deriving replies as (posts - discussions) instead would fold any
    // error in the discussion count into this row, so a schema without
    // `posts.number` reports the row as unavailable rather than
    // approximating it.
    const repliesP: Promise<number[]> = hasNumber
      ? grouped(
          `SELECT ${bucket('created_at')} AS w, COUNT(*) AS c
             FROM posts
            WHERE created_at >= ? AND created_at < ? AND number > 1${postFilter}
            GROUP BY w`,
          [anchor, rangeStart, rangeEnd],
        )
      : Promise.resolve(new Array<number>(n).fill(0));

    const readersP: Promise<number[]> = hasReads
      ? grouped(
          `SELECT ${bucket('last_read_at')} AS w, COUNT(DISTINCT user_id) AS c
             FROM discussion_user
            WHERE last_read_at >= ? AND last_read_at < ? AND user_id IS NOT NULL
            GROUP BY w`,
          [anchor, rangeStart, rangeEnd],
        )
      : Promise.resolve(new Array<number>(n).fill(0));

    const authored = `SELECT ${bucket('created_at')} AS w, user_id
         FROM posts
        WHERE created_at >= ? AND created_at < ? AND user_id IS NOT NULL${postFilter}`;

    const contributorsP = grouped(
      hasLikes
        ? `SELECT w, COUNT(DISTINCT user_id) AS c FROM (
             ${authored}
             UNION ALL
             SELECT ${bucket('created_at')} AS w, user_id
               FROM post_likes
              WHERE created_at >= ? AND created_at < ? AND user_id IS NOT NULL
           ) t GROUP BY w`
        : `SELECT w, COUNT(DISTINCT user_id) AS c FROM (${authored}) t GROUP BY w`,
      hasLikes
        ? [anchor, rangeStart, rangeEnd, anchor, rangeStart, rangeEnd]
        : [anchor, rangeStart, rangeEnd],
    );

    // "3 posts or replies at least" counts every post the member wrote,
    // opening posts included — so no `number > 1` filter here.
    const coreP = grouped(
      `SELECT w, COUNT(*) AS c FROM (
         ${authored}
         GROUP BY w, user_id
         HAVING COUNT(*) >= 3
       ) t GROUP BY w`,
      [anchor, rangeStart, rangeEnd],
    );

    const [newDiscussions, replies, readers, contributors, coreContributors] =
      await Promise.all([discussionsP, repliesP, readersP, contributorsP, coreP]);

    const counts: ForumWeeklyCounts[] = weeks.map((_, i) => ({
      newDiscussions: newDiscussions[i],
      replies: replies[i],
      readers: readers[i],
      contributors: contributors[i],
      coreContributors: coreContributors[i],
    }));

    return { weeks, counts, degraded };
  } catch (err) {
    console.warn('[stats:forum-weekly] fetch failed:', describeError(err));
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

// Row definitions for the table — kept next to the query so a new
// metric is added in one place.
export const FORUM_WEEKLY_ROWS: ReadonlyArray<{
  key: keyof ForumWeeklyCounts;
  label: string;
  note: string;
}> = [
  {
    key: 'newDiscussions',
    label: 'المواضيع الجديدة',
    note: 'مواضيع أُنشئت خلال الأسبوع (بدون المخفية والخاصة).',
  },
  {
    key: 'replies',
    label: 'الردود',
    note: 'المشاركات عدا المشاركة الأولى من كل موضوع.',
  },
  {
    key: 'readers',
    label: 'متصفحون + قراء عائدون',
    note: 'أعضاء قرؤوا موضوعاً واحداً على الأقل خلال الأسبوع. لا يشمل الزوار الضيوف.',
  },
  {
    key: 'contributors',
    label: 'لايك أو منشور أو رد',
    note: 'أعضاء قاموا بإعجاب أو نشر موضوع أو رد خلال الأسبوع (بدون تكرار).',
  },
  {
    key: 'coreContributors',
    label: '٣ منشورات أو ردود على الأقل',
    note: 'أعضاء لهم ٣ مشاركات فأكثر (مواضيع وردود) خلال الأسبوع.',
  },
];
