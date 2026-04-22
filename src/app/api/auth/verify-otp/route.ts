import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { EMAIL_REGEX } from '@/lib/validation';

// Server-side OTP verification. Client posts {email, token}; we exchange
// with Supabase, gate on allowed_emails, and bootstrap the team_members
// row if needed. Cookies are set automatically by the SSR client.
export async function POST(req: Request) {
  let body: { email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const token = body.token?.trim();
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!token || !/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) {
    return NextResponse.json(
      { error: 'verify_failed', detail: error?.message || 'unknown' },
      { status: 400 },
    );
  }

  // Allow-list gate (bypass RLS via service role).
  const admin = createSupabaseAdminClient();
  const { data: allowed } = await admin
    .from('allowed_emails')
    .select('email, role')
    .ilike('email', email)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: 'not_authorized' }, { status: 403 });
  }

  // Bootstrap the team_members row. Idempotent — handles both first sign-in
  // (DB trigger may have fired) and repeat sign-ins for users who were
  // added to allowed_emails after their auth.users row was created.
  await admin.from('team_members').upsert(
    {
      id: data.user.id,
      email,
      full_name: data.user.user_metadata?.full_name || email,
      role: allowed.role,
    },
    { onConflict: 'id' },
  );

  return NextResponse.json({ ok: true });
}
