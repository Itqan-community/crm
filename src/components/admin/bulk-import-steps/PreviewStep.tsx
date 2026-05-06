'use client';

import type { ParsedFile, ValidatedRow } from '@/lib/bulk-import/types';
import { Tag } from '../Tag';

type Counts = { ok: number; warning: number; error: number; total: number };

type Props = {
  parsed: ParsedFile | null;
  rows: ValidatedRow[];
  counts: Counts;
  showOnlyIssues: boolean;
  onToggleShowOnlyIssues: () => void;
  skipInvalidConfirmed: boolean;
  onToggleSkipInvalid: () => void;
  canSubmit: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

// Step 3: validate + preview. Per-row badge, counter pills, and the
// "skip invalid and continue" escape hatch. Submit is disabled until
// either every row is clean or the operator opts into skipping.
export function PreviewStep({
  parsed,
  rows,
  counts,
  showOnlyIssues,
  onToggleShowOnlyIssues,
  skipInvalidConfirmed,
  onToggleSkipInvalid,
  canSubmit,
  onBack,
  onSubmit,
}: Props) {
  const accepted = counts.ok + counts.warning;
  return (
    <div className="space-y-3 text-[13px]">
      <div
        className="flex flex-wrap items-center gap-3 pb-2 border-b"
        style={{ borderColor: 'var(--rule-soft)' }}
      >
        <Tag color="#16A34A">جاهز {counts.ok}</Tag>
        <Tag color="#D97706">تنبيهات {counts.warning}</Tag>
        <Tag color="#DC2626">أخطاء {counts.error}</Tag>
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
          الإجمالي: {counts.total}
        </span>
        <label className="ms-auto inline-flex items-center gap-1.5 text-[12.5px] cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyIssues}
            onChange={onToggleShowOnlyIssues}
          />
          إظهار المشكلات فقط
        </label>
      </div>

      <div
        className="border rounded-lg overflow-auto max-h-[420px]"
        style={{ borderColor: 'var(--rule)' }}
      >
        <table className="w-full text-[12.5px]">
          <thead style={{ background: 'var(--option-bg-selected)', color: 'var(--muted)' }}>
            <tr>
              <th className="px-2 py-2 text-start font-medium w-10">#</th>
              <th className="px-2 py-2 text-start font-medium w-24">الحالة</th>
              <th className="px-2 py-2 text-start font-medium">الاسم</th>
              <th className="px-2 py-2 text-start font-medium">البريد</th>
              <th className="px-2 py-2 text-start font-medium">الهاتف</th>
              <th className="px-2 py-2 text-start font-medium">الفئة</th>
              <th className="px-2 py-2 text-start font-medium">المصدر</th>
              <th className="px-2 py-2 text-start font-medium">رسائل</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center" style={{ color: 'var(--muted)' }}>
                  {showOnlyIssues ? 'لا مشكلات.' : 'لا توجد سطور.'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <PreviewRow key={r.rowIndex} row={r} />
            ))}
          </tbody>
        </table>
      </div>

      {counts.error > 0 && (
        <label className="inline-flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={skipInvalidConfirmed}
            onChange={onToggleSkipInvalid}
          />
          تخطّي السطور الخاطئة وأكمل بـ{accepted} سطر
        </label>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg border text-[13px]"
          style={{ borderColor: 'var(--rule)' }}
        >
          → الرجوع للربط
        </button>
        <div className="flex gap-2 items-center">
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
            {parsed?.filename}
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            استيراد {accepted} سطر
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ row }: { row: ValidatedRow }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--rule-soft)' }}>
      <td className="px-2 py-1.5 font-mono" style={{ color: 'var(--muted)' }}>
        {row.rowIndex}
      </td>
      <td className="px-2 py-1.5">
        <RowStatusTag status={row.status} />
      </td>
      <td className="px-2 py-1.5">{row.values.name || '—'}</td>
      <td className="px-2 py-1.5" dir="ltr">
        {row.values.email || '—'}
      </td>
      <td className="px-2 py-1.5" dir="ltr">
        {row.values.phone || '—'}
      </td>
      <td className="px-2 py-1.5">{row.values.category_key || '—'}</td>
      <td className="px-2 py-1.5">{row.values.channel}</td>
      <td className="px-2 py-1.5" style={{ color: 'var(--muted)' }}>
        <ul className="space-y-0.5">
          {row.errors.map((e) => (
            <li key={`e-${e}`} style={{ color: 'var(--danger)' }}>
              • {e}
            </li>
          ))}
          {row.warnings.map((w) => (
            <li key={`w-${w}`} style={{ color: '#D97706' }}>
              • {w}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

const STATUS_TAG: Record<ValidatedRow['status'], { label: string; color: string }> = {
  ok: { label: 'جاهز', color: '#16A34A' },
  warning: { label: 'تنبيه', color: '#D97706' },
  error: { label: 'خطأ', color: '#DC2626' },
};

function RowStatusTag({ status }: { status: ValidatedRow['status'] }) {
  const { label, color } = STATUS_TAG[status];
  return (
    <Tag color={color} className="text-[11.5px]">
      {label}
    </Tag>
  );
}
