// Helpers around the dashboard_metric_daily table — daily KPI
// snapshots that drive the hero area chart and the per-card
// sparklines.

import { createSupabaseServerClient } from '@/lib/supabase/server';

// Snake-case keys to match column convention. The adapter (load.ts)
// maps these to the camelCase DashboardData series names.
export type MetricKey =
  | 'engagement'
  | 'newsletter'
  | 'social_reach'
  | 'site_visits'
  | 'publishers'
  | 'beneficiaries'
  | 'consumption'
  | 'shares';

export const ALL_METRIC_KEYS: MetricKey[] = [
  'engagement',
  'newsletter',
  'social_reach',
  'site_visits',
  'publishers',
  'beneficiaries',
  'consumption',
  'shares',
];

// Per-metric sub-fields the dashboard cares about. Stored in the
// `meta` jsonb column alongside the headline value so /admin can
// render the full surface from a single internal query — no live
// source hits in the hot path.
export type MetricMeta = {
  newsletter?: { rate?: number; prevRate?: number; opened?: number };
  site_visits?: { uniq?: number; returning?: number };
  engagement?: { replies?: number; likes?: number; mentions?: number; shares?: number };
  consumption?: { reads?: number; downloads?: number; listens?: number; shares?: number };
  publishers?: { new_30d?: number };
  beneficiaries?: { new_30d?: number };
};

export type DailyRow = {
  day: string;
  metric_key: MetricKey;
  value: number;
  meta?: Record<string, unknown>;
};

export type LatestSnapshot = {
  value: number;
  delta: number;
  previousValue: number;
  meta: Record<string, unknown>;
};

// Read the last 2N days of a metric and split into now / prev so the
// chart can render both lines. Returns empty arrays when there isn't
// enough history to split — the caller's empty-data guard then hides
// the chart.
export async function loadDailySeries(
  metric: MetricKey,
  days = 7,
): Promise<{ now: number[]; prev: number[] }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('dashboard_metric_daily')
    .select('day, value')
    .eq('metric_key', metric)
    .order('day', { ascending: false })
    .limit(days * 2);
  if (!data || data.length < 2) return { now: [], prev: [] };
  // Oldest → newest so the chart reads left-to-right (the SVG itself
  // is mirrored by RTL on the parent).
  const ordered = data.slice().reverse().map((r) => Number(r.value));
  // Right half = "now", left half = "prev". When we have fewer than
  // 2N points the prev side just gets fewer dots (the dashed line
  // shortens but the chart still renders).
  const splitAt = Math.max(0, ordered.length - days);
  return {
    now: ordered.slice(splitAt),
    prev: ordered.slice(0, splitAt),
  };
}

export async function loadAllSeries(days = 7): Promise<Record<MetricKey, { now: number[]; prev: number[] }>> {
  const entries = await Promise.all(
    ALL_METRIC_KEYS.map(async (k) => [k, await loadDailySeries(k, days)] as const),
  );
  return Object.fromEntries(entries) as Record<MetricKey, { now: number[]; prev: number[] }>;
}

// Upsert today's (or any given day's) values. Used by the daily cron
// and by the backfill function.
export async function writeDailyRows(rows: DailyRow[]): Promise<{ written: number }> {
  if (rows.length === 0) return { written: 0 };
  const supabase = await createSupabaseServerClient();
  // Normalize each row so meta always lands as an object (not undefined)
  // — keeps the DB default behaviour predictable.
  const normalized = rows.map((r) => ({ ...r, meta: r.meta ?? {} }));
  const { error } = await supabase
    .from('dashboard_metric_daily')
    .upsert(normalized, { onConflict: 'day,metric_key' });
  if (error) throw new Error(error.message);
  return { written: rows.length };
}

// Pull the latest snapshot per metric plus the row from `offsetDays`
// ago so the adapter can compute deltas. Single query — feeds the
// entire dashboard without touching live sources.
export async function loadLatestSnapshots(offsetDays: number): Promise<Map<MetricKey, LatestSnapshot>> {
  const supabase = await createSupabaseServerClient();
  // Cap the fetch at offset + a buffer so we don't pull the whole
  // table when daily history grows past 30 days. 8 metrics × ~40 days
  // is still tiny.
  const { data } = await supabase
    .from('dashboard_metric_daily')
    .select('day, metric_key, value, meta')
    .order('day', { ascending: false })
    .limit((offsetDays + 5) * ALL_METRIC_KEYS.length);
  const byMetric = new Map<MetricKey, Array<{ value: number; meta: Record<string, unknown> }>>();
  for (const row of data ?? []) {
    const key = row.metric_key as MetricKey;
    if (!byMetric.has(key)) byMetric.set(key, []);
    byMetric.get(key)!.push({
      value: Number(row.value),
      meta: (row.meta as Record<string, unknown>) ?? {},
    });
  }
  const out = new Map<MetricKey, LatestSnapshot>();
  for (const [k, rows] of byMetric) {
    const latest = rows[0];
    // Pick the row offsetDays back if it exists; otherwise the oldest
    // we have (the delta narrows to "since the table started").
    const previous = rows[Math.min(rows.length - 1, offsetDays)] ?? latest;
    const delta =
      previous.value > 0
        ? ((latest.value - previous.value) / previous.value) * 100
        : 0;
    out.set(k, {
      value: latest.value,
      previousValue: previous.value,
      delta: Math.round(delta * 10) / 10,
      meta: latest.meta,
    });
  }
  return out;
}

// Today as YYYY-MM-DD in the server's local TZ. Good enough — the
// dashboard buckets are day-granularity and we never compare across
// timezones.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
