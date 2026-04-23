import { describe, it, expect } from 'vitest';
import {
  detectCountryFromLocation,
  detectCountryFromLocale,
  normalizeArabicText,
  resolveDefaultCountry,
} from '@/lib/phone-detect';

describe('normalizeArabicText', () => {
  it('strips tashkeel (fatha, damma, kasra, sukun, shadda)', () => {
    expect(normalizeArabicText('بَغْدَادُ')).toBe('بغداد');
    expect(normalizeArabicText('مُحَمَّدٌ')).toBe('محمد');
  });
  it('removes tatweel', () => {
    expect(normalizeArabicText('بـــغداد')).toBe('بغداد');
  });
  it('unifies alef hamzas', () => {
    expect(normalizeArabicText('أحمد')).toBe('احمد');
    expect(normalizeArabicText('إسطنبول')).toBe('اسطنبول');
    expect(normalizeArabicText('آل')).toBe('ال');
  });
  it('maps ta marbuta to ha', () => {
    expect(normalizeArabicText('المدينة')).toBe('المدينه');
    expect(normalizeArabicText('جدة')).toBe('جده');
  });
  it('maps alef maksura to ya', () => {
    expect(normalizeArabicText('موسى')).toBe('موسي');
  });
  it('lowercases Latin text', () => {
    expect(normalizeArabicText('DUBAI, UAE')).toBe('dubai, uae');
  });
  it('leaves already-normalised text alone', () => {
    expect(normalizeArabicText('الرياض')).toBe('الرياض');
  });
});

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
    ['مسقط', 'OM'],
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

  it('detects Baghdad written with just the city name', () => {
    expect(detectCountryFromLocation('بغداد')).toBe('IQ');
    expect(detectCountryFromLocation('Baghdad')).toBe('IQ');
  });

  it('tolerates diacritics in the city name', () => {
    expect(detectCountryFromLocation('بَغْدَاد')).toBe('IQ');
    expect(detectCountryFromLocation('الرِّياض')).toBe('SA');
  });

  it('accepts ta marbuta / ha equivalents', () => {
    // user types with ه instead of ة
    expect(detectCountryFromLocation('جده')).toBe('SA');
    expect(detectCountryFromLocation('المدينه المنوره')).toBe('SA');
    expect(detectCountryFromLocation('القاهره')).toBe('EG');
  });

  it('accepts plain alef instead of hamza-bearing alef', () => {
    expect(detectCountryFromLocation('الامارات')).toBe('AE');
    expect(detectCountryFromLocation('اسطنبول')).toBe('TR');
    expect(detectCountryFromLocation('الاردن')).toBe('JO');
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
  it('resolves Iraq from a city-only location', () => {
    expect(
      resolveDefaultCountry({ location: 'بغداد', lang: 'ar' }),
    ).toBe('IQ');
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
