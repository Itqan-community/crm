// MailerLite read-side: aggregate sent campaigns into weekly buckets so
// the dashboard can show "newsletter open rate" per Sun→Sat KSA week.
// The write side (subscribers) lives in src/lib/notify/newsletter.ts.
//
// Returns null if the API key is missing or the call fails — callers
// fall back to manually-entered values in dashboard_metrics.

import { weekKey, startOfKsaWeek } from './dates';

export type NewsletterWeekStats = {
  sent: number;     // total recipients across campaigns this week
  opened: number;   // unique opens
  rate: number;     // 0..100 percentage
};

type MailerLiteCampaign = {
  id: string;
  status: string;
  delivered_at?: string | null;
  finished_at?: string | null;
  emails_sent_count?: number | null;
  stats?: {
    sent?: number;
    opens_count?: number;
    unique_opens_count?: number;
    open_rate?: { float?: number };
  };
};

type CampaignsResponse = {
  data?: MailerLiteCampaign[];
  meta?: { next_cursor?: string | null };
};

// Returns a map keyed by `weekKey(Sunday)` covering the requested weeks.
// Weeks with no sent campaigns map to `{ sent: 0, opened: 0, rate: 0 }`.
export async function loadNewsletterWeeklyStats(
  weekStarts: Date[],
): Promise<Record<string, NewsletterWeekStats> | null> {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) return null;
  if (weekStarts.length === 0) return {};

  const earliest = new Date(Math.min(...weekStarts.map((d) => d.getTime())));

  const buckets: Record<string, NewsletterWeekStats> = {};
  for (const w of weekStarts) buckets[weekKey(w)] = { sent: 0, opened: 0, rate: 0 };

  try {
    let cursor: string | null = null;
    let safety = 5; // cap pagination — at 25 sent campaigns/week we won't outgrow this for the 8-week window
    do {
      const url = new URL('https://connect.mailerlite.com/api/campaigns');
      url.searchParams.set('filter[status]', 'sent');
      url.searchParams.set('limit', '50');
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url.toString(), {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        // Server-side cache keeps repeated dashboard renders cheap.
        next: { revalidate: 60 * 5, tags: ['mailerlite-campaigns'] },
      });
      if (!res.ok) {
        console.error('[mailerlite-stats] http', res.status);
        return null;
      }
      const json = (await res.json()) as CampaignsResponse;
      const items = json.data ?? [];
      let reachedEarliest = false;
      for (const c of items) {
        const ts = c.delivered_at || c.finished_at;
        if (!ts) continue;
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) continue;
        if (d.getTime() < earliest.getTime()) {
          reachedEarliest = true;
          continue;
        }
        const wk = weekKey(startOfKsaWeek(d));
        const bucket = buckets[wk];
        if (!bucket) continue; // outside our window (future or pre-anchor)
        const sent = c.stats?.sent ?? c.emails_sent_count ?? 0;
        const opened = c.stats?.unique_opens_count ?? c.stats?.opens_count ?? 0;
        bucket.sent += sent;
        bucket.opened += opened;
      }
      cursor = json.meta?.next_cursor ?? null;
      if (reachedEarliest) break; // older campaigns don't help us
      safety -= 1;
    } while (cursor && safety > 0);
  } catch (err) {
    console.error('[mailerlite-stats] fetch failed', err);
    return null;
  }

  for (const k of Object.keys(buckets)) {
    const b = buckets[k];
    b.rate = b.sent > 0 ? (b.opened / b.sent) * 100 : 0;
  }
  return buckets;
}
