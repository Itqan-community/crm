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

// "flow" metrics count something that happens within a day — for a
// week/month headline we sum them. "cumulative" metrics are running
// totals where the latest reading IS the headline; the delta then
// compares today's reading against the reading N days ago.
type MetricSemantic = 'flow' | 'cumulative';

const METRIC_SEMANTIC: Record<MetricKey, MetricSemantic> = {
  engagement:    'flow',
  newsletter:    'cumulative', // bursty — last campaign's sent count
  social_reach:  'cumulative', // followers/impressions at a point in time
  site_visits:   'flow',
  publishers:    'cumulative',
  beneficiaries: 'cumulative',
  consumption:   'cumulative',
  shares:        'cumulative', // total likes accrued, not per-day
};

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
  // When true, the row is a manual override from the admin metrics
  // table. Cron + backfill must NOT overwrite it.
  is_manual?: boolean;
};

export type LatestSnapshot = {
  value: number;
  delta: number;
  previousValue: number;
  meta: Record<string, unknown>;
};


// Upsert one or more (day, metric_key) rows.
//
// preserveManual = true (default) skips any existing row already
// flagged is_manual — used by the daily cron and the backfill so
// admin-entered values survive. preserveManual = false unconditionally
// overwrites, which is what the saveWeeklyMetrics action needs when
// the admin is editing a row through the UI.
export async function writeDailyRows(
  rows: DailyRow[],
  options: { preserveManual?: boolean } = {},
): Promise<{ written: number; skippedManual: number }> {
  if (rows.length === 0) return { written: 0, skippedManual: 0 };
  const supabase = await createSupabaseServerClient();
  const preserveManual = options.preserveManual ?? true;

  let rowsToWrite = rows;
  let skippedManual = 0;
  if (preserveManual) {
    // Query the manual-flagged set in the (day, metric_key) range
    // we're about to upsert; drop those rows from our batch so the
    // upsert never touches them.
    const days = Array.from(new Set(rows.map((r) => r.day)));
    const keys = Array.from(new Set(rows.map((r) => r.metric_key)));
    const { data: manualRows } = await supabase
      .from('dashboard_metric_daily')
      .select('day, metric_key')
      .in('day', days)
      .in('metric_key', keys)
      .eq('is_manual', true);
    const manualSet = new Set(
      (manualRows ?? []).map((r) => `${r.day}|${r.metric_key}`),
    );
    if (manualSet.size > 0) {
      rowsToWrite = rows.filter(
        (r) => !manualSet.has(`${r.day}|${r.metric_key}`),
      );
      skippedManual = rows.length - rowsToWrite.length;
    }
  }

  if (rowsToWrite.length === 0) return { written: 0, skippedManual };
  const normalized = rowsToWrite.map((r) => ({
    ...r,
    meta: r.meta ?? {},
    is_manual: r.is_manual ?? false,
  }));
  const { error } = await supabase
    .from('dashboard_metric_daily')
    .upsert(normalized, { onConflict: 'day,metric_key' });
  if (error) throw new Error(error.message);
  return { written: rowsToWrite.length, skippedManual };
}

