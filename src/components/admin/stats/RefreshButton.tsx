'use client';

import { useTransition } from 'react';
import { refreshStats } from '@/app/admin/stats/actions';

export function RefreshButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => refreshStats())}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] transition disabled:opacity-50"
      style={{
        borderColor: 'var(--rule)',
        color: 'var(--fg)',
        background: 'transparent',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: pending ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <span>{pending ? 'جارٍ التحديث…' : 'تحديث البيانات'}</span>
    </button>
  );
}
