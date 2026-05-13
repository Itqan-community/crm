// Admin-triggered backfill for dashboard_metric_daily. Authenticates
// via the Supabase session cookie (admin role required) — separate
// from /api/cron/dashboard-metrics which uses CRON_SECRET because
// Vercel Cron has no user session.

import { NextResponse, type NextRequest } from 'next/server';
import { backfillDailyMetrics } from '@/lib/dashboard/backfill';
import { requireAdminApi } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';
// Backfill walks several source DBs; give it enough headroom on Pro.
// Hobby plans cap at 60s and would time out on a 120-day run — keep
// the project on Pro, or pass a smaller `?days=N` for the rare manual
// retry.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const days = Math.max(1, Math.min(365, parseInt(daysParam ?? '30', 10) || 30));

  const result = await backfillDailyMetrics({ days });
  return NextResponse.json(result);
}
