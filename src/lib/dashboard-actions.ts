'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from './supabase/server';
import { ALL_METRIC_KEYS } from './dashboard-queries';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthenticated');
  const { data: tm } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm) throw new Error('forbidden');
  if (tm.role !== 'admin') throw new Error('admin_required');
  return { supabase, user, member: tm };
}

const VALID_KEYS = new Set<string>(ALL_METRIC_KEYS);

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type MetricEntry = {
  weekStart: string; // 'YYYY-MM-DD' — Sunday in KSA
  metricKey: string;
  value: number;
};

export async function upsertWeeklyMetrics(entries: MetricEntry[]): Promise<{ ok: true }> {
  const ctx = await requireAdmin();
  if (!Array.isArray(entries) || entries.length === 0) return { ok: true };

  const rows: Array<{
    week_start: string;
    metric_key: string;
    value: number;
    updated_by: string;
  }> = [];
  for (const e of entries) {
    if (!WEEK_KEY_RE.test(e.weekStart)) throw new Error(`invalid_week:${e.weekStart}`);
    if (!VALID_KEYS.has(e.metricKey)) throw new Error(`invalid_metric:${e.metricKey}`);
    if (!Number.isFinite(e.value) || e.value < 0) throw new Error(`invalid_value:${e.metricKey}`);
    rows.push({
      week_start: e.weekStart,
      metric_key: e.metricKey,
      value: Math.round(e.value),
      updated_by: ctx.member.id,
    });
  }

  const { error } = await ctx.supabase
    .from('dashboard_metrics')
    .upsert(rows, { onConflict: 'week_start,metric_key' });
  if (error) throw new Error(error.message);

  revalidatePath('/admin');
  revalidatePath('/admin/settings/metrics');
  return { ok: true };
}
