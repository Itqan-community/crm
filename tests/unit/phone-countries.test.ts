import { describe, it, expect } from 'vitest';
import { parseCountry } from 'react-international-phone';
import { PHONE_COUNTRIES } from '@/lib/phone-countries';

const names = PHONE_COUNTRIES.map((c) => parseCountry(c).name);
const iso2s = PHONE_COUNTRIES.map((c) => parseCountry(c).iso2);

describe('PHONE_COUNTRIES', () => {
  it('keeps every original country entry (no silent drops)', () => {
    // react-international-phone ships 218 countries; we should preserve
    // all of them, just reordered / renamed.
    expect(PHONE_COUNTRIES.length).toBe(218);
  });

  it('does not show "Israel" as a display name anywhere', () => {
    expect(names.some((n) => /^israel$/i.test(n))).toBe(false);
  });

  it('renames the il iso2 entry to "Palestinian Territories"', () => {
    const il = PHONE_COUNTRIES.find((c) => parseCountry(c).iso2 === 'il');
    expect(il).toBeDefined();
    expect(parseCountry(il!).name).toBe('Palestinian Territories');
    // Dial code is untouched — +972 is still IL's real ITU-assigned code.
    expect(parseCountry(il!).dialCode).toBe('972');
  });

  it('keeps Palestine (ps, +970) in the Arab priority bloc', () => {
    const ps = PHONE_COUNTRIES.find((c) => parseCountry(c).iso2 === 'ps');
    expect(ps).toBeDefined();
    expect(parseCountry(ps!).dialCode).toBe('970');
    // PS sits in the priority bloc, so its index is well before the
    // alphabetical tail where the renamed il entry lives.
    const psIdx = iso2s.indexOf('ps');
    const ilIdx = iso2s.indexOf('il');
    expect(psIdx).toBeLessThan(ilIdx);
  });

  it('puts Arab League countries at the very top, Saudi first', () => {
    const expectedHead = [
      'sa', 'eg', 'ae', 'qa', 'bh', 'kw', 'om', 'ye',
      'jo', 'ps', 'lb', 'sy', 'iq',
      'sd', 'ly', 'tn', 'dz', 'ma',
      'mr', 'dj', 'so', 'km',
    ];
    expect(iso2s.slice(0, expectedHead.length)).toEqual(expectedHead);
  });

  it('places the major Muslim-majority non-Arab bloc right after the Arab bloc', () => {
    // The first three of this bloc should be the ones we explicitly listed.
    expect(iso2s.slice(22, 25)).toEqual(['id', 'pk', 'bd']);
  });

  it('keeps South Africa right after India and Brazil next', () => {
    const inIdx = iso2s.indexOf('in');
    expect(iso2s[inIdx + 1]).toBe('za');
    expect(iso2s[inIdx + 2]).toBe('br');
  });

  it('sorts the unpriorised tail alphabetically by display name', () => {
    // After the priority list ends, remaining entries should be in
    // case-insensitive alphabetical order so "Palestinian Territories"
    // lands in the P block rather than the I block. Detect the boundary
    // dynamically so the test doesn't break if the priority list grows.
    const lastPriorityIso2 = 'ar'; // Argentina, the final entry in PRIORITY_ISO2.
    const tailStart = iso2s.indexOf(lastPriorityIso2) + 1;
    const tailNames = names.slice(tailStart);
    const sorted = [...tailNames].sort((a, b) => a.localeCompare(b));
    expect(tailNames).toEqual(sorted);
  });

  it('places "Palestinian Territories" between Palau and Panama', () => {
    const ptIdx = names.indexOf('Palestinian Territories');
    expect(ptIdx).toBeGreaterThan(-1);
    expect(names[ptIdx - 1]).toBe('Palau');
    expect(names[ptIdx + 1]).toBe('Panama');
  });
});
