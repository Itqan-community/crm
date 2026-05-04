// Shape returned by loadDashboardData(). Mirrors the design's `DATA`
// object (variant-creative.jsx + shared.jsx) so the components port
// over with minimal renaming.

export type WeekRange = {
  startISO: string; // ISO of Sunday 00:00 KSA in UTC
  endISO: string;
  hijriLabel: string;
  gregorianLabel: string;
  compareHijriLabel: string;
};

export type Channel = { k: string; v: number; d: number | null };
export type MixSlice = { k: string; v: number; c: string };
export type Breakdown = { k: string; v: number; c?: string };

export type MetricSource =
  | 'mailerlite'
  | 'stats:newsletter'
  | 'stats:forum'
  | 'stats:analytics'
  | 'stats:linkedin'
  | 'stats:github'
  | 'stats:apps'
  | 'manual'
  | 'mixed';

export type DashboardData = {
  range: WeekRange;
  community: {
    newsletter: {
      value: number;
      delta: number | null;
      rate: number; // 0..100
      prevRate: number;
      opened: number;
      sent: number;
      source: MetricSource;
    };
    engagement: {
      value: number;
      delta: number | null;
      breakdown: Breakdown[];
      source: MetricSource;
    };
    socialReach: {
      value: number;
      delta: number | null;
      channels: Channel[];
      source: MetricSource;
    };
    siteVisits: {
      value: number;
      delta: number | null;
      uniq: number;
      returning: number;
      source: MetricSource;
    };
  };
  platform: {
    publishers: { value: number; delta: number | null; new: number; source: MetricSource };
    beneficiaries: { value: number; delta: number | null; new: number; source: MetricSource };
    consumption: { value: number; delta: number | null; mix: MixSlice[]; source: MetricSource };
    shares: { value: number; delta: number | null; source: MetricSource };
  };
  // 8-week sparkline series, oldest → newest.
  series: {
    newsletter: { now: number[]; prev: number[] };
    engagement: { now: number[]; prev: number[] };
    socialReach: { now: number[]; prev: number[] };
    siteVisits: { now: number[]; prev: number[] };
    publishers: { now: number[]; prev: number[] };
    beneficiaries: { now: number[]; prev: number[] };
    consumption: { now: number[]; prev: number[] };
    shares: { now: number[]; prev: number[] };
  };
  // Hijri short labels for the 7 days of the current week (Sun..Sat).
  days: string[];
};
