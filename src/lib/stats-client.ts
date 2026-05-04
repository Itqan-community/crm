// Read-side adapter for the Itqan stats project (Itqan-community/stats).
// That project ingests live data from GitHub, MailerLite, the Discourse-
// style forum, Google Analytics, LinkedIn and the Quran Apps directory,
// and exposes a handful of unauthenticated GET endpoints under /api/.
// The CRM dashboard reads from those rather than asking admins to
// re-type values weekly.
//
// Configure the base URL via STATS_BASE_URL (e.g. https://stats.itqan.dev).
// If it's unset the client returns null from every method and callers
// fall back to direct MailerLite reads / Supabase manual entries.

const REVALIDATE_SECONDS = 5 * 60;

type FetchOptions = { range?: { start: Date; end: Date } };

type SafeFetchTags = string[];

async function safeFetch<T>(path: string, tags: SafeFetchTags): Promise<T | null> {
  const base = process.env.STATS_BASE_URL?.replace(/\/$/, '');
  if (!base) return null;
  const url = `${base}${path}`;
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (process.env.STATS_API_TOKEN) {
      headers.authorization = `Bearer ${process.env.STATS_API_TOKEN}`;
    }
    const res = await fetch(url, {
      headers,
      next: { revalidate: REVALIDATE_SECONDS, tags },
    });
    if (!res.ok) {
      console.warn('[stats-client] non-OK', res.status, url);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[stats-client] fetch failed', url, err);
    return null;
  }
}

function rangeQuery(opts?: FetchOptions): string {
  if (!opts?.range) return '';
  const start = opts.range.start.toISOString();
  const end = opts.range.end.toISOString();
  return `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
}

// ---------- Response types (loose: stats project may evolve) ----------

export type StatsNewsletter = {
  totalSubscribers: number;
  activeSubscribers: number;
  totalCampaignsSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  lastCampaignDate: string | null;
};

export type StatsForum = {
  metrics: {
    totalUsers: number;
    newUsers: { value: number; change?: number };
    activeUsers: { value: number; change?: number };
    totalPosts: number;
    newPosts: { value: number; change?: number };
    totalDiscussions: number;
    newDiscussions: { value: number; change?: number };
    totalLikes: number;
    // Cumulative — the live endpoint serializes this as a string sometimes,
    // so accept both. We don't use it for weekly comparisons.
    totalViews?: number | string;
    avgPostsPerDiscussion?: number;
    gaVisitors?: number;
    gaPageviews?: number;
    gaSessions?: number;
  };
};

export type StatsAnalytics = {
  metrics: {
    pageviews: { value: number; change: number };
    uniqueVisitors: { value: number; change: number };
    avgSessionDuration?: { value: string; change: number };
    bounceRate?: { value: string; change: number };
  };
};

export type StatsLinkedIn = {
  success: boolean;
  metrics: {
    followers: number;
    newFollowers: number;
    totalImpressions: number;
    totalEngagements: number;
    avgEngagementRate: number;
  } | null;
};

export type StatsGitHub = {
  metrics: {
    commits: { value: number; change: number };
    prsOpened: { value: number; change: number };
    prsMerged: { value: number; change: number };
  };
  contributors: Array<{ login: string; totalCommits: number; totalPRs: number }>;
  repoStats: { total: number; public: number; private: number; totalStars: number };
};

export type StatsQuranApps = {
  totalApps: number;
  totalViews: number;
  totalClicks: number;
  featuredCount: number;
  categoryCounts: Array<{ category: string; count: number }>;
  platformCounts: Array<{ platform: string; count: number }>;
};

// ---------- Fetchers ----------

export async function fetchNewsletter(): Promise<StatsNewsletter | null> {
  return safeFetch<StatsNewsletter>('/api/newsletter/metrics', ['stats:newsletter']);
}

export async function fetchForum(opts?: FetchOptions): Promise<StatsForum | null> {
  return safeFetch<StatsForum>('/api/forum/stats' + rangeQuery(opts), ['stats:forum']);
}

export async function fetchAnalytics(): Promise<StatsAnalytics | null> {
  // The stats project's analytics endpoint returns a hard-coded 7-day vs
  // 14-day comparison (no custom range). We use it as "current week"-ish.
  return safeFetch<StatsAnalytics>('/api/analytics/metrics', ['stats:analytics']);
}

export async function fetchLinkedIn(): Promise<StatsLinkedIn | null> {
  return safeFetch<StatsLinkedIn>('/api/linkedin/metrics', ['stats:linkedin']);
}

export async function fetchGitHub(opts?: FetchOptions): Promise<StatsGitHub | null> {
  return safeFetch<StatsGitHub>('/api/github/metrics' + rangeQuery(opts), ['stats:github']);
}

export async function fetchQuranApps(): Promise<StatsQuranApps | null> {
  return safeFetch<StatsQuranApps>('/api/quran-apps/metrics', ['stats:apps']);
}

export type StatsBundle = {
  newsletter: StatsNewsletter | null;
  forum: StatsForum | null;
  analytics: StatsAnalytics | null;
  linkedin: StatsLinkedIn | null;
  github: StatsGitHub | null;
  apps: StatsQuranApps | null;
};

export async function fetchAllStats(opts?: FetchOptions): Promise<StatsBundle> {
  const [newsletter, forum, analytics, linkedin, github, apps] = await Promise.all([
    fetchNewsletter(),
    fetchForum(opts),
    fetchAnalytics(),
    fetchLinkedIn(),
    fetchGitHub(opts),
    fetchQuranApps(),
  ]);
  return { newsletter, forum, analytics, linkedin, github, apps };
}
