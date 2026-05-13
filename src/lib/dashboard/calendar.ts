// Calendar arithmetic + Hijri/Gregorian formatting for the dashboard.
// KSA-anchored (Asia/Riyadh, no DST → fixed +03 offset), Sunday-first
// week. Native `Intl` ships an Umm al-Qura calendar via V8, so no
// external library is needed.

import type { DashboardWindow } from './types';

const KSA_OFFSET_HOURS = 3;
const MS_PER_DAY = 24 * 3_600_000;

function toKsa(d: Date): Date {
  return new Date(d.getTime() + KSA_OFFSET_HOURS * 3_600_000);
}
function fromKsa(d: Date): Date {
  return new Date(d.getTime() - KSA_OFFSET_HOURS * 3_600_000);
}

// ---- Day --------------------------------------------------------------------

export function startOfKsaDay(input: Date | string | number): Date {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  const ksa = toKsa(d);
  ksa.setUTCHours(0, 0, 0, 0);
  return fromKsa(ksa);
}

export function endOfKsaDay(input: Date | string | number): Date {
  return new Date(startOfKsaDay(input).getTime() + MS_PER_DAY - 1);
}

export function addDays(input: Date, n: number): Date {
  return new Date(input.getTime() + n * MS_PER_DAY);
}

// ---- Week (Sunday → Saturday, KSA) -----------------------------------------

export function startOfKsaWeek(input: Date | string | number): Date {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  const ksa = toKsa(d);
  // Sun=0, Mon=1, ..., Sat=6 — Sunday is the start of the week.
  const dow = ksa.getUTCDay();
  ksa.setUTCDate(ksa.getUTCDate() - dow);
  ksa.setUTCHours(0, 0, 0, 0);
  return fromKsa(ksa);
}

export function endOfKsaWeek(input: Date | string | number): Date {
  return new Date(startOfKsaWeek(input).getTime() + 7 * MS_PER_DAY - 1);
}

export function addWeeks(input: Date, n: number): Date {
  return new Date(input.getTime() + n * 7 * MS_PER_DAY);
}

// ---- Month ------------------------------------------------------------------

export function startOfKsaMonth(input: Date | string | number): Date {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  const ksa = toKsa(d);
  ksa.setUTCDate(1);
  ksa.setUTCHours(0, 0, 0, 0);
  return fromKsa(ksa);
}

export function endOfKsaMonth(input: Date | string | number): Date {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  const ksa = toKsa(d);
  ksa.setUTCMonth(ksa.getUTCMonth() + 1);
  ksa.setUTCDate(1);
  ksa.setUTCHours(0, 0, 0, 0);
  // Subtract 1ms from the start of next month, then shift back to UTC.
  return new Date(ksa.getTime() - 1 - KSA_OFFSET_HOURS * 3_600_000);
}

export function addMonths(input: Date, n: number): Date {
  const ksa = toKsa(input);
  ksa.setUTCMonth(ksa.getUTCMonth() + n);
  return fromKsa(ksa);
}

// ---- Period range -----------------------------------------------------------

export type PeriodRange = {
  window: DashboardWindow;
  start: Date;
  end: Date;
};

export function periodRange(window: DashboardWindow, anchor: Date): PeriodRange {
  if (window === 'day') return { window, start: startOfKsaDay(anchor), end: endOfKsaDay(anchor) };
  if (window === 'week') return { window, start: startOfKsaWeek(anchor), end: endOfKsaWeek(anchor) };
  return { window, start: startOfKsaMonth(anchor), end: endOfKsaMonth(anchor) };
}

export function previousPeriodRange(p: PeriodRange): PeriodRange {
  if (p.window === 'day') return periodRange('day', addDays(p.start, -1));
  if (p.window === 'week') return periodRange('week', addWeeks(p.start, -1));
  return periodRange('month', addMonths(p.start, -1));
}

