import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/admin/Sidebar';
import { LogoutButton } from '@/components/admin/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Login + callback render outside this layout? No — they're under /admin.
  // We keep this layout for both states. If unauthenticated (and not on login),
  // middleware already redirects. But layout still renders /admin/login.
  // So we only render the chrome when we have a team_member row.
  let teamRole: string | null = null;
  if (user) {
    const { data: tm } = await supabase
      .from('team_members')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    teamRole = tm?.role ?? null;
    if (!teamRole) {
      // Authenticated but not on the team — push back to login with error.
      await supabase.auth.signOut();
      redirect('/admin/login?error=not_authorized');
    }
  }

  if (!user) {
    // Login page renders without chrome
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <Sidebar role={teamRole as 'admin' | 'member'} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: 'var(--rule-soft)' }}>
          <div className="text-[13px]" style={{ color: 'var(--muted)' }}>
            مرحباً، <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{user.email}</span>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
