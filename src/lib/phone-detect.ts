import type { CountryCode } from 'libphonenumber-js';
import type { Lang } from '@/types/database';

// A small keyword map for predicting a country from the free-text
// "country & city" answer. Only the countries we realistically expect
// are listed — unknown inputs fall through to the locale fallback.
const COUNTRY_KEYWORDS: Array<{ match: RegExp; code: CountryCode }> = [
  { match: /(السعودية|السعوديه|سعودي|الرياض|جدة|مكة|المدينة|الدمام|saudi|ksa|riyadh|jeddah|mecca|makkah|medina)/i, code: 'SA' },
  { match: /(الإمارات|الامارات|إماراتي|اماراتي|دبي|أبوظبي|ابوظبي|الشارقة|emirates|\buae\b|dubai|abu\s*dhabi|sharjah)/i, code: 'AE' },
  { match: /(مصر|مصري|القاهرة|الإسكندرية|الاسكندرية|الجيزة|egypt|cairo|alexandria|giza)/i, code: 'EG' },
  { match: /(الكويت|كويتي|kuwait)/i, code: 'KW' },
  { match: /(قطر|قطري|الدوحة|qatar|doha)/i, code: 'QA' },
  { match: /(البحرين|بحريني|المنامة|bahrain|manama)/i, code: 'BH' },
  { match: /(عُمان|عمان\s|عماني|مسقط|\boman\b|muscat)/i, code: 'OM' },
  { match: /(الأردن|الاردن|أردني|اردني|عمّان|\bjordan\b|amman)/i, code: 'JO' },
  { match: /(لبنان|لبناني|بيروت|lebanon|beirut)/i, code: 'LB' },
  { match: /(سوريا|سوري|دمشق|syria|damascus)/i, code: 'SY' },
  { match: /(العراق|عراقي|بغداد|iraq|baghdad)/i, code: 'IQ' },
  { match: /(فلسطين|فلسطيني|القدس|غزة|palestine|gaza)/i, code: 'PS' },
  { match: /(اليمن|يمني|صنعاء|yemen|sanaa)/i, code: 'YE' },
  { match: /(المغرب|مغربي|الرباط|الدار\s*البيضاء|morocco|rabat|casablanca)/i, code: 'MA' },
  { match: /(الجزائر|جزائري|algeria|algiers)/i, code: 'DZ' },
  { match: /(تونس|تونسي|tunisia|tunis)/i, code: 'TN' },
  { match: /(ليبيا|ليبي|طرابلس|libya|tripoli)/i, code: 'LY' },
  { match: /(السودان|سوداني|الخرطوم|sudan|khartoum)/i, code: 'SD' },
  { match: /(تركيا|تركي|إسطنبول|اسطنبول|turkey|istanbul|ankara)/i, code: 'TR' },
  { match: /(ماليزيا|كوالالمبور|malaysia|kuala\s*lumpur)/i, code: 'MY' },
  { match: /(إندونيسيا|اندونيسيا|جاكرتا|indonesia|jakarta)/i, code: 'ID' },
  { match: /(باكستان|باكستاني|pakistan|karachi|lahore|islamabad)/i, code: 'PK' },
  { match: /(الهند|هندي|\bindia\b|delhi|mumbai|bangalore)/i, code: 'IN' },
  { match: /(بنغلاديش|bangladesh|dhaka)/i, code: 'BD' },
  { match: /(المملكة\s*المتحدة|بريطانيا|لندن|\buk\b|united\s*kingdom|britain|london)/i, code: 'GB' },
  { match: /(أمريكا|امريكا|الولايات\s*المتحدة|\busa\b|\bus\b|united\s*states|new\s*york|california)/i, code: 'US' },
  { match: /(كندا|canada|toronto|montreal|vancouver)/i, code: 'CA' },
  { match: /(أستراليا|استراليا|australia|sydney|melbourne)/i, code: 'AU' },
  { match: /(ألمانيا|المانيا|برلين|germany|berlin)/i, code: 'DE' },
  { match: /(فرنسا|فرنسي|باريس|france|paris)/i, code: 'FR' },
];

export function detectCountryFromLocation(
  location: string | null | undefined,
): CountryCode | undefined {
  if (!location) return undefined;
  for (const { match, code } of COUNTRY_KEYWORDS) {
    if (match.test(location)) return code;
  }
  return undefined;
}

// Arabic speakers most often sign up from Saudi Arabia. English-speakers
// are too geographically dispersed to guess, so return undefined and let
// the next fallback decide.
export function detectCountryFromLocale(lang: Lang): CountryCode | undefined {
  return lang === 'ar' ? 'SA' : undefined;
}

// The resolution order the form should use when picking a default
// country for the phone input: explicit location → locale → hard fallback.
export function resolveDefaultCountry({
  location,
  lang,
  fallback = 'SA',
}: {
  location?: string | null;
  lang: Lang;
  fallback?: CountryCode;
}): CountryCode {
  return (
    detectCountryFromLocation(location) ??
    detectCountryFromLocale(lang) ??
    fallback
  );
}
