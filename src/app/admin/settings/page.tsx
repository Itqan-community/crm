import { loadStatuses, loadTeam, loadAllowedEmails } from '@/lib/admin-queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StatusesAdmin } from '@/components/admin/StatusesAdmin';
import { TeamAdmin } from '@/components/admin/TeamAdmin';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: tm } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle();
  if (tm?.role !== 'admin') {
    return <div className="text-[14px]" style={{ color: 'var(--muted)' }}>هذه الصفحة متاحة للأدمن فقط.</div>;
  }

  const [statuses, team, allowed] = await Promise.all([loadStatuses(), loadTeam(), loadAllowedEmails()]);

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-[22px] font-semibold">الإعدادات</h1>
      <StatusesAdmin statuses={statuses} />
      <TeamAdmin team={team} allowed={allowed} />
    </div>
  );
}
