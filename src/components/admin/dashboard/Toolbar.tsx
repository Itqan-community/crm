'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import type { DashboardWindow } from '@/lib/dashboard/types';
import type { DashboardData } from './types';

// All wall-clock math runs in KSA (Asia/Riyadh, no DST → fixed +03).
// Picker control uses native <input type="date"|"month"> which speaks
// the browser's local time; we explicitly convert through YYYY-MM-DD
// so a user in another timezone can't accidentally drift our anchor.
const KSA_OFFSET_HOURS = 3;
const MS_PER_DAY = 24 * 3_600_000;

function todayKsaKey(): string {
  const ksa = new Date(Date.now() + KSA_OFFSET_HOURS * 3_600_000);
  return `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, '0')}-${String(ksa.getUTCDate()).padStart(2, '0')}`;
}

function parseKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - KSA_OFFSET_HOURS * 3_600_000,
  );
}

function toKey(d: Date): string {
  const ksa = new Date(d.getTime() + KSA_OFFSET_HOURS * 3_600_000);
  return `${ksa.getUTCFullYear()}-${String(ksa.getUTCMonth() + 1).padStart(2, '0')}-${String(ksa.getUTCDate()).padStart(2, '0')}`;
}

// Snap any day to the Sunday that starts its KSA week.
function snapToSunday(key: string): string {
  const d = parseKey(key);
  if (!d) return key;
  const ksa = new Date(d.getTime() + KSA_OFFSET_HOURS * 3_600_000);
  const dow = ksa.getUTCDay();
  const sunday = new Date(ksa.getTime() - dow * MS_PER_DAY);
  return `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}`;
}

function step(key: string, window: DashboardWindow, direction: 1 | -1): string {
  const d = parseKey(key);
  if (!d) return key;
  if (window === 'day') return toKey(new Date(d.getTime() + direction * MS_PER_DAY));
  if (window === 'week') return toKey(new Date(d.getTime() + direction * 7 * MS_PER_DAY));
  const ksa = new Date(d.getTime() + KSA_OFFSET_HOURS * 3_600_000);
  ksa.setUTCMonth(ksa.getUTCMonth() + direction);
  return toKey(new Date(ksa.getTime() - KSA_OFFSET_HOURS * 3_600_000));
}

export function Toolbar({
  range,
  window,
}: {
  range: DashboardData['range'];
  window: DashboardWindow;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const anchorKey = range.anchorKey;
  const today = useMemo(todayKsaKey, []);

  const navigate = useCallback(
    (nextWindow: DashboardWindow, nextKey: string) => {
      const sp = new URLSearchParams(params?.toString() ?? '');
      sp.set('window', nextWindow);
      // Always canonicalize week anchors to Sunday so the URL is
      // stable regardless of which day the user clicked.
      const normalized = nextWindow === 'week' ? snapToSunday(nextKey) : nextKey;
      sp.set('date', normalized);
      startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [pathname, params, router],
  );

  const setWindow = (next: DashboardWindow) => {
    if (next === window) return;
    navigate(next, anchorKey);
  };
  const onPrev = () => navigate(window, step(anchorKey, window, -1));
  const onNext = () => navigate(window, step(anchorKey, window, +1));
  const onPicker = (value: string) => {
    if (!value) return;
    // <input type="month"> returns YYYY-MM; append day-01 for our key.
    if (window === 'month') navigate(window, `${value}-01`);
    else navigate(window, value);
  };

  const nextDisabled = step(anchorKey, window, +1) > today;
  const pickerType: 'date' | 'month' = window === 'month' ? 'month' : 'date';
  const pickerValue = window === 'month' ? anchorKey.slice(0, 7) : anchorKey;
  const pickerMax = window === 'month' ? today.slice(0, 7) : today;

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
          {range.hijriLabel}
          <span style={{ opacity: 0.6, marginInlineStart: 8 }}>· {range.gregorianLabel}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
          مقارنة بـ {range.compareHijriLabel}
          <span style={{ opacity: 0.55, marginInlineStart: 6 }}>
            · {range.compareGregorianLabel}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="نطاق زمني">
          <button type="button" aria-pressed={window === 'day'} onClick={() => setWindow('day')}>
            اليوم
          </button>
          <button type="button" aria-pressed={window === 'week'} onClick={() => setWindow('week')}>
            الأسبوع
          </button>
          <button type="button" aria-pressed={window === 'month'} onClick={() => setWindow('month')}>
            الشهر
          </button>
        </div>
        <div
          role="group"
          aria-label="تنقل بين الفترات"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <button
            type="button"
            className="dash-btn dash-icon-btn"
            onClick={onPrev}
            aria-label={`السابق (${range.comparisonLabel})`}
            title={`السابق (${range.comparisonLabel})`}
          >
            ›
          </button>
          <input
            type={pickerType}
            className="dash-date-input"
            value={pickerValue}
            max={pickerMax}
            onChange={(e) => onPicker(e.target.value)}
            aria-label="اختر فترة"
          />
          <button
            type="button"
            className="dash-btn dash-icon-btn"
            onClick={onNext}
            disabled={nextDisabled}
            aria-label="التالي"
            title="التالي"
          >
            ‹
          </button>
        </div>
        <button type="button" className="dash-btn">⤓ تصدير CSV</button>
      </div>
    </div>
  );
}
