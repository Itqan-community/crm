// Shared types for the stats integration. Each source module declares
// the shape of its return value here so the loader can compose them
// into a single typed bundle for the verification table.

export type DateRange = { start: Date; end: Date };

export type ChangeMetric = {
  value: number;
  // null when there's no comparable previous-window value (e.g. cumulative-only sources).
  prev: number | null;
};

// ---- Newsletter (MailerLite) -------------------------------------------------

export type NewsletterMetrics = {
  // Active subscribers as MailerLite reports them (the unique-people
  // count, not the daily activity).
  activeSubscribers: number;
  // Sent campaigns considered for the open/click averages.
  sampledCampaigns: number;
  // Average across the most recent N sent campaigns (0..100).
  avgOpenRate: number;
  avgClickRate: number;
  // Last sent campaign in the sample, for "freshness" display.
  lastCampaignAt: string | null;
  lastCampaignName: string | null;
  // Per-campaign rows from the most recent sent campaigns (newest first).
  recentCampaigns: Array<{
    id: string;
    name: string;
    subject: string;
    sentAt: string | null;
    sent: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
  }>;
};

// ---- GitHub ------------------------------------------------------------------

export type GithubMetrics = {
  org: string;
  // Counts in the requested window.
  commits: number;
  prsOpened: number;
  prsMerged: number;
  prsClosed: number;
  issuesOpened: number;
  // Org-wide totals (not window-bound).
  publicRepos: number;
  privateRepos: number;
  totalStars: number;
};

// ---- Google Analytics --------------------------------------------------------

export type AnalyticsMetrics = {
  // GA returns these as cumulative counts in the requested window.
  pageviews: ChangeMetric;
  activeUsers: ChangeMetric;
  sessions: ChangeMetric;
  // 0..100 (we convert from GA's 0..1 ratio).
  bounceRate: number;
  avgSessionSeconds: number;
  newUsers: number;
  topPages: Array<{ path: string; views: number }>;
  topCountries: Array<{ country: string; visitors: number }>;
};

// ---- Flarum (Forum) ----------------------------------------------------------

export type ForumMetrics = {
  // Cumulative across the forum's lifetime.
  totalUsers: number;
  totalDiscussions: number;
  totalPosts: number;
  totalLikes: number;
  // Window-bound (start..end).
  newUsers: number;
  newDiscussions: number;
  newPosts: number;
  activeUsers: number;
  avgPostsPerDiscussion: number;
};

// ---- Quran Apps Directory ----------------------------------------------------

export type QuranAppsMetrics = {
  totalApps: number;
  publishedApps: number;
  featuredApps: number;
  totalDevelopers: number;
  // Cumulative since the directory launched. Not a window — we flag
  // this in the table.
  totalViews: number;
  totalReviews: number;
  avgRating: number;
};

// ---- CMS (cms.itqan.dev) -----------------------------------------------------

export type CmsMetrics = {
  // Publishers (organizations) count.
  totalPublishers: number;
  verifiedPublishers: number;
  newPublishers30d: number;
  totalPublisherMembers: number;
  // Beneficiaries — public users on the CMS.
  totalUsers: number;
  newUsers30d: number;
  totalDevelopers: number;
  // Content volume — best-effort proxy for "consumption" until Mixpanel
  // is wired up. This is cumulative content count, not consumption.
  totalAssets: number;
  readyAssets: number;
  totalAssetsByCategory: Array<{ category: string; count: number }>;
};

// ---- Bundle ------------------------------------------------------------------

export type StatsErrorEntry = { source: string; message: string };

export type StatsBundle = {
  range: { start: string; end: string; days: number };
  newsletter: NewsletterMetrics | null;
  github: GithubMetrics | null;
  analytics: AnalyticsMetrics | null;
  forum: ForumMetrics | null;
  quranApps: QuranAppsMetrics | null;
  cms: CmsMetrics | null;
  errors: StatsErrorEntry[];
  generatedAt: string;
};
