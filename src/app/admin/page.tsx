import { Dashboard } from '@/components/admin/dashboard/Dashboard';
import { loadDashboardData } from '@/lib/dashboard/load';
import { loadLastWeekForEdit } from '@/lib/dashboard/queries';
import type { DashboardWindow } from '@/lib/dashboard/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

  // The layout already verified the user is in team_members. Cheap
  // role re-fetch here gates whether we ship the editable table at
  // the bottom (admins only) — non-admins still see all numbers,
  // just no edit affordance.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: tm } = user
    ? await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle()
    : { data: null };
  const isAdmin = tm?.role === 'admin';

  const [data, editable] = await Promise.all([
    loadDashboardData(window, anchorKey),
    isAdmin ? loadLastWeekForEdit() : Promise.resolve(null),
  ]);

  return <Dashboard data={data} window={window} editable={editable} />;
}
