import Link from 'next/link';
import { FilterBar } from '@/components/admin/FilterBar';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ViewToggle, type AdminView } from '@/components/admin/ViewToggle';
import { KanbanBoard } from '@/components/admin/KanbanBoard';
import { LocalTime } from '@/components/admin/LocalTime';
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

function SubmissionsTable({ rows }: { rows: Awaited<ReturnType<typeof loadSubmissions>> }) {
  return (
    // overflow-x-auto lets the 6-column table scroll horizontally on narrow
    // screens instead of being silently clipped by overflow-hidden. The
    // inner table gets a min-width so each column keeps its natural size
    // even when the visible area is much smaller.
    <div className="border rounded-xl overflow-x-auto" style={{ borderColor: 'var(--rule)' }}>
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead style={{ background: 'var(--option-bg-selected)' }}>
          <tr style={{ color: 'var(--muted)' }}>
            <Th>الرقم المرجعي</Th>
            <Th>الاسم</Th>
            <Th>الفئة</Th>
            <Th>الحالة</Th>
            <Th>المسؤول</Th>
            <Th>التاريخ</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                لا توجد طلبات تطابق هذه الفلاتر.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-[var(--option-bg-selected)] transition" style={{ borderColor: 'var(--rule-soft)' }}>
              <Td>
                <Link href={`/admin/submissions/${r.id}`} className="font-mono text-[12.5px]" style={{ color: 'var(--accent-strong)' }}>
                  {r.reference_no}
                </Link>
              </Td>
              <Td>
                <div className="font-medium">{r.submitter_name}</div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }} dir="ltr">{r.submitter_email}</div>
              </Td>
              <Td>{r.category?.label_ar || '—'}</Td>
              <Td>
                {r.status ? <StatusBadge label={r.status.label_ar} color={r.status.color} /> : '—'}
              </Td>
              <Td>
                {r.assignee ? (r.assignee.full_name || r.assignee.email) : (
                  <span style={{ color: 'var(--muted)' }}>بدون</span>
                )}
              </Td>
              <Td>
                <LocalTime iso={r.created_at} mode="date" />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-start font-medium text-[12px] uppercase tracking-wider">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}
