import { describe, it, expect } from 'vitest';
import {
  comparisonLabel,
  dateKey,
  defaultAnchor,
  fromDateKey,
  formatPeriodHijri,
  formatPeriodGregorian,
  nextPeriodRange,
  periodRange,
  previousPeriodRange,
  startOfKsaWeek,
  endOfKsaWeek,
} from '@/lib/dashboard/calendar';

// Tuesday May 12, 2026 in KSA. ISO at noon UTC is safe across local timezones.
const TUE_2026_05_12 = new Date('2026-05-12T12:00:00.000Z');

describe('startOfKsaWeek / endOfKsaWeek', () => {
  it('snaps to Sunday at 00:00 KSA', () => {
    expect(dateKey(startOfKsaWeek(TUE_2026_05_12))).toBe('2026-05-10');
    expect(dateKey(endOfKsaWeek(TUE_2026_05_12))).toBe('2026-05-16');
  });
});

describe('defaultAnchor', () => {
  it('week → Sunday of the PREVIOUS complete week', () => {
    // Today=Tue May 12; previous full Sun→Sat is May 3 → May 9.
    expect(dateKey(defaultAnchor('week', TUE_2026_05_12))).toBe('2026-05-03');
  });
  it('day → yesterday', () => {
    expect(dateKey(defaultAnchor('day', TUE_2026_05_12))).toBe('2026-05-11');
  });
  it('month → first of previous month', () => {
    expect(dateKey(defaultAnchor('month', TUE_2026_05_12))).toBe('2026-04-01');
  });
});

describe('periodRange + neighbors', () => {
  it('week covers Sun..Sat enclosing the anchor', () => {
    const p = periodRange('week', new Date('2026-05-03T12:00:00.000Z'));
    expect(dateKey(p.start)).toBe('2026-05-03');
    expect(dateKey(p.end)).toBe('2026-05-09');
  });
  it('previous week shifts back exactly 7 days', () => {
    const cur = periodRange('week', new Date('2026-05-03T12:00:00.000Z'));
    expect(dateKey(previousPeriodRange(cur).start)).toBe('2026-04-26');
    expect(dateKey(nextPeriodRange(cur).start)).toBe('2026-05-10');
  });
  it('month handles different month lengths', () => {
    const may = periodRange('month', new Date('2026-05-15T12:00:00.000Z'));
    expect(dateKey(may.start)).toBe('2026-05-01');
    expect(dateKey(may.end)).toBe('2026-05-31');
    expect(dateKey(previousPeriodRange(may).end)).toBe('2026-04-30');
  });
});

describe('comparisonLabel', () => {
  it('adapts to granularity', () => {
    expect(comparisonLabel('day')).toBe('اليوم السابق');
    expect(comparisonLabel('week')).toBe('الأسبوع السابق');
    expect(comparisonLabel('month')).toBe('الشهر السابق');
  });
});

describe('dateKey round-trip', () => {
  it('YYYY-MM-DD parses and re-formats without timezone drift', () => {
    const d = fromDateKey('2026-05-03');
    expect(d).not.toBeNull();
    expect(dateKey(d!)).toBe('2026-05-03');
  });
});

describe('Hijri + Gregorian formatters', () => {
  const week = periodRange('week', new Date('2026-05-03T12:00:00.000Z'));
  it('Hijri label ends in هـ', () => {
    expect(formatPeriodHijri(week)).toMatch(/هـ$/);
  });
  it('Gregorian week label mentions مايو', () => {
    expect(formatPeriodGregorian(week)).toContain('مايو');
  });
  it('day label is single date (no dash)', () => {
    const day = periodRange('day', TUE_2026_05_12);
    expect(formatPeriodHijri(day)).not.toContain('–');
  });
});
