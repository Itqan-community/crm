import { Dashboard } from '@/components/admin/dashboard/Dashboard';
import { DASHBOARD_DATA } from '@/lib/dashboard-mock';

export const dynamic = 'force-dynamic';

export default function AdminDashboardHome() {
  return <Dashboard data={DASHBOARD_DATA} />;
}
