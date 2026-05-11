// Shared types for the dashboard adapter (separate from the UI-facing
// DashboardData in src/components/admin/dashboard/types.ts so the DB
// row shape lives next to the queries that produce it).

export type DashboardWindow = 'day' | 'week' | 'month';

export const WINDOW_DAYS: Record<DashboardWindow, number> = {
  day: 1,
  week: 7,
  month: 30,
};

export type SocialChannelKey =
  | 'linkedin'
  | 'facebook'
  | 'x'
  | 'instagram'
  | 'youtube';

export type SocialSnapshot = {
  id: string;
  channel: SocialChannelKey;
  snapshot_date: string;
  followers_total: number | null;
  followers_new: number | null;
  impressions: number | null;
  page_views: number | null;
  unique_visitors: number | null;
  engagements: number | null;
  extra: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const SOCIAL_LABELS: Record<SocialChannelKey, string> = {
  linkedin: 'لينكدإن',
  facebook: 'فيسبوك',
  x: 'X (تويتر)',
  instagram: 'إنستقرام',
  youtube: 'يوتيوب',
};

// Channels we display in the dashboard (in this order). Adding a new
// channel here + a snapshot row makes it appear automatically.
export const DISPLAYED_CHANNELS: SocialChannelKey[] = ['x', 'linkedin', 'facebook'];
