'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SocialChannelKey } from './types';
import { writeDailyRows, type MetricKey, type DailyRow } from './daily';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthenticated');
  const { data: tm } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm) throw new Error('forbidden');
  if (tm.role !== 'admin') throw new Error('admin_required');
  return { supabase, user };
}

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
  const { supabase, user } = await requireAdmin();

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
  await requireAdmin();
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
