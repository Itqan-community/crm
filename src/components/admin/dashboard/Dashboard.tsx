import { Toolbar } from './Toolbar';
import { HeroBand } from './HeroBand';
import { CommunitySection } from './CommunitySection';
import { PlatformSection } from './PlatformSection';
import type { DashboardData } from './types';

export function Dashboard({ data }: { data: DashboardData }) {
  return (
    // Negative margin escapes AdminLayout's <main className="p-4 md:p-6"> so
    // the gradient backdrop fills the viewport edge-to-edge.
    <div className="-m-4 md:-m-6">
      <div
        style={{
          minHeight: 'calc(100vh - 60px)',
          background: `
            radial-gradient(900px 600px at 85% -5%, rgba(148,110,82,0.22), transparent 55%),
            radial-gradient(800px 700px at -10% 50%, rgba(27,67,50,0.18), transparent 60%),
            radial-gradient(700px 500px at 60% 100%, rgba(212,180,131,0.14), transparent 60%),
            var(--bg)
          `,
        }}
      >
        <Toolbar range={data.range} />
        <div style={{ padding: 24 }}>
          <HeroBand data={data} />
          <CommunitySection data={data.community} series={data.series} />
          <PlatformSection data={data.platform} series={data.series} />
        </div>
      </div>
    </div>
  );
}
