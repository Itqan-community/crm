import { loadStatuses, loadTeam, loadAllowedEmails } from '@/lib/admin-queries';
import { requireAdminPage } from '@/lib/admin-guard';
import { AdminOnlyNotice } from '@/components/admin/AdminOnlyNotice';
import { StatusesAdmin } from '@/components/admin/StatusesAdmin';
import { TeamAdmin } from '@/components/admin/TeamAdmin';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await requireAdminPage();
  if (!ctx.allowed) return <AdminOnlyNotice />;

  const [statuses, team, allowed] = await Promise.all([loadStatuses(), loadTeam(), loadAllowedEmails()]);

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-[22px] font-semibold">الإعدادات</h1>
      <StatusesAdmin statuses={statuses} />
      <TeamAdmin team={team} allowed={allowed} />
    </div>
  );
}
