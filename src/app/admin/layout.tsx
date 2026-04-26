import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/admin/Sidebar';
import { MobileNav } from '@/components/admin/MobileNav';
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
        <header
          className="border-b px-4 md:px-6 pb-3 flex items-center justify-between gap-3"
          style={{
            borderColor: 'var(--rule-soft)',
            // calc folds the safe-area inset into our existing 12px top
            // padding instead of stacking on top of it. On a notch-less
            // device this resolves to 12px; on iPhone with the notch /
            // Dynamic Island it grows by the inset, no double-padding.
            paddingTop: 'calc(12px + env(safe-area-inset-top))',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <MobileNav role={teamRole as 'admin' | 'member'} />
            <div className="text-[13px] truncate" style={{ color: 'var(--muted)' }}>
              مرحباً، <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{user.email}</span>
            </div>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
