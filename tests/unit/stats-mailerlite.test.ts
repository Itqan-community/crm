import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We exercise getNewsletter against a stubbed global fetch — that's
// the boundary between our code and MailerLite. No HTTP server, no
// msw — just enough to verify averaging math and missing-key handling.

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('mailerlite_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (path: string) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.replace('https://connect.mailerlite.com/api', '');
    return handler(path);
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('getNewsletter', () => {
  it('returns null when API key is missing — does not fetch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
    const result = await getNewsletter();
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('separates lastCampaign from the last-7-days window average', async () => {
    vi.stubEnv('mailerlite_API_KEY', 'ml_test');
    // Two recent (within 7d) + one old (>7d) campaign. The old one
    // should NOT contribute to last7Days but SHOULD appear in
    // recentCampaigns.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now - 3 * day).toISOString();
    const twentyDaysAgo = new Date(now - 20 * day).toISOString();

    stubFetch((path) => {
      if (path.startsWith('/subscribers')) return jsonResponse({ total: 1234 });
      if (path.startsWith('/campaigns')) {
        return jsonResponse({
          data: [
            {
              id: 'c1',
              name: 'النشرة الحادية والعشرون',
              subject: 'Hello',
              finished_at: oneHourAgo,
              scheduled_for: null,
              stats: {
                sent: 1000,
                unique_opens_count: 400,
                unique_clicks_count: 80,
                open_rate: { float: 0.4 },
                click_rate: { float: 0.08 },
              },
            },
            {
              id: 'c2',
              name: 'النشرة العشرون',
              subject: 'Hi',
              finished_at: threeDaysAgo,
              scheduled_for: null,
              stats: {
                sent: 800,
                unique_opens_count: 240,
                unique_clicks_count: 40,
                open_rate: { float: 0.3 },
                click_rate: { float: 0.05 },
              },
            },
            {
              id: 'c3',
              name: 'النشرة التاسعة عشر',
              subject: 'Old',
              finished_at: twentyDaysAgo,
              scheduled_for: null,
              stats: {
                sent: 500,
                unique_opens_count: 100,
                unique_clicks_count: 10,
                open_rate: { float: 0.2 },
                click_rate: { float: 0.02 },
              },
            },
          ],
        });
      }
      return new Response('not found', { status: 404 });
    });

    const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
    const r = await getNewsletter();
    expect(r).not.toBeNull();
    expect(r!.activeSubscribers).toBe(1234);

    // lastCampaign = the newest (regardless of window).
    expect(r!.lastCampaign?.id).toBe('c1');
    expect(r!.lastCampaign?.name).toBe('النشرة الحادية والعشرون');
    expect(r!.lastCampaign?.openRate).toBeCloseTo(40, 5);
    expect(r!.lastCampaign?.clickRate).toBeCloseTo(8, 5);

    // last7Days = only c1 + c2 (c3 is 20 days old).
    expect(r!.last7Days.count).toBe(2);
    expect(r!.last7Days.totalSent).toBe(1800);
    // (0.4 + 0.3) / 2 * 100 = 35.0
    expect(r!.last7Days.avgOpenRate).toBeCloseTo(35, 5);
    // (0.08 + 0.05) / 2 * 100 = 6.5
    expect(r!.last7Days.avgClickRate).toBeCloseTo(6.5, 5);

    // recentCampaigns has all 3, newest first.
    expect(r!.recentCampaigns).toHaveLength(3);
    expect(r!.recentCampaigns[0].id).toBe('c1');
    expect(r!.recentCampaigns[2].id).toBe('c3');
  });

  it('returns last7Days with count=0 when no campaign falls in the window', async () => {
    vi.stubEnv('mailerlite_API_KEY', 'ml_test');
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    stubFetch((path) => {
      if (path.startsWith('/subscribers')) return jsonResponse({ total: 100 });
      return jsonResponse({
        data: [
          {
            id: 'c1',
            name: 'Old',
            subject: '',
            finished_at: longAgo,
            scheduled_for: null,
            stats: {
              sent: 200,
              unique_opens_count: 50,
              unique_clicks_count: 5,
              open_rate: { float: 0.25 },
              click_rate: { float: 0.025 },
            },
          },
        ],
      });
    });
    const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
    const r = await getNewsletter();
    expect(r!.last7Days.count).toBe(0);
    expect(r!.last7Days.avgOpenRate).toBe(0);
    // lastCampaign still set even though it's outside the 7d window.
    expect(r!.lastCampaign?.id).toBe('c1');
  });

  it('throws on non-200 — loader will record the error message', async () => {
    vi.stubEnv('mailerlite_API_KEY', 'ml_test');
    stubFetch(() => new Response('bad token', { status: 401 }));
    const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
    await expect(getNewsletter()).rejects.toThrow(/MailerLite.*401/);
  });

  it('skips zero-sent campaigns from lastCampaign and last7Days', async () => {
    vi.stubEnv('mailerlite_API_KEY', 'ml_test');
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    stubFetch((path) => {
      if (path.startsWith('/subscribers')) return jsonResponse({ total: 0 });
      return jsonResponse({
        data: [
          // First in MailerLite's order: a zero-sent draft.
          {
            id: 'c-draft',
            name: 'Draft',
            subject: '',
            finished_at: recent,
            scheduled_for: null,
            stats: {
              sent: 0,
              unique_opens_count: 0,
              unique_clicks_count: 0,
              open_rate: { float: 0 },
              click_rate: { float: 0 },
            },
          },
          {
            id: 'c-real',
            name: 'Sent',
            subject: '',
            finished_at: recent,
            scheduled_for: null,
            stats: {
              sent: 100,
              unique_opens_count: 50,
              unique_clicks_count: 10,
              open_rate: { float: 0.5 },
              click_rate: { float: 0.1 },
            },
          },
        ],
      });
    });
    const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
    const r = await getNewsletter();
    // lastCampaign skips the zero-sent draft.
    expect(r!.lastCampaign?.id).toBe('c-real');
    // last7Days averages only the real campaign.
    expect(r!.last7Days.count).toBe(1);
    expect(r!.last7Days.avgOpenRate).toBeCloseTo(50, 5);
  });
});
