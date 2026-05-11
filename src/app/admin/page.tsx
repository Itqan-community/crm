import { Dashboard } from '@/components/admin/dashboard/Dashboard';
import { loadDashboardData } from '@/lib/dashboard/load';
import type { DashboardWindow } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const window: DashboardWindow = sp.window === 'day' ? 'day' : 'month';
  const data = await loadDashboardData(window);
  return <Dashboard data={data} window={window} />;
}
