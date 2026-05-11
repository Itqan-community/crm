'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { DashboardWindow } from '@/lib/dashboard/types';

export function Toolbar({
  range,
  window,
}: {
  range: { label: string; compare: string };
  window: DashboardWindow;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setWindow = (next: DashboardWindow) => {
    if (next === window) return;
    const sp = new URLSearchParams(params.toString());
    sp.set('window', next);
    startTransition(() => router.push(`?${sp.toString()}`));
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        borderBottom: '1px solid var(--rule-soft)',
        gap: 16,
        flexWrap: 'wrap',
        opacity: pending ? 0.6 : 1,
        transition: 'opacity .15s ease',
      }}
    >
      <div>
        <div style={{ fontSize: 19, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          لوحة البيانات
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
          {range.label} · {range.compare}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="نطاق زمني">
          <button
            type="button"
            aria-pressed={window === 'day'}
            onClick={() => setWindow('day')}
          >
            اليوم
          </button>
          <button
            type="button"
            aria-pressed={window === 'month'}
            onClick={() => setWindow('month')}
          >
            الشهر
          </button>
        </div>
        <button type="button" className="dash-btn">⤓ تصدير CSV</button>
      </div>
    </div>
  );
}
