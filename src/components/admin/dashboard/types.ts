export type SeriesPair = { now: number[]; prev: number[] };

export type DashboardData = {
  range: { label: string; compare: string };
  community: {
    newsletter: {
      value: number;
      delta: number;
      rate: number;
      prevRate: number;
      opened: number;
      sent: number;
    };
    engagement: {
      value: number;
      delta: number;
      breakdown: { k: string; v: number; c: string }[];
    };
    socialReach: {
      value: number;
      delta: number;
      channels: { k: string; v: number; d: number }[];
    };
    siteVisits: {
      value: number;
      delta: number;
      uniq: number;
      returning: number;
    };
  };
  platform: {
    publishers: { value: number; delta: number; new: number };
    beneficiaries: { value: number; delta: number; new: number };
    consumption: {
      value: number;
      delta: number;
      mix: { k: string; v: number; c: string }[];
    };
    shares: { value: number; delta: number };
  };
  series: Record<
    | 'newsletter'
    | 'engagement'
    | 'socialReach'
    | 'siteVisits'
    | 'publishers'
    | 'beneficiaries'
    | 'consumption'
    | 'shares',
    SeriesPair
  >;
  days: string[];
};
