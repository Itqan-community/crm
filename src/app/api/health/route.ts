import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const started = Date.now();
  let db: 'ok' | 'error' = 'ok';

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('form_categories')
      .select('*', { count: 'exact', head: true });
    if (error) db = 'error';
  } catch {
    db = 'error';
  }

  const body = {
    status: db === 'ok' ? ('ok' as const) : ('degraded' as const),
    db,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    latency_ms: Date.now() - started,
  };

  return NextResponse.json(body, { status: db === 'ok' ? 200 : 503 });
}
