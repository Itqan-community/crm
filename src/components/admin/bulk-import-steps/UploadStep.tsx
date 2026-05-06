'use client';

import { MAX_IMPORT_ROWS } from '@/lib/bulk-import/parse-file';

type Props = {
  parsing: boolean;
  parseError: string | null;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

// Step 1: file picker. The actual parse runs in the orchestrator's
// onPickFile handler — this is purely presentation.
export function UploadStep({ parsing, parseError, onPickFile }: Props) {
  return (
    <div>
      <p className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>
        اختر ملف CSV أو Excel. الصف الأول يجب أن يحتوي أسماء الأعمدة. حد الأسطر:{' '}
        {MAX_IMPORT_ROWS}.
      </p>
      <div
        className="rounded-xl border-2 border-dashed p-8 text-center"
        style={{ borderColor: 'var(--rule)' }}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onPickFile}
          className="hidden"
          id="bulk-import-file-input"
        />
        <label
          htmlFor="bulk-import-file-input"
          className="inline-block px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {parsing ? 'جارٍ القراءة…' : 'اختر ملفًا'}
        </label>
        <div className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>
          الصيغ المدعومة: .csv, .xlsx
        </div>
      </div>
      {parseError && (
        <div className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>
          {parseError}
        </div>
      )}
    </div>
  );
}
