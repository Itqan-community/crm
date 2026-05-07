import { AdminListClient } from '@/components/admin/AdminListClient';
import { type AdminView } from '@/components/admin/ViewToggle';
import {
  loadSubmissions,
  loadStatuses,
  loadCategories,
  loadTeam,
} from '@/lib/admin-queries';
import { loadActiveFormSchema } from '@/lib/form-schema';

export const dynamic = 'force-dynamic';

export default async function AdminSubmissions({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    assignee?: string;
    source?: string;
    view?: string;
    include_archived?: string;
  }>;
}) {
  const sp = await searchParams;
  const view: AdminView = sp.view === 'table' ? 'table' : 'kanban';
  const [rows, statuses, allCategories, team, schema] = await Promise.all([
    loadSubmissions(sp),
    loadStatuses(),
    // Filter dropdown shows every category (incl. inactive ones still tied to
    // legacy submissions); the manual-entry modal only offers active ones.
    loadCategories(true),
    loadTeam(),
    loadActiveFormSchema(),
  ]);

  return (
    <AdminListClient
      view={view}
      rows={rows}
      statuses={statuses}
      filterCategories={allCategories}
      activeCategories={schema.categories}
      fieldsByCategory={schema.fieldsByCategory}
      team={team}
    />
  );
}
