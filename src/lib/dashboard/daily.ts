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

export type DailyRow = { day: string; metric_key: MetricKey; value: number };

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
  const { error } = await supabase
    .from('dashboard_metric_daily')
    .upsert(rows, { onConflict: 'day,metric_key' });
  if (error) throw new Error(error.message);
  return { written: rows.length };
}

// Today as YYYY-MM-DD in the server's local TZ. Good enough — the
// dashboard buckets are day-granularity and we never compare across
// timezones.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
