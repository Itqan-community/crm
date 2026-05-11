import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// loadStatsBundle composes 6 sources via Promise.allSettled. We mock
// each source module so the loader's behaviour (window math, error
// accumulation, null-on-unconfigured) is what's exercised — not the
// individual source implementations (those have their own tests).

beforeEach(() => {
  vi.resetModules();
  // Default to all-unconfigured so sourceConfigured() is false for everything.
  vi.stubEnv('mailerlite_API_KEY', '');
  vi.stubEnv('stat_app_GITHUB_PAT', '');
  vi.stubEnv('stat_app_GITHUB_PAT_2', '');
  vi.stubEnv('stat_app_GA_OAUTH_CLIENT_ID', '');
  vi.stubEnv('stat_app_GA_OAUTH_CLIENT_SECRET', '');
  vi.stubEnv('stat_app_GA_OAUTH_REFRESH_TOKEN', '');
  vi.stubEnv('stat_app_FLARUM_DB_URL', '');
  vi.stubEnv('stat_app_QURAN_APPS_DATABASE_URL', '');
  vi.stubEnv('stat_app_CMS_DB_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/stats/sources/mailerlite');
  vi.doUnmock('@/lib/stats/sources/github');
  vi.doUnmock('@/lib/stats/sources/analytics');
  vi.doUnmock('@/lib/stats/sources/flarum');
  vi.doUnmock('@/lib/stats/sources/quran_apps');
  vi.doUnmock('@/lib/stats/sources/cms');
});

function mockSource(path: string, fn: () => Promise<unknown>) {
  vi.doMock(path, () => {
    const exportName = ({
      '@/lib/stats/sources/mailerlite': 'getNewsletter',
      '@/lib/stats/sources/github': 'getGithub',
      '@/lib/stats/sources/analytics': 'getAnalytics',
      '@/lib/stats/sources/flarum': 'getForum',
      '@/lib/stats/sources/quran_apps': 'getQuranApps',
      '@/lib/stats/sources/cms': 'getCms',
    } as Record<string, string>)[path];
    return { [exportName!]: fn };
  });
}

function mockAllNull() {
  mockSource('@/lib/stats/sources/mailerlite', async () => null);
  mockSource('@/lib/stats/sources/github', async () => null);
  mockSource('@/lib/stats/sources/analytics', async () => null);
  mockSource('@/lib/stats/sources/flarum', async () => null);
  mockSource('@/lib/stats/sources/quran_apps', async () => null);
  mockSource('@/lib/stats/sources/cms', async () => null);
}

describe('loadStatsBundle', () => {
  it('returns nulls + zero errors when no sources are configured', async () => {
    mockAllNull();
    const { loadStatsBundle } = await import('@/lib/stats/loader');
    const b = await loadStatsBundle();
    expect(b.newsletter).toBeNull();
    expect(b.github).toBeNull();
    expect(b.analytics).toBeNull();
    expect(b.forum).toBeNull();
    expect(b.quranApps).toBeNull();
    expect(b.cms).toBeNull();
    expect(b.errors).toEqual([]); // unconfigured ≠ error
  });

  it('treats null as "not configured" and does not raise an error', async () => {
    // Even with the env var set, a source that returns null is treated
    // as unconfigured (its own contract: throw to signal failure).
    vi.stubEnv('mailerlite_API_KEY', 'ml_x');
    mockAllNull();
    const { loadStatsBundle } = await import('@/lib/stats/loader');
    const b = await loadStatsBundle();
    expect(b.errors).toEqual([]);
    expect(b.newsletter).toBeNull();
  });

  it('isolates a thrown source — others still resolve', async () => {
    mockSource('@/lib/stats/sources/mailerlite', async () => {
      throw new Error('boom');
    });
    mockSource('@/lib/stats/sources/github', async () => ({
      org: 'Itqan-community',
      commits: 5,
      prsOpened: 1,
      prsMerged: 0,
      prsClosed: 0,
      issuesOpened: 0,
      publicRepos: 1,
      privateRepos: 0,
      totalStars: 0,
    }));
    mockSource('@/lib/stats/sources/analytics', async () => null);
    mockSource('@/lib/stats/sources/flarum', async () => null);
    mockSource('@/lib/stats/sources/quran_apps', async () => null);
    mockSource('@/lib/stats/sources/cms', async () => null);

    const { loadStatsBundle } = await import('@/lib/stats/loader');
    const b = await loadStatsBundle();
    expect(b.newsletter).toBeNull();
    expect(b.errors.find((e) => e.source === 'newsletter')?.message).toContain('boom');
    expect(b.github?.commits).toBe(5);
  });

  it('clamps windowDays to [1, 365] and computes a coherent range', async () => {
    mockAllNull();
    const { loadStatsBundle } = await import('@/lib/stats/loader');
    const b1 = await loadStatsBundle({ windowDays: 0 });
    expect(b1.range.days).toBe(1);
    const b2 = await loadStatsBundle({ windowDays: 99999 });
    expect(b2.range.days).toBe(365);
    const b3 = await loadStatsBundle({ windowDays: 30 });
    expect(b3.range.days).toBe(30);
    expect(new Date(b3.range.end).getTime()).toBeGreaterThan(
      new Date(b3.range.start).getTime(),
    );
  });

  it('returns a generatedAt ISO string', async () => {
    mockAllNull();
    const { loadStatsBundle } = await import('@/lib/stats/loader');
    const b = await loadStatsBundle();
    expect(b.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
