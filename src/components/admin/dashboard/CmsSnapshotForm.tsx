'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveCumulativeSnapshot } from '@/lib/dashboard/actions';
import type { CumulativeSnapshotRow } from '@/lib/dashboard/queries';

// One-shot form for CMS cumulative metrics (publishers, beneficiaries,
// consumption). Used when `stat_app_CMS_DB_URL` isn't configured or
// the CMS connection is failing — gives the admin a way to populate
// these cards without filling 7 cells in the MetricsTable.
//
// Saving writes today's row with is_manual=true so the daily cron /
// backfill won't clobber the admin's truth. To later hand things back
// to the live source, re-enter the value through the MetricsTable on
// /admin (that path uses preserveManual=false).
export function CmsSnapshotForm({ rows }: { rows: CumulativeSnapshotRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pre-fill with the latest stored value so editing one input doesn't
  // accidentally null the others.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const r of rows) {
      init[r.metricKey] = r.latestValue == null ? '' : String(r.latestValue);
    }
    return init;
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const payload: Record<string, string> = {};
        for (const r of rows) {
          // Only ship inputs the admin actually touched away from
          // their starting value, so unchanged fields don't burn a
          // manual-pin on stale data.
          const v = (values[r.metricKey] ?? '').trim();
          const orig = r.latestValue == null ? '' : String(r.latestValue);
          if (v === '' || v === orig) continue;
          payload[r.metricKey] = v;
        }
        if (Object.keys(payload).length === 0) {
          setError('لا توجد قيم جديدة لحفظها');
          return;
        }
        const res = await saveCumulativeSnapshot(payload);
        setResult(`تم — ${res.written} لقطة (${res.day})`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل الحفظ');
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border p-5 space-y-4"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div>
        <h2 className="text-[16px] font-semibold">لقطة CMS التراكمية</h2>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--muted)' }}>
          أدخل قيم اليوم الحالية لإحدى أو كل من القيم التراكمية أدناه. تُحفظ
          بتاريخ اليوم وعلامة «إدخال يدوي» فلا يستبدلها الكرون أو إعادة الملء.
          فقط الحقول التي تُغيّرها ستُكتب — اترك ما ليس عندك جديد فيه فارغاً.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {rows.map((r) => (
          <label key={r.metricKey} className="block space-y-1">
            <span className="text-[13px] font-medium">{r.label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={values[r.metricKey] ?? ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, [r.metricKey]: e.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-[14px]"
              style={{
                borderColor: 'var(--rule)',
                background: 'var(--bg)',
                color: 'var(--fg)',
                fontFeatureSettings: '"tnum" 1',
              }}
              placeholder="0"
              disabled={pending}
            />
            <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
              {r.latestDay ? (
                <>
                  آخر قيمة محفوظة: {r.latestValue?.toLocaleString('ar-EG')} · {r.latestDay}
                  {r.isManual && <span className="ms-1">📌</span>}
                </>
              ) : (
                'لا توجد قيمة محفوظة بعد'
              )}
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {pending ? 'جارٍ الحفظ…' : 'حفظ لقطة اليوم'}
        </button>
        {result && (
          <span className="text-[12.5px]" style={{ color: 'var(--success)' }}>
            {result}
          </span>
        )}
        {error && (
          <span className="text-[12.5px]" style={{ color: 'var(--danger)' }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
