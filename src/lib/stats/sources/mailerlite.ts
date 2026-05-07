// MailerLite source — newsletter metrics.
//
// Approach:
// 1. /api/subscribers?limit=1 returns `total` in the JSON body. That's
//    our active-subscriber count.
// 2. /api/campaigns?filter[status]=sent&limit=N returns the N most recent
//    sent campaigns, each with embedded `stats` (open_rate.float, etc).
//    We average across them for the "current" open rate. This mirrors
//    what stats's mailerlite collector does, except we read live rather
//    than syncing into a Prisma table.
//
// API ref: https://developers.mailerlite.com/

import { STATS_ENV } from '../env';
import type { NewsletterMetrics } from '../types';

const API_BASE = 'https://connect.mailerlite.com/api';

// How many recent campaigns to average for "current" open/click rate.
// MailerLite returns up to 100 per page; 10 gives a stable rolling
// average without leaning on stale six-month-old campaigns.
const SAMPLE_SIZE = 10;

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

export async function getNewsletter(): Promise<NewsletterMetrics | null> {
  if (!STATS_ENV.MAILERLITE_API_KEY) return null;

  try {
    const [subsResp, campsResp] = await Promise.all([
      mlFetch<SubscribersResponse>('/subscribers?limit=1'),
      mlFetch<CampaignsResponse>(
        `/campaigns?filter[status]=sent&limit=${SAMPLE_SIZE}`,
      ),
    ]);

    const campaigns = campsResp.data ?? [];
    const samples = campaigns.filter((c) => c.stats && c.stats.sent > 0);

    const avgOpenRate = average(samples.map((c) => c.stats!.open_rate?.float ?? 0));
    const avgClickRate = average(samples.map((c) => c.stats!.click_rate?.float ?? 0));

    const newest = campaigns[0] ?? null;

    return {
      activeSubscribers: subsResp.total ?? 0,
      sampledCampaigns: samples.length,
      // MailerLite reports rates as 0..1 floats. Convert to 0..100.
      avgOpenRate: avgOpenRate * 100,
      avgClickRate: avgClickRate * 100,
      lastCampaignAt: newest?.finished_at ?? newest?.scheduled_for ?? null,
      lastCampaignName: newest?.name ?? null,
      recentCampaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        sentAt: c.finished_at ?? c.scheduled_for ?? null,
        sent: c.stats?.sent ?? 0,
        opens: c.stats?.unique_opens_count ?? 0,
        clicks: c.stats?.unique_clicks_count ?? 0,
        openRate: (c.stats?.open_rate?.float ?? 0) * 100,
        clickRate: (c.stats?.click_rate?.float ?? 0) * 100,
      })),
    };
  } catch (err) {
    console.warn('[stats:newsletter] fetch failed:', describeError(err));
    return null;
  }
}

function average(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
