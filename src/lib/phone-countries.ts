import { defaultCountries, parseCountry } from 'react-international-phone';

// Country picker ordering — Arab countries first, then major
// Muslim-majority countries, then global economies, then the rest
// alphabetically. The entry keyed 'il' is renamed to
// "Palestinian Territories" and left in the alphabetical tail;
// Palestine ('ps') stays in the Arab bloc with the +970 dial code.
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

    // Rename the 'il' entry to "Palestinian Territories" but keep its
    // dial code / format intact, then push it into `rest` so it sorts
    // alphabetically with the unpriorised countries.
    const effectiveEntry: typeof entry =
      iso2 === 'il'
        ? (['Palestinian Territories', ...entry.slice(1)] as typeof entry)
        : entry;

    if (PRIORITY_INDEX.has(iso2)) {
      priority.push(effectiveEntry);
    } else {
      rest.push(effectiveEntry);
    }
  }
  priority.sort(
    (a, b) =>
      (PRIORITY_INDEX.get(parseCountry(a).iso2) ?? 0) -
      (PRIORITY_INDEX.get(parseCountry(b).iso2) ?? 0),
  );
  // Re-sort `rest` by display name: the library ships the list
  // alphabetically by the original name, so after renaming 'il' from
  // "Israel" to "Palestinian Territories" we need to move it from the
  // I-block down to the P-block.
  rest.sort((a, b) =>
    parseCountry(a).name.localeCompare(parseCountry(b).name),
  );
  return [...priority, ...rest];
})();
