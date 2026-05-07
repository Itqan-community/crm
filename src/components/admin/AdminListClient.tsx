'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
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

// The bulk-import wizard pulls in papaparse + read-excel-file (~80 kB
// gzipped together). Defer its load until the operator actually clicks
// the import button so first-paint /admin stays light. The visible
// loading fallback also doubles as a diagnostic — if the chunk fails to
// resolve, the operator sees the placeholder instead of an empty screen.
const BulkImportDialog = dynamic(
  () => import('./BulkImportDialog').then((m) => ({ default: m.BulkImportDialog })),
  {
    ssr: false,
    loading: () => (
      <div
        className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4"
        role="status"
        aria-live="polite"
      >
        <div
          className="rounded-2xl px-5 py-4 border text-[13px]"
          style={{ background: 'var(--bg)', borderColor: 'var(--rule)', color: 'var(--muted)' }}
        >
          جارٍ تحميل واجهة الاستيراد…
        </div>
      </div>
    ),
  },
);

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

// Owns the modal open state, the source-filter, and a transient success
// toast. Filtering by source is applied client-side because the existing
// filter bar already pushes URL state and the source column is cheap to
// filter in JS for the 200-row page size.
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

  const [openModal, setOpenModal] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // One timer at a time. Without clearing, an older 4-second timer from
  // toast #1 will hide toast #2 prematurely if they land within the
  // window. Hold the handle in a ref so we can cancel on each new show.
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, ms = 4000) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  // Clean up if the component unmounts mid-toast.
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const filtered = useMemo(() => {
    if (!sourceFilter) return rows;
    return rows.filter((r) => r.source.channel === sourceFilter);
  }, [rows, sourceFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold">الطلبات</h1>
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
            {filtered.length} نتيجة
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] transition"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          >
            <span aria-hidden="true">⇪</span>
            <span>استيراد ملف</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <span aria-hidden="true">+</span>
            <span>إضافة طلب</span>
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
        <KanbanBoard submissions={filtered} statuses={statuses} />
      ) : (
        <SubmissionsTable rows={filtered} />
      )}

      {/*
       * Dialogs are mounted only while open. The parent owns the lifecycle
       * so the dialog component itself never has to early-return null,
       * which would risk a Rules-of-Hooks violation when hooks live below
       * the guard. Closing also unmounts and naturally tears down state.
       */}
      {openModal && (
        <CreateSubmissionDialog
          categories={activeCategories}
          fieldsByCategory={fieldsByCategory}
          onClose={() => setOpenModal(false)}
          onCreated={(refNo) => {
            setOpenModal(false);
            showToast(`تمت إضافة الطلب ${refNo}.`);
          }}
        />
      )}

      {openImport && (
        <BulkImportDialog
          categories={activeCategories}
          existingRows={rows}
          onClose={() => setOpenImport(false)}
          onCreated={(count) => {
            showToast(
              `تم استيراد ${count} طلب محليًا — لم تُحفظ في قاعدة البيانات بعد.`,
              5000,
            );
          }}
        />
      )}
    </div>
  );
}
