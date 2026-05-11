'use client';

import { useState, useTransition } from 'react';

// One-click trigger for /api/cron/dashboard-metrics?backfill=30. Reads
// CRON_SECRET out of NEXT_PUBLIC_CRON_TRIGGER_TOKEN if present (admins
// only see this page so we tolerate a NEXT_PUBLIC token) — otherwise
// we omit auth and rely on the dev fallback in the route.
export function BackfillButton({ days = 30 }: { days?: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_CRON_TRIGGER_TOKEN;
        const res = await fetch(`/api/cron/dashboard-metrics?backfill=${days}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          written?: number;
          perSource?: Record<string, number | string>;
        };
        const perSource = data.perSource
          ? Object.entries(data.perSource)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')
          : '';
        setResult(`تم — ${data.written ?? 0} صف · ${perSource}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل');
      }
    });
  };

  return (
    <div
      className="rounded-xl border p-5 space-y-3"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div>
        <h2 className="text-[16px] font-semibold">إعادة ملء البيانات اليومية</h2>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--muted)' }}>
          يقرأ من Flarum (مشاركات + مناقشات) وCMS (ناشرون + مستفيدون + مواد)
          ولقطات الشبكات الاجتماعية، ويحفظ القيم اليومية لآخر {days} يوماً
          في جدول <code className="mono">dashboard_metric_daily</code>. يُستخدم
          مرة واحدة بعد النشر، ثم يلتقط الكرون بقية الأيام تلقائياً.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {pending ? 'جارٍ التشغيل…' : `إعادة ملء آخر ${days} يوم`}
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
    </div>
  );
}
