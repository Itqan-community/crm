import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from './supabase/server';
import type { User } from '@supabase/supabase-js';

// Single source of truth for "is this request from a signed-in team
// member, and what's their role." Used by page guards (redirect on
// fail), server actions (throw on fail), and API routes (JSON 4xx).

type Member = { id: string; role: 'admin' | 'member' };
type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AuthContext = {
  supabase: SupabaseClient;
  user: User;
  member: Member;
};

// Returns null on signed-out OR signed-in-but-not-on-team so the
// caller can pick a failure mode. The auth check is one
// `auth.getUser()` + one `team_members` SELECT — same shape every
// caller used to inline.
async function loadAuthContext(): Promise<
  | { kind: 'ok'; ctx: AuthContext }
  | { kind: 'unauthenticated'; supabase: SupabaseClient }
  | { kind: 'forbidden'; supabase: SupabaseClient; user: User }
> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: 'unauthenticated', supabase };
  const { data: tm } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm) return { kind: 'forbidden', supabase, user };
  return { kind: 'ok', ctx: { supabase, user, member: tm as Member } };
}

// ---- Page guards (redirect on fail) ---------------------------------------

export async function requireTeamPage(): Promise<AuthContext> {
  const result = await loadAuthContext();
  if (result.kind === 'unauthenticated') redirect('/admin/login');
  if (result.kind === 'forbidden') {
    // Signed in but not on the team — drop the session so the
    // /admin/login page renders cleanly without "logout first".
    await result.supabase.auth.signOut();
    redirect('/admin/login?error=not_authorized');
  }
  return result.ctx;
}

// Returns `allowed: false` when the team member isn't an admin so the
// page can render a non-admin view instead of redirecting.
export async function requireAdminPage(): Promise<AuthContext & { allowed: boolean }> {
  const ctx = await requireTeamPage();
  return { ...ctx, allowed: ctx.member.role === 'admin' };
}

// ---- Action guards (throw on fail) ----------------------------------------

export async function requireTeamAction(): Promise<AuthContext> {
  const result = await loadAuthContext();
  if (result.kind === 'unauthenticated') throw new Error('unauthenticated');
  if (result.kind === 'forbidden') throw new Error('forbidden');
  return result.ctx;
}

export async function requireAdminAction(): Promise<AuthContext> {
  const ctx = await requireTeamAction();
  if (ctx.member.role !== 'admin') throw new Error('admin_required');
  return ctx;
}

// ---- API-route guard (returns NextResponse on fail) -----------------------

export async function requireAdminApi(): Promise<
  { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse }
> {
  const result = await loadAuthContext();
  if (result.kind === 'unauthenticated') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }),
    };
  }
  if (result.kind === 'forbidden') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    };
  }
  if (result.ctx.member.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'admin_required' }, { status: 403 }),
    };
  }
  return { ok: true, ctx: result.ctx };
}
