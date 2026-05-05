'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  FormCategoryRow,
  FormFieldRow,
  StatusRow,
  TeamMemberRow,
} from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';
import { FilterBar } from './FilterBar';
import { ViewToggle, type AdminView } from './ViewToggle';
import { KanbanBoard } from './KanbanBoard';
import { SubmissionsTable } from './SubmissionsTable';
import { CreateSubmissionDialog } from './CreateSubmissionDialog';

type Props = {
  view: AdminView;
  rows: SubmissionListRow[];
  statuses: StatusRow[];
  // The full set used in the FilterBar dropdown (includes inactive categories
  // that still appear on legacy submissions).
  filterCategories: FormCategoryRow[];
  // Only active categories surface in the manual-entry modal.
  activeCategories: FormCategoryRow[];
  fieldsByCategory: Record<string, FormFieldRow[]>;
  team: TeamMemberRow[];
};

// Wraps the submissions list so we can hold locally-created (FE-only) rows
// in client state and merge them into whichever view is active. Once the
// backend phase wires manual entry to Supabase, this layer collapses back
// down to passing server rows straight through.
export function AdminListClient({
  view,
  rows,
  statuses,
  filterCategories,
  activeCategories,
  fieldsByCategory,
  team,
}: Props) {
  const sp = useSearchParams();
  const sourceFilter = sp.get('source') ?? '';

  const [localRows, setLocalRows] = useState<SubmissionListRow[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const merged = useMemo(() => {
    const all = [...localRows, ...rows];
    if (!sourceFilter) return all;
    return all.filter((r) => (r.source?.channel ?? 'form') === sourceFilter);
  }, [localRows, rows, sourceFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold">الطلبات</h1>
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
            {merged.length} نتيجة
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <span aria-hidden="true">+</span>
            <span>إضافة طلب / Add submission</span>
          </button>
          <ViewToggle current={view} />
        </div>
      </div>

      <FilterBar categories={filterCategories} statuses={statuses} team={team} />

      {toast && (
        <div
          role="status"
          className="mb-3 px-3 py-2 rounded-lg border text-[13px]"
          style={{
            borderColor: 'var(--rule)',
            background: 'var(--option-bg-selected)',
            color: 'var(--fg)',
          }}
        >
          {toast}
        </div>
      )}

      {view === 'kanban' ? (
        <KanbanBoard submissions={merged} statuses={statuses} />
      ) : (
        <SubmissionsTable rows={merged} />
      )}

      <CreateSubmissionDialog
        open={openModal}
        categories={activeCategories}
        fieldsByCategory={fieldsByCategory}
        statuses={statuses}
        onClose={() => setOpenModal(false)}
        onCreated={(row) => {
          setLocalRows((prev) => [row, ...prev]);
          setOpenModal(false);
          setToast('تمت إضافة الطلب محليًا — لم يُحفظ في قاعدة البيانات بعد.');
          window.setTimeout(() => setToast(null), 4000);
        }}
      />
    </div>
  );
}
