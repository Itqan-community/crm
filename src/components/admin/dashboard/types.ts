export type SeriesPair = { now: number[]; prev: number[] };

export type DashboardData = {
  range: {
    // `label` and `compare` are the legacy headline strings — kept so
    // any older consumer keeps compiling. The new fields let the
    // toolbar render Hijri-primary + Gregorian-secondary, and drive a
    // date picker via `anchorKey`.
    label: string;
    compare: string;
    hijriLabel: string;
    gregorianLabel: string;
    compareHijriLabel: string;
    compareGregorianLabel: string;
    comparisonLabel: string;
    anchorKey: string; // YYYY-MM-DD KSA — canonical for URL `?date=`
  };
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
