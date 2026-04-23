import type { CountryCode } from 'libphonenumber-js';
import type { Lang } from '@/types/database';

// Strip diacritics and unify common letter variants so a user typing
// "بَغْدَاد"، "المدينه" (with ه), or "إسطنبول" (with إ) still matches the
// canonical keywords listed below. Mirrors the normalisations people
// actually intuit: tashkeel/tatweel vanish, hamzas on alef collapse to
// plain alef, alef maksura → ya, ta marbuta → ha. Output is lower-cased
// so English keywords match in any case.
export function normalizeArabicText(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670\u0610-\u061A]/g, '') // tashkeel + quranic marks
    .replace(/\u0640/g, '')                              // tatweel ـ
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')          // آ أ إ → ا
    .replace(/\u0649/g, '\u064A')                        // ى → ي
    .replace(/\u0629/g, '\u0647')                        // ة → ه
    .replace(/\u0624/g, '\u0648')                        // ؤ → و
    .replace(/\u0626/g, '\u064A')                        // ئ → ي
    .toLowerCase();
}

// A pragmatic keyword map for predicting a country from the free-text
// "country & city" answer. Entries are matched via substring after
// Arabic normalisation, so each entry's keywords are written in their
// canonical (diacritic-free) form.
const COUNTRY_KEYWORDS: Array<{ keywords: string[]; code: CountryCode }> = [
  { code: 'SA', keywords: ['السعوديه', 'سعودي', 'الرياض', 'جده', 'مكه', 'المدينه', 'الدمام', 'الطائف', 'الخبر', 'تبوك', 'saudi', 'ksa', 'riyadh', 'jeddah', 'mecca', 'makkah', 'medina', 'dammam'] },
  { code: 'AE', keywords: ['الامارات', 'اماراتي', 'دبي', 'ابوظبي', 'الشارقه', 'العين', 'عجمان', 'emirates', 'uae', 'dubai', 'abu dhabi', 'abudhabi', 'sharjah'] },
  { code: 'EG', keywords: ['مصر', 'مصري', 'القاهره', 'الاسكندريه', 'الجيزه', 'طنطا', 'المنصوره', 'اسيوط', 'egypt', 'cairo', 'alexandria', 'giza'] },
  { code: 'KW', keywords: ['الكويت', 'كويتي', 'kuwait'] },
  { code: 'QA', keywords: ['قطر', 'قطري', 'الدوحه', 'qatar', 'doha'] },
  { code: 'BH', keywords: ['البحرين', 'بحريني', 'المنامه', 'bahrain', 'manama'] },
  { code: 'OM', keywords: ['سلطنه عمان', 'عماني', 'مسقط', 'صلاله', 'oman', 'muscat', 'salalah'] },
  { code: 'JO', keywords: ['الاردن', 'اردني', 'عمان الاردن', 'اربد', 'jordan', 'amman', 'irbid'] },
  { code: 'LB', keywords: ['لبنان', 'لبناني', 'بيروت', 'طرابلس لبنان', 'lebanon', 'beirut'] },
  { code: 'SY', keywords: ['سوريا', 'سوري', 'دمشق', 'حلب', 'حمص', 'syria', 'damascus', 'aleppo'] },
  { code: 'IQ', keywords: ['العراق', 'عراقي', 'بغداد', 'البصره', 'الموصل', 'اربيل', 'النجف', 'كربلاء', 'iraq', 'baghdad', 'basra', 'mosul', 'erbil'] },
  { code: 'PS', keywords: ['فلسطين', 'فلسطيني', 'القدس', 'غزه', 'رام الله', 'الخليل', 'نابلس', 'palestine', 'gaza', 'jerusalem', 'ramallah', 'hebron', 'nablus'] },
  { code: 'YE', keywords: ['اليمن', 'يمني', 'صنعاء', 'عدن', 'تعز', 'yemen', 'sanaa', 'aden'] },
  { code: 'MA', keywords: ['المغرب', 'مغربي', 'الرباط', 'الدار البيضاء', 'فاس', 'مراكش', 'طنجه', 'morocco', 'rabat', 'casablanca', 'fez', 'marrakech', 'tangier'] },
  { code: 'DZ', keywords: ['الجزائر', 'جزائري', 'وهران', 'قسنطينه', 'algeria', 'algiers', 'oran'] },
  { code: 'TN', keywords: ['تونس', 'تونسي', 'صفاقس', 'tunisia', 'tunis', 'sfax'] },
  { code: 'LY', keywords: ['ليبيا', 'ليبي', 'طرابلس ليبيا', 'بنغازي', 'libya', 'tripoli', 'benghazi'] },
  { code: 'SD', keywords: ['السودان', 'سوداني', 'الخرطوم', 'sudan', 'khartoum'] },
  { code: 'MR', keywords: ['موريتانيا', 'موريتاني', 'نواكشوط', 'mauritania', 'nouakchott'] },
  { code: 'SO', keywords: ['الصومال', 'صومالي', 'مقديشو', 'somalia', 'mogadishu'] },
  { code: 'DJ', keywords: ['جيبوتي', 'djibouti'] },
  { code: 'KM', keywords: ['جزر القمر', 'موروني', 'comoros', 'moroni'] },
  { code: 'TR', keywords: ['تركيا', 'تركي', 'اسطنبول', 'انقره', 'ازمير', 'turkey', 'istanbul', 'ankara', 'izmir'] },
  { code: 'IR', keywords: ['ايران', 'ايراني', 'طهران', 'اصفهان', 'مشهد', 'iran', 'tehran', 'isfahan', 'mashhad'] },
  { code: 'MY', keywords: ['ماليزيا', 'ماليزي', 'كوالالمبور', 'malaysia', 'kuala lumpur'] },
  { code: 'ID', keywords: ['اندونيسيا', 'اندونيسي', 'جاكرتا', 'indonesia', 'jakarta'] },
  { code: 'PK', keywords: ['باكستان', 'باكستاني', 'كراتشي', 'لاهور', 'اسلام اباد', 'pakistan', 'karachi', 'lahore', 'islamabad'] },
  { code: 'BD', keywords: ['بنغلاديش', 'دكا', 'bangladesh', 'dhaka'] },
  { code: 'IN', keywords: ['الهند', 'هندي', 'دلهي', 'مومباي', 'بنغالور', 'india', 'delhi', 'mumbai', 'bangalore'] },
  { code: 'GB', keywords: ['المملكه المتحده', 'بريطانيا', 'لندن', 'uk', 'united kingdom', 'britain', 'london'] },
  { code: 'US', keywords: ['امريكا', 'الولايات المتحده', 'usa', 'us', 'united states', 'new york', 'california'] },
  { code: 'CA', keywords: ['كندا', 'canada', 'toronto', 'montreal', 'vancouver'] },
  { code: 'AU', keywords: ['استراليا', 'australia', 'sydney', 'melbourne'] },
  { code: 'DE', keywords: ['المانيا', 'برلين', 'germany', 'berlin', 'munich'] },
  { code: 'FR', keywords: ['فرنسا', 'فرنسي', 'باريس', 'france', 'paris'] },
];

// Normalise keywords once at module load so repeated calls stay cheap.
const NORMALIZED_COUNTRY_KEYWORDS = COUNTRY_KEYWORDS.map(({ code, keywords }) => ({
  code,
  keywords: keywords.map(normalizeArabicText),
}));

export function detectCountryFromLocation(
  location: string | null | undefined,
): CountryCode | undefined {
  if (!location) return undefined;
  const normalized = normalizeArabicText(location);
  if (!normalized.trim()) return undefined;
  for (const { keywords, code } of NORMALIZED_COUNTRY_KEYWORDS) {
    if (keywords.some((k) => normalized.includes(k))) return code;
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