export function nextPeriodRange(p: PeriodRange): PeriodRange {
  if (p.window === 'day') return periodRange('day', addDays(p.start, 1));
  if (p.window === 'week') return periodRange('week', addWeeks(p.start, 1));
  return periodRange('month', addMonths(p.start, 1));
}

// Default anchor: the LAST FULLY COMPLETED period before `now`. So with
// today=Tue, the week default is the Sunday of LAST week (the just-
// completed Sun→Sat), the day default is yesterday, and the month
// default is the 1st of last month. This is what we want for a
// stable comparison baseline — looking at an in-progress week is
// noisy.
export function defaultAnchor(window: DashboardWindow, now: Date = new Date()): Date {
  if (window === 'day') return addDays(startOfKsaDay(now), -1);
  if (window === 'week') return addWeeks(startOfKsaWeek(now), -1);
  return addMonths(startOfKsaMonth(now), -1);
}

// ---- Key encoding (URL params + DB keys) -----------------------------------

// YYYY-MM-DD in KSA wall time. Used as the `date` URL param + the
// row's `day` column. Matches the convention in dashboard/daily.ts.
export function dateKey(d: Date): string {
  const ksa = toKsa(d);
  const y = ksa.getUTCFullYear();
  const m = String(ksa.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ksa.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function fromDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const utcMs = Date.UTC(y, mo - 1, d, 0, 0, 0);
  return new Date(utcMs - KSA_OFFSET_HOURS * 3_600_000);
}

// ---- Formatters -------------------------------------------------------------

const HIJRI_LONG = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
});
const HIJRI_DM = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Riyadh',
});
const HIJRI_MONTH_YEAR = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
});

const GREG_LONG = new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
});
const GREG_DM = new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Riyadh',
});
const GREG_MONTH_YEAR = new Intl.DateTimeFormat('ar-EG', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
});

function sameKsaDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

function hijriYearOf(d: Date): string | undefined {
  return HIJRI_LONG.formatToParts(d).find((p) => p.type === 'year')?.value;
}
function gregYearOf(d: Date): string | undefined {
  return GREG_LONG.formatToParts(d).find((p) => p.type === 'year')?.value;
}

export function formatHijri(d: Date): string {
  return HIJRI_LONG.format(d);
}

export function formatHijriRange(start: Date, end: Date): string {
  if (sameKsaDay(start, end)) return `${HIJRI_LONG.format(start)} هـ`;
  if (hijriYearOf(start) === hijriYearOf(end)) {
    // Same year → drop the year on the start side for less noise.
    return `${HIJRI_DM.format(start)} – ${HIJRI_LONG.format(end)} هـ`;
  }
  return `${HIJRI_LONG.format(start)} – ${HIJRI_LONG.format(end)} هـ`;
}

export function formatGregorianRange(start: Date, end: Date): string {
  if (sameKsaDay(start, end)) return GREG_LONG.format(start);
  if (gregYearOf(start) === gregYearOf(end)) {
    return `${GREG_DM.format(start)} – ${GREG_LONG.format(end)}`;
  }
  return `${GREG_LONG.format(start)} – ${GREG_LONG.format(end)}`;
}

export function formatPeriodHijri(p: PeriodRange): string {
  if (p.window === 'day') return `${HIJRI_LONG.format(p.start)} هـ`;
  if (p.window === 'month') return `${HIJRI_MONTH_YEAR.format(p.start)} هـ`;
  return formatHijriRange(p.start, p.end);
}

export function formatPeriodGregorian(p: PeriodRange): string {
  if (p.window === 'day') return GREG_LONG.format(p.start);
  if (p.window === 'month') return GREG_MONTH_YEAR.format(p.start);
  return formatGregorianRange(p.start, p.end);
}

// The bare "next period" name used in delta labels. Caller usually
// prepends "مقارنة بـ " for the full compare label.
export function comparisonLabel(window: DashboardWindow): string {
  if (window === 'day') return 'اليوم السابق';
  if (window === 'month') return 'الشهر السابق';
  return 'الأسبوع السابق';
}
