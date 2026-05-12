import { requireAdminPage } from '@/lib/admin-guard';
import { AdminOnlyNotice } from '@/components/admin/AdminOnlyNotice';
import { SocialMetricsAdmin } from '@/components/admin/dashboard/SocialMetricsAdmin';
import { CmsSnapshotForm } from '@/components/admin/dashboard/CmsSnapshotForm';
import { BackfillButton } from '@/components/admin/dashboard/BackfillButton';
import { RawCampaignsInspector } from '@/components/admin/dashboard/RawCampaignsInspector';
import {
  loadCumulativeSnapshots,
  loadSocialEditorRows,
} from '@/lib/dashboard/queries';

export const dynamic = 'force-dynamic';

export default async function MetricsSettingsPage() {
  const ctx = await requireAdminPage();
  if (!ctx.allowed) return <AdminOnlyNotice />;

  const [socialRows, cmsRows] = await Promise.all([
    loadSocialEditorRows(),
    loadCumulativeSnapshots(),
  ]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold">بيانات اللوحة (إدخال يدوي)</h1>
        <p className="text-[13px] mt-2" style={{ color: 'var(--muted)' }}>
          البيانات التي لا يمكن جلبها تلقائياً من المصادر — أدخلها هنا
          وستظهر فوراً في{' '}
          <a href="/admin" style={{ color: 'var(--accent)' }}>لوحة البيانات</a>.
        </p>
      </div>

      <SocialMetricsAdmin rows={socialRows} />
      <CmsSnapshotForm rows={cmsRows} />
      <BackfillButton days={120} />
      <RawCampaignsInspector />
    </div>
  );
}
