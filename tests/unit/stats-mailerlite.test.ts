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

  it('averages open/click rates across the sampled campaigns', async () => {
    vi.stubEnv('mailerlite_API_KEY', 'ml_test');
    stubFetch((path) => {
      if (path.startsWith('/subscribers')) {
        return jsonResponse({ total: 1234, data: [] });
      }
      if (path.startsWith('/campaigns')) {
        return jsonResponse({
          data: [
            {
              id: 'c1',
              name: 'Latest issue',
              subject: 'Hello',
              finished_at: '2026-05-01T10:00:00Z',
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
              name: 'Older issue',
              subject: 'Hi',
              finished_at: '2026-04-15T10:00:00Z',
              scheduled_for: null,
              stats: {
                sent: 800,
                unique_opens_count: 240,
                unique_clicks_count: 40,
                open_rate: { float: 0.3 },
                click_rate: { float: 0.05 },
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
    expect(r!.sampledCampaigns).toBe(2);
    // (0.4 + 0.3) / 2 * 100 = 35.0
    expect(r!.avgOpenRate).toBeCloseTo(35, 5);
    // (0.08 + 0.05) / 2 * 100 = 6.5
    expect(r!.avgClickRate).toBeCloseTo(6.5, 5);
    expect(r!.lastCampaignName).toBe('Latest issue');
    expect(r!.lastCampaignAt).toBe('2026-05-01T10:00:00Z');
    expect(r!.recentCampaigns).toHaveLength(2);
  });

  it('returns null on non-200 response — no throw', async () => {
    vi.stubEnv('mailerlite_API_KEY', 'ml_test');
    stubFetch(() => new Response('bad token', { status: 401 }));
    const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
    const r = await getNewsletter();
    expect(r).toBeNull();
  });

  it('skips campaigns with sent=0 from the average', async () => {
    vi.stubEnv('mailerlite_API_KEY', 'ml_test');
    stubFetch((path) => {
      if (path.startsWith('/subscribers')) return jsonResponse({ total: 0 });
      return jsonResponse({
        data: [
          {
            id: 'c1',
            name: 'Sent',
            subject: '',
            finished_at: null,
            scheduled_for: null,
            stats: {
              sent: 100,
              unique_opens_count: 50,
              unique_clicks_count: 10,
              open_rate: { float: 0.5 },
              click_rate: { float: 0.1 },
            },
          },
          // This zero-sent campaign should be ignored in the average.
          {
            id: 'c2',
            name: 'Draft',
            subject: '',
            finished_at: null,
            scheduled_for: null,
            stats: {
              sent: 0,
              unique_opens_count: 0,
              unique_clicks_count: 0,
              open_rate: { float: 0 },
              click_rate: { float: 0 },
            },
          },
        ],
      });
    });
    const { getNewsletter } = await import('@/lib/stats/sources/mailerlite');
    const r = await getNewsletter();
    expect(r!.sampledCampaigns).toBe(1);
    expect(r!.avgOpenRate).toBeCloseTo(50, 5);
  });
});
