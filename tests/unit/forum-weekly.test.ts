import { describe, it, expect } from 'vitest';
import { buildWeeklyPeriods, DEFAULT_WEEKS, MAX_WEEKS } from '@/lib/stats/weekly';
import { spreadBuckets } from '@/lib/stats/sources/flarum-weekly';

const MS_PER_WEEK = 7 * 24 * 3_600_000;

// Fixed "now": Tuesday 8 Sep 2026. The week in progress is
// Sun 6 Sep → Sat 12 Sep, so the last COMPLETED week starts 30 Aug.
const NOW = new Date('2026-09-08T09:00:00Z');

describe('buildWeeklyPeriods', () => {
  it('defaults to the last 13 completed weeks, oldest first', () => {
    const weeks = buildWeeklyPeriods({ now: NOW });
    expect(weeks).toHaveLength(DEFAULT_WEEKS);
    // Ends on the last completed week, not the in-progress one.
    expect(weeks[weeks.length - 1].key).toBe('2026-08-30');
    expect(weeks[0].key).toBe('2026-06-07');
  });

  it('produces contiguous Sunday→Saturday KSA weeks', () => {
    const weeks = buildWeeklyPeriods({ now: NOW });
    for (const w of weeks) {
      // KSA Sunday 00:00 is 21:00 UTC on Saturday.
      expect(w.start.getUTCDay()).toBe(6);
      expect(w.start.getUTCHours()).toBe(21);
      // Inclusive end is one week later, minus a millisecond.
      expect(w.end.getTime() - w.start.getTime()).toBe(MS_PER_WEEK - 1);
    }
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i].start.getTime() - weeks[i - 1].start.getTime()).toBe(MS_PER_WEEK);
    }
  });

  // The report this table replaces covers 31 May → 29 Aug 2026. Getting
  // the same 13 columns out — same boundaries, same Hijri and Gregorian
  // headers — is the whole contract of this module.
  describe('the reported range (31 May – 29 Aug 2026)', () => {
    const weeks = buildWeeklyPeriods({ from: '2026-05-31', to: '2026-08-29', now: NOW });

    it('spans 13 weeks', () => {
      expect(weeks).toHaveLength(13);
      expect(weeks[0].key).toBe('2026-05-31');
      expect(weeks[12].key).toBe('2026-08-23');
    });

    it('labels the first and last columns as the report does', () => {
      expect(weeks[0].hijriLabel).toBe('١٤ – ٢٠ ذو الحجة');
      expect(weeks[0].gregorianLabel).toBe('٣١ مايو – ٦ يونيو');
      expect(weeks[12].hijriLabel).toBe('١٠ – ١٦ ربيع الأول');
      expect(weeks[12].gregorianLabel).toBe('٢٣ – ٢٩ أغسطس');
    });

    it('names both months when a week crosses a month boundary', () => {
      // 14–20 June 2026 = 28 Dhul Hijjah 1447 → 5 Muharram 1448.
      expect(weeks[2].hijriLabel).toBe('٢٨ ذو الحجة – ٥ محرم');
      // 26 July – 1 Aug 2026 crosses in the Gregorian calendar instead.
      expect(weeks[8].gregorianLabel).toBe('٢٦ يوليو – ١ أغسطس');
      expect(weeks[8].hijriLabel).toBe('١٢ – ١٨ صفر');
    });
  });

  it('snaps a mid-week date outward to its whole week', () => {
    // Wednesday → the Sunday that starts its week.
    const weeks = buildWeeklyPeriods({ from: '2026-06-03', to: '2026-06-17', now: NOW });
    expect(weeks.map((w) => w.key)).toEqual(['2026-05-31', '2026-06-07', '2026-06-14']);
  });

  it('collapses a reversed range to the single `to` week', () => {
    const weeks = buildWeeklyPeriods({ from: '2026-08-29', to: '2026-05-31', now: NOW });
    expect(weeks).toHaveLength(1);
    expect(weeks[0].key).toBe('2026-05-31');
  });

  it('clamps an over-wide range, keeping the most recent weeks', () => {
    const weeks = buildWeeklyPeriods({ from: '2010-01-01', to: '2026-08-29', now: NOW });
    expect(weeks).toHaveLength(MAX_WEEKS);
    expect(weeks[weeks.length - 1].key).toBe('2026-08-23');
  });

  it('ignores unparseable params instead of throwing', () => {
    const weeks = buildWeeklyPeriods({ from: 'last-tuesday', to: '??', now: NOW });
    expect(weeks.map((w) => w.key)).toEqual(
      buildWeeklyPeriods({ now: NOW }).map((w) => w.key),
    );
  });

  it('honours `to` alone by ending on that date’s week', () => {
    const weeks = buildWeeklyPeriods({ to: '2026-06-30', now: NOW });
    expect(weeks).toHaveLength(DEFAULT_WEEKS);
    expect(weeks[weeks.length - 1].key).toBe('2026-06-28');
  });
});

describe('spreadBuckets', () => {
  it('places each grouped row at its week index', () => {
    expect(spreadBuckets([{ w: 0, c: 5 }, { w: 2, c: 9 }], 4)).toEqual([5, 0, 9, 0]);
  });

  it('reads mysql2 string aggregates as numbers', () => {
    // BIGINT/DECIMAL come back as strings depending on driver settings.
    expect(spreadBuckets([{ w: '1', c: '42' }], 3)).toEqual([0, 42, 0]);
  });

  it('treats a missing week as zero, not undefined', () => {
    const out = spreadBuckets([], 3);
    expect(out).toEqual([0, 0, 0]);
    expect(out.every((v) => typeof v === 'number')).toBe(true);
  });

  it('drops rows outside the requested range', () => {
    // A row can only land out of range if the anchor and the range
    // disagree; dropping beats writing past the end of the array.
    expect(spreadBuckets([{ w: -1, c: 3 }, { w: 7, c: 4 }, { w: null, c: 1 }], 2)).toEqual([0, 0]);
  });
});
