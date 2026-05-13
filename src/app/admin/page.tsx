import { Dashboard } from '@/components/admin/dashboard/Dashboard';
import { loadDashboardData } from '@/lib/dashboard/load';
import { loadLastWeekForEdit } from '@/lib/dashboard/queries';
import type { DashboardWindow } from '@/lib/dashboard/types';
import { requireTeamPage } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const window: DashboardWindow =
    sp.window === 'day' || sp.window === 'month' ? sp.window : 'week';
  const anchorKey = typeof sp.date === 'string' ? sp.date : undefined;

  // Gates whether we ship the editable table at the bottom (admins
  // only) — non-admins still see all numbers, just no edit affordance.
  const { member } = await requireTeamPage();
  const isAdmin = member.role === 'admin';

  const [data, editable] = await Promise.all([
    loadDashboardData(window, anchorKey),
    isAdmin ? loadLastWeekForEdit() : Promise.resolve(null),
  ]);

  return <Dashboard data={data} window={window} editable={editable} />;
}
