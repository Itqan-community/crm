import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Magic-link callback. Supabase appends `?code=…` (PKCE) on the redirect.
// We exchange the code for a session, then check that the email is in
// allowed_emails — otherwise we sign out and bounce back with an error.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/admin';
  // Use the request's own origin so the redirect always returns to the host
  // the user signed in from (Vercel preview, custom domain, localhost, …).
  const siteUrl = url.origin;

  if (!code) {
    return NextResponse.redirect(new URL('/admin/login?error=missing_code', siteUrl));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent(error.message)}`, siteUrl));
  }

  // Now check authorisation against allowed_emails
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/admin/login?error=no_email', siteUrl));
  }

  // Use admin client to read allowed_emails (RLS would otherwise hide it from non-team users)
  const admin = createSupabaseAdminClient();
  const { data: allowed } = await admin
    .from('allowed_emails')
    .select('email, role')
    .ilike('email', user.email)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/admin/login?error=not_authorized', siteUrl));
  }

  // Bootstrap team_members row if the auth trigger hasn't (e.g. allowed_emails added after sign-up).
  await admin.from('team_members').upsert(
    { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.email, role: allowed.role },
    { onConflict: 'id' },
  );

  return NextResponse.redirect(new URL(next, siteUrl));
}
