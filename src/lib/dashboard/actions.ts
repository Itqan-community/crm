'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction } from '@/lib/admin-guard';
import type { SocialChannelKey } from './types';
import { writeDailyRows, type MetricKey, type DailyRow } from './daily';
import { dateKey } from './calendar';

// Coerce a form-input string into a nullable integer. "" → null so the
// row column stays unset rather than defaulting to 0 (which would mean
// "we measured zero" — different semantics).
function toIntOrNull(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export type SaveSocialInput = {
  channel: SocialChannelKey;
  snapshot_date: string; // YYYY-MM-DD
  followers_total?: number | string | null;
  followers_new?: number | string | null;
  impressions?: number | string | null;
  page_views?: number | string | null;
  unique_visitors?: number | string | null;
  engagements?: number | string | null;
  extra?: Record<string, number | string | null>;
  notes?: string | null;
};

export async function saveSocialSnapshot(input: SaveSocialInput) {
  const { supabase, user } = await requireAdminAction();

  // Sanitize the extras blob — the form ships e.g. { likes: "31" } and
  // we want { likes: 31 } in the DB. Drop empty entries entirely so
  // jsonb stays minimal.
  const extra: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.extra ?? {})) {
    const n = toIntOrNull(v);
    if (n != null) extra[k] = n;
  }

  const row = {
    channel: input.channel,
    snapshot_date: input.snapshot_date,
    followers_total: toIntOrNull(input.followers_total),
    followers_new: toIntOrNull(input.followers_new),
    impressions: toIntOrNull(input.impressions),
    page_views: toIntOrNull(input.page_views),
    unique_visitors: toIntOrNull(input.unique_visitors),
    engagements: toIntOrNull(input.engagements),
    extra,
    notes: input.notes?.trim() || null,
    created_by: user.id,
  };

  const { error } = await supabase
    .from('dashboard_social_snapshots')
    .upsert(row, { onConflict: 'channel,snapshot_date' });
  if (error) throw new Error(error.message);

  // Bust the dashboard's cached render so the new numbers show up
  // immediately after save.
  revalidatePath('/admin');
  revalidatePath('/admin/settings/metrics');
}

// ---- Weekly metrics editor --------------------------------------------------

export type WeeklyMetricInput = {
  day: string; // YYYY-MM-DD
  metric_key: MetricKey;
  value: number | string;
  meta?: Record<string, number | string>;
};

// Bulk upsert from the MetricsTable on /admin. Sanitizes strings into
// integers/floats (the form ships e.g. "12" not 12) and drops empty
// meta fields so the jsonb stays minimal.
export async function saveWeeklyMetrics(input: WeeklyMetricInput[]) {
  await requireAdminAction();
  if (!Array.isArray(input) || input.length === 0) return { written: 0 };

  const rows: DailyRow[] = input.map((row) => {
    const meta: Record<string, number> = {};
    for (const [k, v] of Object.entries(row.meta ?? {})) {
      const n = toNumOrNull(v);
      if (n != null) meta[k] = n;
    }
    return {
      day: row.day,
      metric_key: row.metric_key,
      value: toNumOrNull(row.value) ?? 0,
      meta,
      // Admin-entered values are pinned: the cron/backfill won't
      // overwrite them on subsequent runs.
      is_manual: true,
    };
  });

  // preserveManual=false because THIS is the manual edit path. We
  // intentionally overwrite whatever's there (incl. prior manual
  // entries) with what the admin just typed.
  const result = await writeDailyRows(rows, { preserveManual: false });
  revalidatePath('/admin');
  return result;
}

function toNumOrNull(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ---- Cumulative snapshot (CMS metrics) ------------------------------------

// CMS metrics (publishers, beneficiaries, consumption) are CUMULATIVE
// running totals — the cron normally fills them via `stat_app_CMS_DB_URL`.
// When that env var isn't set (or the connection is failing), the admin
// needs a one-shot way to populate the cards without filling 7 cells
// per metric in the MetricsTable. This action writes today's row for
// any of the three keys you provide.
//
// `is_manual=true` is intentional: once the admin entered the truth,
// the daily cron/backfill must not overwrite it. To switch a metric
// back to live-sourced, the admin can re-enter the same value via the
// MetricsTable (preserveManual=false will refresh it) or, in a future
// pass, an explicit "unpin" toggle.
export type CumulativeSnapshotInput = {
  publishers?: number | string | null;
  beneficiaries?: number | string | null;
  consumption?: number | string | null;
};

const SNAPSHOTABLE_KEYS = ['publishers', 'beneficiaries', 'consumption'] as const;
type SnapshotKey = (typeof SNAPSHOTABLE_KEYS)[number];

function todayKey(): string {
  // YYYY-MM-DD in KSA wall time. Using UTC here would cause an admin
  // saving a snapshot at, say, 02:30 KSA to land under the previous
  // calendar day (21:30–24:00 UTC = next-day KSA), shifting the row by
  // ±1 day relative to the cron's KSA-anchored captures.
  return dateKey(new Date());
}

export async function saveCumulativeSnapshot(
  input: CumulativeSnapshotInput,
): Promise<{ written: number; day: string }> {
  await requireAdminAction();
  const day = todayKey();
  const rows: DailyRow[] = [];
  for (const key of SNAPSHOTABLE_KEYS) {
    const raw = input[key as keyof CumulativeSnapshotInput];
    const value = toNumOrNull(raw);
    // Skip empty inputs so admins can update one metric at a time
    // without clobbering the others.
    if (value == null) continue;
    rows.push({
      day,
      metric_key: key as SnapshotKey,
      value,
      meta: {},
      is_manual: true,
    });
  }
  if (rows.length === 0) return { written: 0, day };
  const { written } = await writeDailyRows(rows, { preserveManual: false });
  revalidatePath('/admin');
  revalidatePath('/admin/settings/metrics');
  return { written, day };
}
