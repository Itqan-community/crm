import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { EMAIL_REGEX } from '@/lib/validation';

// Gate Supabase OTP sending behind the allowed_emails allow-list.
// Calling supabase.auth.signInWithOtp directly from the browser would
// happily send a code to anyone (and burn through Supabase's rate limit
// on unauthorised attempts), so we route the request through here:
//   1. Validate the email shape.
//   2. Check it's in allowed_emails (service-role read, bypasses RLS).
//   3. Only then ask Supabase to send the OTP.
// The browser receives a clear authorisation error before any email is
// dispatched.
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: allowed } = await admin
    .from('allowed_emails')
    .select('email')
    .ilike('email', email)
    .maybeSingle();

  if (!allowed) {
    return NextResponse.json({ error: 'not_authorized' }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    // Translate Supabase's known errors so the client doesn't have to
    // string-match English messages.
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('rate limit') || error.status === 429) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    console.error('[request-otp] signInWithOtp failed', error);
    return NextResponse.json({ error: 'send_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
