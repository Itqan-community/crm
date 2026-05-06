'use client';

type Props = {
  summary: { ok: number; skipped: number };
  onClose: () => void;
};

// Step 4: result summary. FE-only — the BE phase will replace the
// console.log copy with a real success message.
export function DoneStep({ summary, onClose }: Props) {
  return (
    <div className="space-y-4 text-[13.5px]">
      <p>تم الاستيراد محليًا — لم يُحفظ في قاعدة البيانات بعد. payload في console للمراجعة.</p>
      <ul className="space-y-1">
        <li>• تم قبول {summary.ok} سطر.</li>
        {summary.skipped > 0 && <li>• تم تخطّي {summary.skipped} سطر بسبب أخطاء.</li>}
      </ul>
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg text-[13px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
