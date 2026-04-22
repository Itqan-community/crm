import { describe, it, expect } from 'vitest';
import { pick, stepOf, thanksBody, UI } from '@/lib/i18n';

describe('pick', () => {
  it('returns lang-specific value from Bilingual object', () => {
    expect(pick({ ar: 'مرحباً', en: 'Hello' }, 'ar')).toBe('مرحباً');
    expect(pick({ ar: 'مرحباً', en: 'Hello' }, 'en')).toBe('Hello');
  });
  it('returns string as-is regardless of lang', () => {
    expect(pick('unchanged', 'ar')).toBe('unchanged');
    expect(pick('unchanged', 'en')).toBe('unchanged');
  });
  it('returns empty string for null or undefined', () => {
    expect(pick(null, 'ar')).toBe('');
    expect(pick(undefined, 'en')).toBe('');
  });
  it('works against every UI entry', () => {
    for (const key of Object.keys(UI) as (keyof typeof UI)[]) {
      const v = UI[key];
      if (typeof v === 'object' && 'ar' in v && 'en' in v) {
        expect(pick(v, 'ar')).toBeTruthy();
        expect(pick(v, 'en')).toBeTruthy();
      }
    }
  });
});

describe('stepOf', () => {
  it('Arabic: "{a} من {b}"', () => {
    expect(stepOf(2, 5, 'ar')).toBe('2 من 5');
  });
  it('English: "{a} of {b}"', () => {
    expect(stepOf(2, 5, 'en')).toBe('2 of 5');
  });
});

describe('thanksBody', () => {
  it('splits into 3 parts around the duration', () => {
    const parts = thanksBody('٣ أيام عمل', 'ar');
    expect(parts).toHaveLength(3);
    expect(parts[1]).toBe('٣ أيام عمل');
    expect(parts[0] + parts[1] + parts[2]).toContain('٣ أيام عمل');
  });
  it('English variant wraps the duration the same way', () => {
    const parts = thanksBody('3 business days', 'en');
    expect(parts[1]).toBe('3 business days');
  });
});
