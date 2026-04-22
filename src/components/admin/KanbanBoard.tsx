import Link from 'next/link';
import type { StatusRow } from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';

type Props = {
  submissions: SubmissionListRow[];
  statuses: StatusRow[];
};

export function KanbanBoard({ submissions, statuses }: Props) {
  // Group by status_id, preserving the canonical status order.
  const byStatus = new Map<string, SubmissionListRow[]>();
  for (const s of statuses) byStatus.set(s.id, []);
  for (const r of submissions) {
    if (!byStatus.has(r.status_id)) byStatus.set(r.status_id, []);
    byStatus.get(r.status_id)!.push(r);
  }

  return (
    <div className="overflow-x-auto -mx-2 pb-2">
      <div className="flex gap-3 min-w-fit px-2">
        {statuses.map((s) => {
          const items = byStatus.get(s.id) ?? [];
          return (
            <div key={s.id} className="w-[280px] shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--fg)' }}>{s.label_ar}</h3>
                </div>
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{items.length}</span>
              </div>
              <div
                className="rounded-xl p-2 space-y-2 min-h-[120px]"
                style={{ background: 'var(--option-bg-selected)', border: '1px solid var(--rule-soft)' }}
              >
                {items.length === 0 && (
                  <div className="text-[12px] text-center py-6" style={{ color: 'var(--muted)' }}>
                    لا طلبات
                  </div>
                )}
                {items.map((r) => (
                  <Card key={r.id} row={r} statusColor={s.color} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ row, statusColor }: { row: SubmissionListRow; statusColor: string }) {
  return (
    <Link
      href={`/admin/submissions/${row.id}`}
      className="block rounded-lg p-3 border transition hover:border-[color:var(--accent)]"
      style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-medium text-[13.5px] leading-snug truncate flex-1" style={{ color: 'var(--fg)' }}>
          {row.submitter_name}
        </div>
        <span
          className="text-[10.5px] font-mono shrink-0 px-1.5 py-0.5 rounded"
          style={{ color: statusColor, background: 'var(--option-bg-selected)' }}
        >
          {row.reference_no}
        </span>
      </div>
      <div className="text-[11.5px] truncate mb-1" style={{ color: 'var(--muted)' }} dir="ltr">
        {row.submitter_email}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
        <span>{row.category?.label_ar || '—'}</span>
        <div className="flex items-center gap-1.5">
          {row.assignee && (
            <Avatar name={row.assignee.full_name || row.assignee.email} />
          )}
          <span>{new Date(row.created_at).toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?';
  return (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
      style={{ background: 'var(--option-bg-selected)', color: 'var(--accent-strong)' }}
      title={name}
    >
      {initials}
    </span>
  );
}
