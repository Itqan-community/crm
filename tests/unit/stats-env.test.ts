import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// STATS_ENV is module-evaluated, so to exercise different env states
// we reset module cache and re-import after stubbing. Each test gets a
// pristine read of process.env.

const STATS_ENV_VARS = [
  'mailerlite_API_KEY',
  'stat_app_GITHUB_PAT',
  'stat_app_GITHUB_PAT_2',
  'stat_app_GITHUB_ORG',
  'stat_app_GA_OAUTH_CLIENT_ID',
  'stat_app_GA_OAUTH_CLIENT_SECRET',
  'stat_app_GA_OAUTH_REFRESH_TOKEN',
  'stat_app_GA_PROPERTY_ID',
  'stat_app_FLARUM_DB_URL',
  'stat_app_QURAN_APPS_DATABASE_URL',
  'stat_app_CMS_DB_URL',
] as const;

describe('STATS_ENV / sourceConfigured', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const k of STATS_ENV_VARS) vi.stubEnv(k, '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('newsletter — needs mailerlite_API_KEY', async () => {
    const m = await import('@/lib/stats/env');
    expect(m.sourceConfigured('newsletter')).toBe(false);

    vi.stubEnv('mailerlite_API_KEY', 'ml_test_xxx');
    vi.resetModules();
    const m2 = await import('@/lib/stats/env');
    expect(m2.sourceConfigured('newsletter')).toBe(true);
    expect(m2.STATS_ENV.MAILERLITE_API_KEY).toBe('ml_test_xxx');
  });

  it('github — needs at least one PAT', async () => {
    const m = await import('@/lib/stats/env');
    expect(m.sourceConfigured('github')).toBe(false);

    vi.stubEnv('stat_app_GITHUB_PAT_2', 'ghp_secondary');
    vi.resetModules();
    const m2 = await import('@/lib/stats/env');
    expect(m2.sourceConfigured('github')).toBe(true);
  });

  it('github — defaults org to Itqan-community when unset', async () => {
    const m = await import('@/lib/stats/env');
    expect(m.STATS_ENV.GITHUB_ORG).toBe('Itqan-community');

    vi.stubEnv('stat_app_GITHUB_ORG', 'OtherOrg');
    vi.resetModules();
    const m2 = await import('@/lib/stats/env');
    expect(m2.STATS_ENV.GITHUB_ORG).toBe('OtherOrg');
  });

  it('analytics — needs all three OAuth vars + PROPERTY_ID', async () => {
    vi.stubEnv('stat_app_GA_OAUTH_CLIENT_ID', 'cid');
    vi.stubEnv('stat_app_GA_OAUTH_CLIENT_SECRET', 'cs');
    vi.resetModules();
    const m = await import('@/lib/stats/env');
    expect(m.sourceConfigured('analytics')).toBe(false);

    vi.stubEnv('stat_app_GA_OAUTH_REFRESH_TOKEN', 'rt');
    vi.resetModules();
    const m2 = await import('@/lib/stats/env');
    // OAuth triple set, but PROPERTY_ID still missing → unconfigured.
    expect(m2.sourceConfigured('analytics')).toBe(false);

    vi.stubEnv('stat_app_GA_PROPERTY_ID', '123456789');
    vi.resetModules();
    const m3 = await import('@/lib/stats/env');
    expect(m3.sourceConfigured('analytics')).toBe(true);
  });

  it('forum / quranApps / cms — DB URL is the only requirement', async () => {
    vi.stubEnv('stat_app_FLARUM_DB_URL', 'mysql://x');
    vi.stubEnv('stat_app_QURAN_APPS_DATABASE_URL', 'postgres://y');
    vi.stubEnv('stat_app_CMS_DB_URL', 'postgres://z');
    vi.resetModules();
    const m = await import('@/lib/stats/env');
    expect(m.sourceConfigured('forum')).toBe(true);
    expect(m.sourceConfigured('quranApps')).toBe(true);
    expect(m.sourceConfigured('cms')).toBe(true);
  });

  it('SOURCE_LABELS covers every StatsSource', async () => {
    const m = await import('@/lib/stats/env');
    const sources = ['newsletter', 'github', 'analytics', 'forum', 'quranApps', 'cms'] as const;
    for (const s of sources) {
      expect(m.SOURCE_LABELS[s].ar).toBeTruthy();
      expect(m.SOURCE_LABELS[s].en).toBeTruthy();
      expect(m.SOURCE_ENV_NAMES[s].length).toBeGreaterThan(0);
    }
  });
});
