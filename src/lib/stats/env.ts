// Centralized env-var reader for the stats integration.
// Names match exactly what's set in Vercel — they came from the Itqan
// stats project and were copied over with a `stat_app_` prefix when we
// brought direct-source ingestion into CRM. Renaming a variable means
// editing this file and nothing else.

export const STATS_ENV = {
  MAILERLITE_API_KEY: process.env.mailerlite_API_KEY,

  GITHUB_PAT: process.env.stat_app_GITHUB_PAT,
  GITHUB_PAT_2: process.env.stat_app_GITHUB_PAT_2,
  // Default applies when the var is unset OR empty string (some
  // platforms surface unset vars as ""). `||` handles both.
  GITHUB_ORG: process.env.stat_app_GITHUB_ORG || 'Itqan-community',

  GA_OAUTH_CLIENT_ID: process.env.stat_app_GA_OAUTH_CLIENT_ID,
  GA_OAUTH_CLIENT_SECRET: process.env.stat_app_GA_OAUTH_CLIENT_SECRET,
  GA_OAUTH_REFRESH_TOKEN: process.env.stat_app_GA_OAUTH_REFRESH_TOKEN,
  GA_PROPERTY_ID: process.env.stat_app_GA_PROPERTY_ID,

  FLARUM_DB_URL: process.env.stat_app_FLARUM_DB_URL,
  QURAN_APPS_DB_URL: process.env.stat_app_QURAN_APPS_DATABASE_URL,
  CMS_DB_URL: process.env.stat_app_CMS_DB_URL,
} as const;

export type StatsSource =
  | 'newsletter'
  | 'github'
  | 'analytics'
  | 'forum'
  | 'quranApps'
  | 'cms';

// Per-source readiness — used by the env banner and to short-circuit
// fetchers when credentials are missing.
export function sourceConfigured(source: StatsSource): boolean {
  switch (source) {
    case 'newsletter':
      return Boolean(STATS_ENV.MAILERLITE_API_KEY);
    case 'github':
      return Boolean(STATS_ENV.GITHUB_PAT || STATS_ENV.GITHUB_PAT_2);
    case 'analytics':
      // PROPERTY_ID has a hardcoded default (itqan.dev) inside
      // sources/analytics.ts, so it's optional — only the OAuth
      // triple is mandatory.
      return Boolean(
        STATS_ENV.GA_OAUTH_CLIENT_ID &&
          STATS_ENV.GA_OAUTH_CLIENT_SECRET &&
          STATS_ENV.GA_OAUTH_REFRESH_TOKEN,
      );
    case 'forum':
      return Boolean(STATS_ENV.FLARUM_DB_URL);
    case 'quranApps':
      return Boolean(STATS_ENV.QURAN_APPS_DB_URL);
    case 'cms':
      return Boolean(STATS_ENV.CMS_DB_URL);
  }
}

// Friendly labels for the env-status banner.
export const SOURCE_LABELS: Record<StatsSource, { ar: string; en: string }> = {
  newsletter: { ar: 'النشرة (MailerLite)', en: 'Newsletter (MailerLite)' },
  github: { ar: 'GitHub', en: 'GitHub' },
  analytics: { ar: 'Google Analytics', en: 'Google Analytics' },
  forum: { ar: 'المنتدى (Flarum)', en: 'Forum (Flarum)' },
  quranApps: { ar: 'دليل التطبيقات', en: 'Quran Apps Directory' },
  cms: { ar: 'منصة المحتوى (CMS)', en: 'CMS' },
};

// Names of env vars per source — for the banner so users know exactly
// which key to set in Vercel when a source is unconfigured.
export const SOURCE_ENV_NAMES: Record<StatsSource, readonly string[]> = {
  newsletter: ['mailerlite_API_KEY'] as const,
  github: ['stat_app_GITHUB_PAT', 'stat_app_GITHUB_PAT_2 (اختياري)'] as const,
  analytics: [
    'stat_app_GA_OAUTH_CLIENT_ID',
    'stat_app_GA_OAUTH_CLIENT_SECRET',
    'stat_app_GA_OAUTH_REFRESH_TOKEN',
  ] as const,
  forum: ['stat_app_FLARUM_DB_URL'] as const,
  quranApps: ['stat_app_QURAN_APPS_DATABASE_URL'] as const,
  cms: ['stat_app_CMS_DB_URL'] as const,
};
