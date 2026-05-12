// Helpers around the dashboard_metric_daily table — daily KPI
// snapshots that drive the hero area chart and the per-card
// sparklines.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  addDays,
  addWeeks,
  dateKey,
  endOfKsaWeek,
  startOfKsaWeek,
  type PeriodRange,
} from './calendar';

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
    // If this lookup fails we'd treat every row as non-manual and
    // potentially overwrite pinned values — surface the error
    // instead. There's a small TOCTOU window between this SELECT and
    // the UPSERT below (a row becoming manual in between would still
    // get overwritten); the proper fix is a DB-side RPC with
    // `... WHERE is_manual = false` — tracked as a follow-up.
    const { data: manualRows, error: manualErr } = await supabase
      .from('dashboard_metric_daily')
      .select('day, metric_key')
      .in('day', days)
      .in('metric_key', keys)
      .eq('is_manual', true);
    if (manualErr) throw new Error(`preserveManual lookup failed: ${manualErr.message}`);
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

// Period-aware aggregation. The toolbar picks a SPECIFIC period via
// the URL (?window=&date=YYYY-MM-DD), and we report values scoped to
// that period — not the trailing-N-days from today. Semantics:
//   - flow:       value = Σ rows whose day ∈ [current.start, current.end].
//                 previousValue = same Σ over the previous period.
//                 meta = per-field sum of those daily metas.
//   - cumulative: value = latest reading on or before current.end.
//                 previousValue = latest reading on or before previous.end.
//                 meta = the current reading's meta (rates etc).
//
// One Supabase round-trip pulls rows over the combined (previous.start ..
// current.end) range with a small earlier-window padding so cumulative
// metrics can find a fallback reading before the start of `previous`.
export async function loadLatestSnapshots(
  current: PeriodRange,
  previous: PeriodRange,
): Promise<Map<MetricKey, LatestSnapshot>> {
  const supabase = await createSupabaseServerClient();
  // Pad the earlier end of the lookup by ~30 days so cumulative
  // fallback (latest row <= period end) still resolves when the
  // period falls before our first snapshot.
  const fromKey = dateKey(addDays(previous.start, -30));
  const toKey = dateKey(current.end);
  const { data, error } = await supabase
    .from('dashboard_metric_daily')
    .select('day, metric_key, value, meta')
    .gte('day', fromKey)
    .lte('day', toKey)
    .order('day', { ascending: false });
  if (error) throw new Error(`loadLatestSnapshots failed: ${error.message}`);

  const byMetric = new Map<
    MetricKey,
    Array<{ day: string; value: number; meta: Record<string, unknown> }>
  >();
  for (const row of data ?? []) {
    const k = row.metric_key as MetricKey;
    if (!byMetric.has(k)) byMetric.set(k, []);
    byMetric.get(k)!.push({
      day: row.day as string,
      value: Number(row.value),
      meta: (row.meta as Record<string, unknown>) ?? {},
    });
  }

  const curStart = dateKey(current.start);
  const curEnd = dateKey(current.end);
  const prevStart = dateKey(previous.start);
  const prevEnd = dateKey(previous.end);

  const out = new Map<MetricKey, LatestSnapshot>();
  // Make sure every metric we know about gets a snapshot — even ones
  // with no rows yet, so the UI doesn't render a card with missing
  // fields. Zero-fill with no meta.
  for (const k of ALL_METRIC_KEYS) {
    const rows = byMetric.get(k) ?? [];
    const sem = METRIC_SEMANTIC[k];

    let value: number;
    let previousValue: number;
    let meta: Record<string, unknown>;
    if (sem === 'flow') {
      const inCur = rows.filter((r) => r.day >= curStart && r.day <= curEnd);
      const inPrev = rows.filter((r) => r.day >= prevStart && r.day <= prevEnd);
      value = inCur.reduce((s, r) => s + r.value, 0);
      previousValue = inPrev.reduce((s, r) => s + r.value, 0);
      meta = sumMetaNumbers(inCur.map((r) => r.meta));
    } else {
      // rows are already day-DESC, so .find() gives the latest match.
      const curLatest = rows.find((r) => r.day <= curEnd);
      const prevLatest = rows.find((r) => r.day <= prevEnd);
      value = curLatest?.value ?? 0;
      previousValue = prevLatest?.value ?? 0;
      meta = curLatest?.meta ?? {};
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
export async function loadCalendarWeekSeries(
  anchor: Date,
): Promise<Record<MetricKey, { now: number[]; prev: number[] }>> {
  const supabase = await createSupabaseServerClient();
  // KSA Sun-Sat week containing the anchor (matches the picker
  // contract — the toolbar already canonicalizes week anchors to a
  // Sunday, so this is a no-op for week-window navigation; day-window
  // navigation gets the containing week, which is what the user
  // expects to see in the chart).
  const sunday = startOfKsaWeek(anchor);
  const saturday = endOfKsaWeek(anchor);
  const prevSunday = addWeeks(sunday, -1);

  const { data, error } = await supabase
    .from('dashboard_metric_daily')
    .select('day, metric_key, value')
    .gte('day', dateKey(prevSunday))
    .lte('day', dateKey(saturday));
  if (error) throw new Error(`loadCalendarWeekSeries failed: ${error.message}`);

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
      const cur = addDays(sunday, dowIdx);
      const last = addDays(prevSunday, dowIdx);
      // Future days in the current week shouldn't fabricate a value.
      const todayKey = dateKey(new Date());
      const curKey = dateKey(cur);
      now.push(curKey > todayKey ? 0 : byDay.get(curKey) ?? 0);
      prev.push(byDay.get(dateKey(last)) ?? 0);
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
