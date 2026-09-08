// Weekly reporting periods for the forum table.
//
// One period = one KSA calendar week (Sunday → Saturday), the same
// week boundary the dashboard already uses, so a number here and a
// number on /admin lines up. Labels are Hijri-primary with Gregorian
// underneath — the shape the community report is kept in.

import {
  addWeeks,
  dateKey,
  endOfKsaWeek,
  formatGregorianRangeCompact,
  formatHijriRangeCompact,
  fromDateKey,
  startOfKsaWeek,
} from '@/lib/dashboard/calendar';

const MS_PER_WEEK = 7 * 24 * 3_600_000;

// 13 weeks ≈ one quarter — the span the report is reviewed over.
export const DEFAULT_WEEKS = 13;
// A year of weeks. The table is one COUNT-per-metric grouped query
// regardless of width, so the cap is about readability (and header
// width), not query cost.
export const MAX_WEEKS = 53;

export type WeeklyPeriod = {
  // YYYY-MM-DD of the week's Sunday, KSA. Stable id for React keys
  // and for the ?from=/?to= round-trip.
  key: string;
  // Inclusive start (UTC instant of KSA Sunday 00:00).
  start: Date;
  // Inclusive end (UTC instant of KSA Saturday 23:59:59.999).
  end: Date;
  // "١٤ – ٢٠ ذو الحجة"
  hijriLabel: string;
  // "٣١ مايو – ٦ يونيو"
  gregorianLabel: string;
};

function weekOf(input: Date): { start: Date; end: Date } {
  const start = startOfKsaWeek(input);
  return { start, end: endOfKsaWeek(start) };
}

function describe(start: Date): WeeklyPeriod {
  const end = endOfKsaWeek(start);
  return {
    key: dateKey(start),
    start,
    end,
    hijriLabel: formatHijriRangeCompact(start, end),
    gregorianLabel: formatGregorianRangeCompact(start, end),
  };
}

/**
 * Build the contiguous list of weeks to render, oldest first.
 *
 * `from`/`to` are YYYY-MM-DD (KSA) and get snapped outward to whole
 * weeks — passing a Wednesday selects the week containing it. Both are
 * optional; unparseable values fall back to the default rather than
 * erroring, because they arrive from a URL a human typed.
 *
 * Default window: the last DEFAULT_WEEKS *completed* weeks. The
 * in-progress week is excluded — a partial week next to full ones
 * reads as a collapse in activity when it's just Tuesday.
 */
export function buildWeeklyPeriods(
  opts: { from?: string; to?: string; now?: Date } = {},
): WeeklyPeriod[] {
  const now = opts.now ?? new Date();

  // Last completed week: the Sunday one week before this week's Sunday.
  const fallbackEnd = addWeeks(startOfKsaWeek(now), -1);
  const parsedTo = opts.to ? fromDateKey(opts.to) : null;
  const endStart = parsedTo ? weekOf(parsedTo).start : fallbackEnd;

  const parsedFrom = opts.from ? fromDateKey(opts.from) : null;
  const requestedStart = parsedFrom
    ? weekOf(parsedFrom).start
    : addWeeks(endStart, -(DEFAULT_WEEKS - 1));

  // `from` after `to` is a typo, not a request for a reversed range —
  // collapse to the single `to` week rather than rendering nothing.
  const span = Math.round((endStart.getTime() - requestedStart.getTime()) / MS_PER_WEEK) + 1;
  const count = Math.min(MAX_WEEKS, Math.max(1, span));

  // Clamping keeps the MOST RECENT `count` weeks: an over-wide range
  // is nearly always someone reaching further back than the cap.
  const firstStart = addWeeks(endStart, -(count - 1));

  return Array.from({ length: count }, (_, i) => describe(addWeeks(firstStart, i)));
}
