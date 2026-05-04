// Weekly bucketing (Sunday → Saturday) in Asia/Riyadh, plus Hijri (Umm
// al-Qura) formatting. The dashboard renders Hijri as the primary date
// and Gregorian as a small secondary line. No external library — both
// pieces are native: KSA-week math is plain Date arithmetic on UTC, and
// the Hijri calendar ships with V8 via the `islamic-umalqura` Intl
// extension.

const KSA_OFFSET_HOURS = 3;

// Take any Date and return the Date that represents the start of the
// Sunday in KSA (i.e. 00:00 Asia/Riyadh) on the same week. We avoid the
// `timeZone` Intl.DateTimeFormat song-and-dance because KSA has no DST,
// so a fixed +03 offset is exact.
export function startOfKsaWeek(input: Date | string | number): Date {
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  // Shift to KSA wall time, find that day's Sunday at 00:00, then shift
  // back to UTC. dayOfWeek: Sun=0, Mon=1, …, Sat=6 — Sunday is already
  // the start, so we subtract `dow` days.
  const ksaMs = d.getTime() + KSA_OFFSET_HOURS * 3_600_000;
  const ksa = new Date(ksaMs);
  const dow = ksa.getUTCDay();
  ksa.setUTCDate(ksa.getUTCDate() - dow);
  ksa.setUTCHours(0, 0, 0, 0);
  return new Date(ksa.getTime() - KSA_OFFSET_HOURS * 3_600_000);
}

export function endOfKsaWeek(input: Date | string | number): Date {
  const start = startOfKsaWeek(input);
  return new Date(start.getTime() + 7 * 24 * 3_600_000 - 1);
}

// Add `n` weeks to a Sunday (negative for prior weeks).
export function addWeeks(start: Date, n: number): Date {
  return new Date(start.getTime() + n * 7 * 24 * 3_600_000);
}

// Return ISO date (YYYY-MM-DD) of the Sunday that anchors a week. This
// is the natural primary key for the dashboard_metrics table.
export function weekKey(start: Date): string {
  const ksa = new Date(start.getTime() + KSA_OFFSET_HOURS * 3_600_000);
  const y = ksa.getUTCFullYear();
  const m = String(ksa.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ksa.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Inverse of weekKey: parse 'YYYY-MM-DD' as the Sunday 00:00 KSA in UTC.
export function fromWeekKey(key: string): Date {
  const [y, m, d] = key.split('-').map((n) => Number(n));
  const utcMs = Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
  return new Date(utcMs - KSA_OFFSET_HOURS * 3_600_000);
}

const HIJRI_FMT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
});

const HIJRI_DAY_MONTH_FMT = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Riyadh',
});

const GREG_FMT = new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
});

const GREG_DAY_MONTH_FMT = new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Riyadh',
});

export function formatHijri(d: Date): string {
  return HIJRI_FMT.format(d);
}

export function formatHijriRange(start: Date, end: Date): string {
  // "٢٤ شوال – ١ ذو القعدة ١٤٤٧ هـ" — drop the year on the start when
  // both ends share the same Hijri year for less noise; fall back to
  // the year-on-both form across year boundaries.
  const startYear = HIJRI_FMT.formatToParts(start).find((p) => p.type === 'year')?.value;
  const endYear = HIJRI_FMT.formatToParts(end).find((p) => p.type === 'year')?.value;
  if (startYear && startYear === endYear) {
    return `${HIJRI_DAY_MONTH_FMT.format(start)} – ${HIJRI_FMT.format(end)} هـ`;
  }
  return `${HIJRI_FMT.format(start)} – ${HIJRI_FMT.format(end)} هـ`;
}

export function formatGregorianRange(start: Date, end: Date): string {
  const startYear = GREG_FMT.formatToParts(start).find((p) => p.type === 'year')?.value;
  const endYear = GREG_FMT.formatToParts(end).find((p) => p.type === 'year')?.value;
  if (startYear && startYear === endYear) {
    return `${GREG_DAY_MONTH_FMT.format(start)} – ${GREG_FMT.format(end)}`;
  }
  return `${GREG_FMT.format(start)} – ${GREG_FMT.format(end)}`;
}

// Last N week starts (Sunday 00:00 KSA), oldest first. N=8 by default —
// matches the sparkline width in the dashboard cards.
export function lastNWeekStarts(n: number, anchor: Date = new Date()): Date[] {
  const cur = startOfKsaWeek(anchor);
  return Array.from({ length: n }, (_, i) => addWeeks(cur, -(n - 1 - i)));
}
