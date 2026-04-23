import { describe, it, expect } from 'vitest';
import {
  detectCountryFromLocation,
  detectCountryFromLocale,
  resolveDefaultCountry,
} from '@/lib/phone-detect';

describe('detectCountryFromLocation', () => {
  it.each([
    ['الرياض، المملكة العربية السعودية', 'SA'],
    ['Riyadh, Saudi Arabia', 'SA'],
    ['جدة', 'SA'],
    ['دبي، الإمارات', 'AE'],
    ['Dubai, UAE', 'AE'],
    ['القاهرة، مصر', 'EG'],
    ['Cairo, Egypt', 'EG'],
    ['الكويت', 'KW'],
    ['الدوحة، قطر', 'QA'],
    ['المنامة، البحرين', 'BH'],
    ['مسقط، عُمان', 'OM'],
    ['عمّان، الأردن', 'JO'],
    ['بيروت، لبنان', 'LB'],
    ['القدس، فلسطين', 'PS'],
    ['الخرطوم، السودان', 'SD'],
    ['الرباط، المغرب', 'MA'],
    ['تونس', 'TN'],
    ['إسطنبول، تركيا', 'TR'],
    ['جاكرتا، إندونيسيا', 'ID'],
    ['كوالالمبور، ماليزيا', 'MY'],
    ['كراتشي، باكستان', 'PK'],
    ['London, United Kingdom', 'GB'],
    ['New York, USA', 'US'],
    ['Toronto, Canada', 'CA'],
  ])('detects %s -> %s', (input, expected) => {
    expect(detectCountryFromLocation(input)).toBe(expected);
  });

  it('returns undefined for empty input', () => {
    expect(detectCountryFromLocation('')).toBeUndefined();
    expect(detectCountryFromLocation(null)).toBeUndefined();
    expect(detectCountryFromLocation(undefined)).toBeUndefined();
  });

  it('returns undefined for unrecognised location', () => {
    expect(detectCountryFromLocation('Atlantis, Lemuria')).toBeUndefined();
  });
});

describe('detectCountryFromLocale', () => {
  it('maps ar to SA', () => {
    expect(detectCountryFromLocale('ar')).toBe('SA');
  });
  it('returns undefined for en', () => {
    expect(detectCountryFromLocale('en')).toBeUndefined();
  });
});

describe('resolveDefaultCountry', () => {
  it('prefers location over locale', () => {
    expect(
      resolveDefaultCountry({ location: 'Dubai, UAE', lang: 'ar' }),
    ).toBe('AE');
  });
  it('falls back to locale when location is empty', () => {
    expect(resolveDefaultCountry({ location: '', lang: 'ar' })).toBe('SA');
    expect(resolveDefaultCountry({ location: null, lang: 'ar' })).toBe('SA');
  });
  it('falls back to SA when neither location nor locale resolves', () => {
    expect(resolveDefaultCountry({ location: '', lang: 'en' })).toBe('SA');
  });
  it('honours an explicit fallback override', () => {
    expect(
      resolveDefaultCountry({ location: '', lang: 'en', fallback: 'US' }),
    ).toBe('US');
  });
  it('returns SA for an unrecognised location in ar mode', () => {
    expect(
      resolveDefaultCountry({ location: 'Somewhere unknown', lang: 'ar' }),
    ).toBe('SA');
  });
});
