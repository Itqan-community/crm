'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

// One-click trigger for /api/admin/dashboard-backfill. That endpoint
// authenticates via the Supabase session cookie (admin role) — no
// Bearer token needed since this page already gates on requireAdmin.
export function BackfillButton({ days = 120 }: { days?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/dashboard-backfill?days=${days}`, {
          method: 'POST',
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(body || `HTTP ${res.status}`);
        }
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
        // Re-fetch /admin so the metrics table + charts repaint with
        // the freshly written rows instead of the stale 0s.
        router.refresh();
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
