'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import type { SubmissionListRow } from '@/lib/admin-queries';
import { archiveSubmissions } from '@/lib/admin-actions';
import { StatusBadge } from './StatusBadge';
import { LocalTime } from './LocalTime';

type Props = {
  rows: SubmissionListRow[];
};

export function SubmissionsTable({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someChecked = !allChecked && visibleIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(selected);
      visibleIds.forEach((id) => next.delete(id));
      setSelected(next);
    } else {
      setSelected(new Set([...selected, ...visibleIds]));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onArchive = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`أرشفة ${ids.length} ${ids.length === 1 ? 'طلب' : 'طلبات'}؟`)) return;
    startTransition(async () => {
      await archiveSubmissions(ids);
      setSelected(new Set());
    });
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div
          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-[13px]"
          style={{ borderColor: 'var(--rule)', background: 'var(--option-bg-selected)' }}
        >
          <span>تم تحديد {selected.size}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 rounded-md text-[13px] hover:underline"
              style={{ color: 'var(--muted)' }}
            >
              إلغاء التحديد
            </button>
            <button
              type="button"
              onClick={onArchive}
              disabled={pending}
              className="px-3 py-1.5 rounded-md border text-[13px] hover:bg-[var(--bg)] transition disabled:opacity-60"
              style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
            >
              {pending ? 'جارٍ الأرشفة…' : `أرشفة المحدد (${selected.size})`}
            </button>
          </div>
        </div>
      )}

      <div className="border rounded-xl overflow-x-auto" style={{ borderColor: 'var(--rule)' }}>
        <table className="w-full min-w-[760px] text-[13.5px]">
          <thead style={{ background: 'var(--option-bg-selected)' }}>
            <tr style={{ color: 'var(--muted)' }}>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  aria-label="تحديد الكل"
                />
              </th>
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
                <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                  لا توجد طلبات تطابق هذه الفلاتر.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isChecked = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  className="border-t hover:bg-[var(--option-bg-selected)] transition"
                  style={{ borderColor: 'var(--rule-soft)' }}
                  data-selected={isChecked || undefined}
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`تحديد ${r.reference_no}`}
                    />
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/submissions/${r.id}`}
                      className="font-mono text-[12.5px]"
                      style={{ color: 'var(--accent-strong)' }}
                    >
                      {r.reference_no}
                    </Link>
                  </Td>
                  <Td>
                    <div className="font-medium">{r.submitter_name}</div>
                    <div className="text-[12px]" style={{ color: 'var(--muted)' }} dir="ltr">
                      {r.submitter_email}
                    </div>
                  </Td>
                  <Td>{r.category?.label_ar || '—'}</Td>
                  <Td>
                    {r.status ? <StatusBadge label={r.status.label_ar} color={r.status.color} /> : '—'}
                  </Td>
                  <Td>
                    {r.assignee ? (
                      r.assignee.full_name || r.assignee.email
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>بدون</span>
                    )}
                  </Td>
                  <Td>
                    <LocalTime iso={r.created_at} mode="date" />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-start font-medium text-[12px] uppercase tracking-wider">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}
