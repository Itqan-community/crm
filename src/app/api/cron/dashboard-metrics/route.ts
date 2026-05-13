// Daily metric capture for the /admin dashboard.
//
//   GET  /api/cron/dashboard-metrics           → captures today's row
//   GET  /api/cron/dashboard-metrics?backfill=30 → backfills last N days
//
// Vercel Cron hits the GET (no body) once a day per vercel.json. The
// ?backfill query param is for one-off catchups — call it manually
// after deploying or after a source has been down.
//
// Auth: header `Authorization: Bearer ${CRON_SECRET}` is required.
// Vercel Cron sends this automatically when the project has a
// CRON_SECRET env var; manual invokes can use the same header.

import { NextResponse, type NextRequest } from 'next/server';
import { backfillDailyMetrics } from '@/lib/dashboard/backfill';
import { captureTodaySnapshot } from '@/lib/dashboard/capture';

export const dynamic = 'force-dynamic';
// Allow up to 5 minutes for the backfill path (Pro plans only — Hobby
// caps at 60s, so the cron path is fine but backfill on Hobby may
// need to be invoked once per source via query param).
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured → allow in dev so the developer can curl
    // the endpoint. Production should always set CRON_SECRET.
    return process.env.NODE_ENV !== 'production';
  }
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const backfillParam = url.searchParams.get('backfill');
  if (backfillParam) {
    const days = Math.max(1, Math.min(365, parseInt(backfillParam, 10) || 30));
    const result = await backfillDailyMetrics({ days });
    return NextResponse.json({ mode: 'backfill', ...result });
  }

  const { day, rows, written, skippedManual } = await captureTodaySnapshot();
  return NextResponse.json({
    mode: 'capture',
    day,
    rows: rows.map((r) => ({ key: r.metric_key, value: r.value })),
    written,
    skippedManual,
  });
}
