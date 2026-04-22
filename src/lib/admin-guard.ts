import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';

// Page-level guards. Throw via Next's redirect() for unauthenticated users
// and return a sentinel for missing permissions so the page can render a
// dedicated "access denied" view if it wants. Use these in Server Components.

export async function requireTeamPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: tm } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm) redirect('/admin/login?error=not_authorized');
  return { supabase, user, member: tm as { id: string; role: 'admin' | 'member' } };
}

export async function requireAdminPage() {
  const ctx = await requireTeamPage();
  if (ctx.member.role !== 'admin') {
    return { ...ctx, allowed: false as const };
  }
  return { ...ctx, allowed: true as const };
}
