// MailerLite source — newsletter metrics.
//
// Approach:
// 1. /api/subscribers?limit=1 returns `total` in the JSON body — our
//    active-subscriber count.
// 2. /api/campaigns?filter[status]=sent&limit=50 returns the 50 most
//    recent sent campaigns, each with embedded `stats` (open_rate.float,
//    etc). We compute three things from this list:
//      a. lastCampaign: the newest one (top of the list)
//      b. last7Days: average across campaigns whose finished_at falls
//         in the last 7 days — the user-asked "متوسط الفتح خلال
//         الأسبوع الماضي" KPI
//      c. recentCampaigns: the full list, for display
//
// 50 campaigns is well over a typical week's traffic and keeps us in
// a single API page. If Itqan's send cadence ever exceeds that we'll
// paginate.
//
// API ref: https://developers.mailerlite.com/

import { STATS_ENV } from '../env';
import type { NewsletterCampaignRow, NewsletterMetrics } from '../types';
import { describeError } from '../util';

const API_BASE = 'https://connect.mailerlite.com/api';

const FETCH_LIMIT = 50;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Campaign = {
  id: string;
  name: string;
  subject: string;
  finished_at: string | null;
  scheduled_for: string | null;
  stats?: {
    sent: number;
    unique_opens_count: number;
    unique_clicks_count: number;
    open_rate?: { float: number };
    click_rate?: { float: number };
  };
};

type CampaignsResponse = { data: Campaign[] };
type SubscribersResponse = { total: number };

async function mlFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${STATS_ENV.MAILERLITE_API_KEY!}`,
      Accept: 'application/json',
    },
    next: { revalidate: 300, tags: ['stats:newsletter'] },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MailerLite ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function toRow(c: Campaign): NewsletterCampaignRow {
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    sentAt: c.finished_at ?? c.scheduled_for ?? null,
    sent: c.stats?.sent ?? 0,
    opens: c.stats?.unique_opens_count ?? 0,
    clicks: c.stats?.unique_clicks_count ?? 0,
    // MailerLite reports rates as 0..1 floats. Convert to 0..100.
    openRate: (c.stats?.open_rate?.float ?? 0) * 100,
    clickRate: (c.stats?.click_rate?.float ?? 0) * 100,
  };
}

export async function getNewsletter(): Promise<NewsletterMetrics | null> {
  if (!STATS_ENV.MAILERLITE_API_KEY) return null;

  try {
    const [subsResp, campsResp] = await Promise.all([
      mlFetch<SubscribersResponse>('/subscribers?limit=1'),
      mlFetch<CampaignsResponse>(
        `/campaigns?filter[status]=sent&limit=${FETCH_LIMIT}`,
      ),
    ]);

    const rows = (campsResp.data ?? []).map(toRow);

    // Last campaign: prefer the newest with sent>0 to dodge "drafts
    // somehow marked sent" edge cases. MailerLite returns newest-first
    // already, so the first match is what we want.
    const lastCampaign = rows.find((r) => r.sent > 0) ?? null;

    // Last 7 days: window relative to "right now", inclusive on the start.
    const since = Date.now() - WEEK_MS;
    const inWindow = rows.filter((r) => {
      if (!r.sentAt || r.sent <= 0) return false;
      const t = Date.parse(r.sentAt);
      return Number.isFinite(t) && t >= since;
    });

    return {
      activeSubscribers: subsResp.total ?? 0,
      lastCampaign,
      last7Days: {
        count: inWindow.length,
        totalSent: inWindow.reduce((sum, r) => sum + r.sent, 0),
        avgOpenRate: average(inWindow.map((r) => r.openRate)),
        avgClickRate: average(inWindow.map((r) => r.clickRate)),
      },
      recentCampaigns: rows,
    };
  } catch (err) {
    console.warn('[stats:newsletter] fetch failed:', describeError(err));
    throw err;
  }
}

function average(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
