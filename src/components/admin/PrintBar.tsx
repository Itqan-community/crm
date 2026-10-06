'use client';

import { useEffect } from 'react';

// Opens the browser print dialog once the print view has mounted (the
// table is server-rendered, so one paint is enough). The toolbar offers a
// manual re-trigger and stays out of the printed page via print:hidden.
export function PrintBar({ count }: { count: number }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="print:hidden flex flex-wrap items-center justify-between gap-3 mb-6 px-4 py-3 rounded-xl border"
      style={{ borderColor: 'var(--rule)', background: 'var(--option-bg-selected)' }}
    >
      <span className="text-[13.5px]">
        {count} نتيجة — من نافذة الطباعة اختر «حفظ كملف PDF» للحصول على ملف PDF.
      </span>
      <div className="flex items-center gap-2">
        <a
          href="/admin/tags"
          className="px-3 py-1.5 rounded-lg border text-[13px]"
          style={{ borderColor: 'var(--rule)' }}
        >
          رجوع
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-1.5 rounded-lg text-[13px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          طباعة / حفظ PDF
        </button>
      </div>
    </div>
  );
}
