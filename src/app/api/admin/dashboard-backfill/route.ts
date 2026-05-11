// Admin-triggered backfill for dashboard_metric_daily. Authenticates
// via the Supabase session cookie (admin role required) — separate
// from /api/cron/dashboard-metrics which uses CRON_SECRET because
// Vercel Cron has no user session.

import { NextResponse, type NextRequest } from 'next/server';
import { backfillDailyMetrics } from '@/lib/dashboard/backfill';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Backfill walks several source DBs; give it enough headroom on Pro.
// Hobby plans cap at 60s — that's usually fine for 30 days, but
// reduce `days` if it times out.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { data: tm } = await supabase
    .from('team_members')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm || tm.role !== 'admin') {
    return NextResponse.json({ error: 'admin_required' }, { status: 403 });
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = Math.max(1, Math.min(365, parseInt(daysParam ?? '30', 10) || 30));

  const result = await backfillDailyMetrics({ days });
  return NextResponse.json(result);
}