// Window-aware aggregation. For each metric the value/delta semantics
// follow METRIC_SEMANTIC:
//   - flow:       value = Σ last windowDays daily readings.
//                 previousValue = Σ the windowDays before that.
//                 meta = per-field sum of those daily metas.
//   - cumulative: value = latest reading (today's row).
//                 previousValue = the row from windowDays ago.
//                 meta = latest reading's meta (rates are point-in-time).
// One Supabase round-trip drives the whole dashboard.
export async function loadLatestSnapshots(windowDays: number): Promise<Map<MetricKey, LatestSnapshot>> {
  const supabase = await createSupabaseServerClient();
  // Pull enough daily rows to cover this window AND the previous one
  // (for the delta comparison). +5 buffers against gaps.
  const rowsPerMetric = windowDays * 2 + 5;
  const { data } = await supabase
    .from('dashboard_metric_daily')
    .select('day, metric_key, value, meta')
    .order('day', { ascending: false })
    .limit(rowsPerMetric * ALL_METRIC_KEYS.length);
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
    const sem = METRIC_SEMANTIC[k];
    const nowRows = rows.slice(0, windowDays);
    const prevRows = rows.slice(windowDays, windowDays * 2);

    let value: number;
    let previousValue: number;
    let meta: Record<string, unknown>;
    if (sem === 'flow') {
      value = nowRows.reduce((s, r) => s + r.value, 0);
      previousValue = prevRows.reduce((s, r) => s + r.value, 0);
      meta = sumMetaNumbers(nowRows.map((r) => r.meta));
    } else {
      // Cumulative: latest reading is current state; the reading from
      // windowDays ago is what we compare against. If we have less
      // history than that, fall back to the oldest row we do have so
      // the delta narrows toward 0 instead of crashing.
      value = nowRows[0]?.value ?? 0;
      previousValue =
        prevRows[0]?.value ?? rows[rows.length - 1]?.value ?? 0;
      meta = nowRows[0]?.meta ?? {};
    }

    const delta = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;
    out.set(k, {
      value,
      previousValue,
      delta: Math.round(delta * 10) / 10,
      meta,
    });
  }
  return out;
}

function sumMetaNumbers(metas: Array<Record<string, unknown>>): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const m of metas) {
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === 'number') sum[k] = (sum[k] ?? 0) + v;
    }
  }
  return sum;
}

// Series for the hero area chart and the per-card sparklines —
// always the current calendar week (Sun→Sat). Data is built in
// REVERSE-weekday order: chart_data[0] = Saturday, chart_data[6] =
// Sunday. The chart SVG draws x left-to-right (SVG isn't mirrored
// by RTL parents), so index 0 lands at visual-left and index 6 at
// visual-right. Pairing this with Sunday-first labels rendered in
// an RTL flex row puts أحد on the right edge of both the labels
// and the data — week starts on Sunday as Arabic readers expect.
export async function loadCalendarWeekSeries(): Promise<
  Record<MetricKey, { now: number[]; prev: number[] }>
> {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = Sunday
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dow);
  const prevSunday = new Date(sunday);
  prevSunday.setDate(sunday.getDate() - 7);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const toKey = (d: Date) => d.toISOString().slice(0, 10);
  const { data } = await supabase
    .from('dashboard_metric_daily')
    .select('day, metric_key, value')
    .gte('day', toKey(prevSunday))
    .lte('day', toKey(saturday));

  // index by metric → day → value
  const byMetricDay = new Map<MetricKey, Map<string, number>>();
  for (const row of data ?? []) {
    const k = row.metric_key as MetricKey;
    if (!byMetricDay.has(k)) byMetricDay.set(k, new Map());
    byMetricDay.get(k)!.set(row.day, Number(row.value));
  }

  const result = {} as Record<MetricKey, { now: number[]; prev: number[] }>;
  for (const k of ALL_METRIC_KEYS) {
    const byDay = byMetricDay.get(k) ?? new Map<string, number>();
    const now: number[] = [];
    const prev: number[] = [];
    // dowIdx 6→0 = Sat→Sun, putting Sat at array[0] (SVG left) and
    // Sun at array[6] (SVG right = visual right in RTL parent).
    for (let dowIdx = 6; dowIdx >= 0; dowIdx--) {
      const cur = new Date(sunday);
      cur.setDate(sunday.getDate() + dowIdx);
      const last = new Date(prevSunday);
      last.setDate(prevSunday.getDate() + dowIdx);
      // Future days in the current week shouldn't fabricate a value.
      now.push(cur > today ? 0 : byDay.get(toKey(cur)) ?? 0);
      prev.push(byDay.get(toKey(last)) ?? 0);
    }
    result[k] = { now, prev };
  }
  return result;
}

// Today as YYYY-MM-DD in the server's local TZ. Good enough — the
// dashboard buckets are day-granularity and we never compare across
// timezones.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
