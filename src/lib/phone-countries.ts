import { defaultCountries, parseCountry } from 'react-international-phone';
import countries from 'i18n-iso-countries';
import arLocale from 'i18n-iso-countries/langs/ar.json';
import enLocale from 'i18n-iso-countries/langs/en.json';
import type { Lang } from '@/types/database';

// Register once at module load. i18n-iso-countries uses an internal
// singleton, so double-registering in HMR or tests is a no-op.
countries.registerLocale(arLocale);
countries.registerLocale(enLocale);

// Country picker ordering — Arab countries first, then major
// Muslim-majority countries, then global economies, then the rest
// alphabetically by display name (language-aware). Israel ('il') is
// renamed to "Palestinian Territories" / "الأراضي الفلسطينية" and
// demoted into the alphabetical tail; Palestine ('ps', +970) stays in
// the Arab priority bloc.
const PRIORITY_ISO2: string[] = [
  // --- Arab League (22) ---
  'sa', 'eg', 'ae', 'qa', 'bh', 'kw', 'om', 'ye',
  'jo', 'ps', 'lb', 'sy', 'iq',
  'sd', 'ly', 'tn', 'dz', 'ma',
  'mr', 'dj', 'so', 'km',
  // --- Major Muslim-majority, non-Arab ---
  'id', 'pk', 'bd', 'ir', 'tr', 'af', 'my',
  'uz', 'kz', 'az', 'tj', 'kg', 'tm',
  'ng', 'sn', 'ml', 'ne', 'td',
  'al', 'ba', 'xk', 'mv', 'bn',
  // --- Major world economies / destinations ---
  'us', 'gb', 'ca', 'au',
  'de', 'fr', 'it', 'es', 'nl', 'se', 'ch',
  'ru', 'cn', 'jp', 'kr', 'in', 'za',
  'br', 'mx', 'ar',
];
const PRIORITY_INDEX = new Map(PRIORITY_ISO2.map((code, i) => [code, i]));

// We override 'il' rather than removing it so the +972 dial code keeps
// working for anyone in the territory — but the dropdown shows the
// user-facing label in each locale.
const IL_OVERRIDE: Record<Lang, string> = {
  ar: 'الأراضي الفلسطينية',
  en: 'Palestinian Territories',
};

function nameFor(iso2: string, fallback: string, lang: Lang): string {
  if (iso2 === 'il') return IL_OVERRIDE[lang];
  const localised = countries.getName(iso2.toUpperCase(), lang);
  return localised || fallback;
}

// Returns the ordered country list for the react-international-phone
// dropdown, with display names translated for the given UI language.
// Recomputed per-lang (cheap: ~220 entries, plain string lookups).
export function getPhoneCountries(lang: Lang): typeof defaultCountries {
  const priority: typeof defaultCountries = [];
  const rest: typeof defaultCountries = [];
  for (const entry of defaultCountries) {
    const parsed = parseCountry(entry);
    const { iso2 } = parsed;
    const localisedName = nameFor(iso2, parsed.name, lang);
    const [, ...tail] = entry;
    const localisedEntry: typeof entry = [localisedName, ...tail] as typeof entry;

    if (PRIORITY_INDEX.has(iso2)) {
      priority.push(localisedEntry);
    } else {
      rest.push(localisedEntry);
    }
  }
  priority.sort(
    (a, b) =>
      (PRIORITY_INDEX.get(parseCountry(a).iso2) ?? 0) -
      (PRIORITY_INDEX.get(parseCountry(b).iso2) ?? 0),
  );
  // Rest is sorted alphabetically by the (now localised) display name,
  // using the lang's own collation so Arabic names sort correctly.
  rest.sort((a, b) =>
    parseCountry(a).name.localeCompare(parseCountry(b).name, lang),
  );
  return [...priority, ...rest];
}
