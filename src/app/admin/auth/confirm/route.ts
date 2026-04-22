import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Email-template entry point. Supabase's default `{{ .ConfirmationURL }}`
// redirects through /auth/v1/verify, which for PKCE-flow tokens omits the
// `type` parameter and trips a "Verify requires a verification type" error.
// We route the magic link directly to this handler with {token_hash, type}
// from {{ .TokenHash }} + a hardcoded type, then call verifyOtp ourselves.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') || 'magiclink') as EmailOtpType;
  const next = url.searchParams.get('next') || '/admin';
  const origin = url.origin;

  if (!token_hash) {
    return NextResponse.redirect(new URL('/admin/login?error=missing_token', origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data: verifyData, error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error || !verifyData.user) {
    return NextResponse.redirect(
      new URL(`/admin/login?error=${encodeURIComponent(error?.message || 'verify_failed')}`, origin),
    );
  }

  const email = verifyData.user.email;
  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/admin/login?error=no_email', origin));
  }

  // Allow-list check against allowed_emails (bypass RLS via service role).
  const admin = createSupabaseAdminClient();
  const { data: allowed } = await admin
    .from('allowed_emails')
    .select('email, role')
    .ilike('email', email)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/admin/login?error=not_authorized', origin));
  }

  // Bootstrap team_members row if the DB trigger hasn't (e.g. allowed_emails
  // added after sign-up). Idempotent.
  await admin.from('team_members').upsert(
    {
      id: verifyData.user.id,
      email,
      full_name: verifyData.user.user_metadata?.full_name || email,
      role: allowed.role,
    },
    { onConflict: 'id' },
  );

  return NextResponse.redirect(new URL(next, origin));
}
