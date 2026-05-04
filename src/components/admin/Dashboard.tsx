import { loadDashboardData } from '@/lib/dashboard-queries';
import { DashboardToolbar } from './dashboard/Toolbar';
import { HeroBand } from './dashboard/HeroBand';
import { CommunitySection } from './dashboard/CommunitySection';
import { PlatformSection } from './dashboard/PlatformSection';

export async function Dashboard() {
  const data = await loadDashboardData();
  return (
    <div className="dash-amb" style={{ marginInline: -16, padding: 16, borderRadius: 16 }}>
      <DashboardToolbar data={data} />
      <HeroBand data={data} />
      <CommunitySection data={data} />
      <PlatformSection data={data} />
    </div>
  );
}
