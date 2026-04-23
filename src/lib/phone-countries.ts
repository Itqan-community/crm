import { defaultCountries, parseCountry } from 'react-international-phone';

// Country picker ordering — Arab countries first, then major
// Muslim-majority countries, then global economies, then the rest
// alphabetically (the library's default order for anything not listed).
// Israel ('il') is excluded entirely; Palestine ('ps') is included with
// the Arab bloc.
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

export const PHONE_COUNTRIES = (() => {
  const priority: typeof defaultCountries = [];
  const rest: typeof defaultCountries = [];
  for (const entry of defaultCountries) {
    const { iso2 } = parseCountry(entry);
    if (iso2 === 'il') continue;
    if (PRIORITY_INDEX.has(iso2)) {
      priority.push(entry);
    } else {
      rest.push(entry);
    }
  }
  priority.sort(
    (a, b) =>
      (PRIORITY_INDEX.get(parseCountry(a).iso2) ?? 0) -
      (PRIORITY_INDEX.get(parseCountry(b).iso2) ?? 0),
  );
  return [...priority, ...rest];
})();
