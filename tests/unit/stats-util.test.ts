import { describe, it, expect } from 'vitest';
import { isoDay, previousWindow } from '@/lib/stats/util';

// previousWindow sizes the comparison window for both the GA source
// and the forum "returning readers" tier, so a wobble here silently
// skews two unrelated numbers.

describe('previousWindow', () => {
  it('returns an equal-length window ending the day before the current one', () => {
    // A 7-calendar-day window: Sep 2 00:00 → Sep 8 (partway through).
    const range = {
      start: new Date('2026-09-02T00:00:00Z'),
      end: new Date('2026-09-08T13:36:02Z'),
    };
    const prev = previousWindow(range);
    expect(isoDay(prev.end)).toBe('2026-09-01');
    expect(isoDay(prev.start)).toBe('2026-08-26');
  });

  it('does not change size with the time of day of `end`', () => {
    // The bug this guards: `end` is "now" and `start` is midnight, so
    // sizing from a raw ms difference rounds to 6 days before noon and
    // 7 after, moving the comparison window mid-day.
    const start = new Date('2026-09-02T00:00:00Z');
    const early = previousWindow({ start, end: new Date('2026-09-08T00:05:00Z') });
    const late = previousWindow({ start, end: new Date('2026-09-08T23:55:00Z') });
    expect(isoDay(early.start)).toBe(isoDay(late.start));
    expect(isoDay(early.end)).toBe(isoDay(late.end));
  });

  it('handles a single-day window', () => {
    const range = {
      start: new Date('2026-09-08T00:00:00Z'),
      end: new Date('2026-09-08T09:00:00Z'),
    };
    const prev = previousWindow(range);
    expect(isoDay(prev.start)).toBe('2026-09-07');
    expect(isoDay(prev.end)).toBe('2026-09-07');
  });
});
