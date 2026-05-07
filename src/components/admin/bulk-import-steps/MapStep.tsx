'use client';

import type { SourceChannelKey } from '@/types/database';
import type { ColumnMapping, ColumnRole, ParsedFile } from '@/lib/bulk-import/types';
import { selectableChannels } from '@/lib/source-channels';
import { ROLE_LABEL_AR, ROLE_OPTIONS } from './role-labels';

type Props = {
  parsed: ParsedFile;
  mapping: ColumnMapping[];
  onChangeMapping: (column: string, role: ColumnRole) => void;
  defaultChannel: SourceChannelKey;
  onChangeChannel: (v: SourceChannelKey) => void;
  defaultReferral: string;
  onChangeReferral: (v: string) => void;
  mappingErrors: string[];
  onBack: () => void;
  onNext: () => void;
};

// Step 2: pick the file-level default source + assign each column a role.
// Per-row category means the schema varies row-to-row, so we map columns
// to *roles* (name/email/phone/category/...) rather than to specific
// field IDs — see lib/bulk-import/validate-row.ts for the resolver.
export function MapStep({
  parsed,
  mapping,
  onChangeMapping,
  defaultChannel,
  onChangeChannel,
  defaultReferral,
  onChangeReferral,
  mappingErrors,
  onBack,
  onNext,
}: Props) {
  return (
    <div className="space-y-4 text-[13px]">
      <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
        الملف: <span style={{ color: 'var(--fg)' }}>{parsed.filename}</span> ·{' '}
        {parsed.rows.length} سطر
      </div>

      <div
        className="grid grid-cols-2 gap-3 pb-3 border-b"
        style={{ borderColor: 'var(--rule-soft)' }}
      >
        <div>
          <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>
            القناة الافتراضية
          </div>
          <select
            value={defaultChannel}
            onChange={(e) => onChangeChannel(e.target.value as SourceChannelKey)}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          >
            {selectableChannels().map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon}  {c.label_ar}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>
            ملاحظة المصدر الافتراضية (اختياري)
          </div>
          <input
            value={defaultReferral}
            onChange={(e) => onChangeReferral(e.target.value)}
            placeholder="مثال: ملف من شريك سابق"
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          />
        </div>
      </div>

      <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
        ربط أعمدة الملف بدور كل عمود. الأعمدة غير المعرّفة تُحفظ كحقول إضافية لكل سطر بحسب فئته.
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--rule)' }}>
        <table className="w-full text-[13px]">
          <thead style={{ background: 'var(--option-bg-selected)', color: 'var(--muted)' }}>
            <tr>
              <th className="text-start px-3 py-2 font-medium">العمود في الملف</th>
              <th className="text-start px-3 py-2 font-medium">الدور</th>
              <th className="text-start px-3 py-2 font-medium">عيّنة</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m) => {
              const sample = parsed.rows[0]?.[m.column] ?? '';
              return (
                <tr
                  key={m.column}
                  className="border-t"
                  style={{ borderColor: 'var(--rule-soft)' }}
                >
                  <td className="px-3 py-2 font-medium">{m.column}</td>
                  <td className="px-3 py-2">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        onChangeMapping(m.column, e.target.value as ColumnRole)
                      }
                      className="px-2 py-1 rounded border bg-transparent text-[13px]"
                      style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL_AR[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className="px-3 py-2 truncate max-w-[200px]"
                    style={{ color: 'var(--muted)' }}
                  >
                    {sample || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mappingErrors.length > 0 && (
        <ul className="text-[12px] space-y-1" style={{ color: 'var(--danger)' }}>
          {mappingErrors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg border text-[13px]"
          style={{ borderColor: 'var(--rule)' }}
        >
          → الرجوع
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={mappingErrors.length > 0}
          className="px-4 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          متابعة للمعاينة ←
        </button>
      </div>
    </div>
  );
}
