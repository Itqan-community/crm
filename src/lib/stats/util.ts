// Small utilities shared across every source/* module.

import type { DateRange } from './types';

/** UTC calendar day (YYYY-MM-DD) of a Date. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The window of equal calendar length immediately preceding `range`,
 * for previous-period comparisons.
 *
 * Sized in CALENDAR days inclusive of both ends, never from a raw
 * millisecond difference: `range.end` is "now" while `range.start` is
 * midnight, so a ms-based length would round differently depending on
 * the time of day the page was loaded.
 */
export function previousWindow(range: DateRange): DateRange {
  const startDay = Date.parse(`${isoDay(range.start)}T00:00:00Z`);
  const endDay = Date.parse(`${isoDay(range.end)}T00:00:00Z`);
  const days = Math.max(1, Math.round((endDay - startDay) / 86_400_000) + 1);
  const end = new Date(startDay - 86_400_000);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { start, end };
}

/**
 * Render any thrown value as a one-line string suitable for the
 * stats error banner. Handles Error, plain {message}/{error} objects,
 * and arbitrary throws. Stays compact (≤300 chars) so a malformed
 * payload doesn't blow up the banner layout.
 */
export function describeError(err: unknown): string {
  if (!err) return 'unknown';
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    return String(obj.message ?? obj.error ?? JSON.stringify(obj).slice(0, 300));
  }
  return String(err);
}
