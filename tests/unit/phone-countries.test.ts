import { describe, it, expect } from 'vitest';
import { parseCountry } from 'react-international-phone';
import { getPhoneCountries } from '@/lib/phone-countries';

const en = getPhoneCountries('en');
const ar = getPhoneCountries('ar');

const namesEn = en.map((c) => parseCountry(c).name);
const iso2sEn = en.map((c) => parseCountry(c).iso2);

const namesAr = ar.map((c) => parseCountry(c).name);
const iso2sAr = ar.map((c) => parseCountry(c).iso2);

describe('getPhoneCountries — shape', () => {
  it('keeps every original country entry (no silent drops)', () => {
    expect(en.length).toBe(218);
    expect(ar.length).toBe(218);
  });

  it('returns the same iso2 set regardless of lang', () => {
    expect(new Set(iso2sEn)).toEqual(new Set(iso2sAr));
  });

  it('never shows "Israel" as a display name in either lang', () => {
    expect(namesEn.some((n) => /^israel$/i.test(n))).toBe(false);
    expect(namesAr.some((n) => n === 'إسرائيل' || /israel/i.test(n))).toBe(false);
  });

  it('renames the il iso2 entry per language', () => {
    const ilEn = en.find((c) => parseCountry(c).iso2 === 'il');
    const ilAr = ar.find((c) => parseCountry(c).iso2 === 'il');
    expect(parseCountry(ilEn!).name).toBe('Palestinian Territories');
    expect(parseCountry(ilAr!).name).toBe('الأراضي الفلسطينية');
    // Dial code is untouched — +972 is still IL's real ITU-assigned code.
    expect(parseCountry(ilEn!).dialCode).toBe('972');
    expect(parseCountry(ilAr!).dialCode).toBe('972');
  });

  it('keeps Palestine (ps, +970) in the Arab priority bloc in both langs', () => {
    for (const list of [en, ar]) {
      const ps = list.find((c) => parseCountry(c).iso2 === 'ps');
      expect(parseCountry(ps!).dialCode).toBe('970');
    }
    const psEnIdx = iso2sEn.indexOf('ps');
    const ilEnIdx = iso2sEn.indexOf('il');
    expect(psEnIdx).toBeLessThan(ilEnIdx);
  });
});

describe('getPhoneCountries — English', () => {
  it('puts Arab League countries at the very top, Saudi first', () => {
    const expectedHead = [
      'sa', 'eg', 'ae', 'qa', 'bh', 'kw', 'om', 'ye',
      'jo', 'ps', 'lb', 'sy', 'iq',
      'sd', 'ly', 'tn', 'dz', 'ma',
      'mr', 'dj', 'so', 'km',
    ];
    expect(iso2sEn.slice(0, expectedHead.length)).toEqual(expectedHead);
  });

  it('uses English display names for priority entries', () => {
    expect(parseCountry(en[0]).name).toMatch(/^Saudi Arabia$/i);
    expect(parseCountry(en[1]).name).toMatch(/^Egypt$/i);
  });

  it('places Muslim non-Arab bloc immediately after the Arab bloc', () => {
    expect(iso2sEn.slice(22, 25)).toEqual(['id', 'pk', 'bd']);
  });

  it('keeps South Africa right after India and Brazil next', () => {
    const inIdx = iso2sEn.indexOf('in');
    expect(iso2sEn[inIdx + 1]).toBe('za');
    expect(iso2sEn[inIdx + 2]).toBe('br');
  });

  it('sorts the unpriorised tail alphabetically by English display name', () => {
    const tailStart = iso2sEn.indexOf('ar') + 1; // Argentina = last priority
    const tailNames = namesEn.slice(tailStart);
    const sorted = [...tailNames].sort((a, b) => a.localeCompare(b, 'en'));
    expect(tailNames).toEqual(sorted);
  });

  it('places "Palestinian Territories" between Palau and Panama', () => {
    const ptIdx = namesEn.indexOf('Palestinian Territories');
    expect(ptIdx).toBeGreaterThan(-1);
    expect(namesEn[ptIdx - 1]).toBe('Palau');
    expect(namesEn[ptIdx + 1]).toBe('Panama');
  });
});

describe('getPhoneCountries — Arabic', () => {
  it('returns the Arab priority bloc in the same iso2 order as English', () => {
    const arabArIso2 = iso2sAr.slice(0, 22);
    const arabEnIso2 = iso2sEn.slice(0, 22);
    expect(arabArIso2).toEqual(arabEnIso2);
  });

  it('uses Arabic display names for known priority entries', () => {
    const byIso2 = new Map(ar.map((c) => [parseCountry(c).iso2, parseCountry(c).name]));
    // i18n-iso-countries may return one of several canonical forms — we
    // only assert the name is written in Arabic script, not a specific
    // spelling.
    expect(byIso2.get('sa')).toMatch(/[\u0600-\u06FF]/);
    expect(byIso2.get('eg')).toMatch(/[\u0600-\u06FF]/);
    expect(byIso2.get('ae')).toMatch(/[\u0600-\u06FF]/);
    expect(byIso2.get('us')).toMatch(/[\u0600-\u06FF]/);
    expect(byIso2.get('gb')).toMatch(/[\u0600-\u06FF]/);
  });

  it('overrides il with the Arabic "Palestinian Territories"', () => {
    const il = ar.find((c) => parseCountry(c).iso2 === 'il');
    expect(parseCountry(il!).name).toBe('الأراضي الفلسطينية');
  });

  it('sorts the unpriorised tail by Arabic collation', () => {
    const tailStart = iso2sAr.indexOf('ar') + 1;
    const tailNames = namesAr.slice(tailStart);
    const sorted = [...tailNames].sort((a, b) => a.localeCompare(b, 'ar'));
    expect(tailNames).toEqual(sorted);
  });
});
