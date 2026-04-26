import { FilterBar } from '@/components/admin/FilterBar';
import { ViewToggle, type AdminView } from '@/components/admin/ViewToggle';
import { KanbanBoard } from '@/components/admin/KanbanBoard';
import { SubmissionsTable } from '@/components/admin/SubmissionsTable';
import {
  loadSubmissions,
  loadStatuses,
  loadCategories,
  loadTeam,
} from '@/lib/admin-queries';

export const dynamic = 'force-dynamic';

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    assignee?: string;
    view?: string;
    include_archived?: string;
  }>;
}) {
  const sp = await searchParams;
  const view: AdminView = sp.view === 'kanban' ? 'kanban' : 'table';
  const [rows, statuses, categories, team] = await Promise.all([
    loadSubmissions(sp),
    loadStatuses(),
    loadCategories(true),
    loadTeam(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold">الطلبات</h1>
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{rows.length} نتيجة</span>
        </div>
        <ViewToggle current={view} />
      </div>

      <FilterBar categories={categories} statuses={statuses} team={team} />

      {view === 'kanban' ? (
        <KanbanBoard submissions={rows} statuses={statuses} />
      ) : (
        <SubmissionsTable rows={rows} />
      )}
    </div>
  );
}
