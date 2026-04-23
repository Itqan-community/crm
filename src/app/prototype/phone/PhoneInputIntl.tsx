'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PhoneInput,
  defaultCountries,
  parseCountry,
} from 'react-international-phone';
import 'react-international-phone/style.css';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { normalizePhoneInput } from '@/lib/validation';

type Props = {
  defaultCountry: CountryCode;
};

// Country picker ordering — Arab countries first, then major
// Muslim-majority countries, then global powers, then the rest
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

const COUNTRIES = (() => {
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

export function PhoneInputIntl({ defaultCountry }: Props) {
  const [value, setValue] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the latest default country in a ref so the DOM listener below can
  // read it without re-subscribing on every prop change.
  const defaultCountryRef = useRef(defaultCountry);
  useEffect(() => {
    defaultCountryRef.current = defaultCountry;
  }, [defaultCountry]);

  // The library's internal AsYouType formatter only recognises ASCII digits
  // and has no notion of national trunk prefixes. We intercept `beforeinput`
  // on the native input to handle two cases the library misses:
  //   • Arabic / Persian numerals (٠-٩, ۰-۹) get converted to ASCII.
  //   • Pasted national numbers (e.g. "0551234567", "٠٥٥١٢٣٤٥٦٧") are routed
  //     through libphonenumber-js with the resolved default country so the
  //     user ends up with a proper E.164 value instead of a literal
  //     "+0551234567".
  useEffect(() => {
    const input = wrapRef.current?.querySelector<HTMLInputElement>(
      'input.react-international-phone-input',
    );
    if (!input) return;

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    const hasNonAsciiDigits = (s: string) => /[٠-٩۰-۹]/.test(s);
    const digitsOnly = (s: string) => s.replace(/\D/g, '');

    const insertNormalizedAtCursor = (normalizedChunk: string) => {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const nextValue = input.value.slice(0, start) + normalizedChunk + input.value.slice(end);
      valueSetter?.call(input, nextValue);
      const cursor = start + normalizedChunk.length;
      input.setSelectionRange(cursor, cursor);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const replaceEntireValueWithE164 = (e164: string) => {
      valueSetter?.call(input, e164);
      input.setSelectionRange(e164.length, e164.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const handleBeforeInput = (e: Event) => {
      const ev = e as InputEvent;
      const data = ev.data;
      if (!data) return;

      const hasArabic = hasNonAsciiDigits(data);
      const isPaste =
        ev.inputType === 'insertFromPaste' || ev.inputType === 'insertFromDrop';
      // A standalone chunk of digits (≥ 7) is treated as a "bulk" number even
      // for plain typing — covers autofill and browser contact suggestions
      // that land as `insertReplacementText`.
      const looksLikeFullNumber = digitsOnly(data).length >= 7;

      if (!hasArabic && !isPaste && !looksLikeFullNumber) return;

      ev.preventDefault();
      const normalized = normalizePhoneInput(data);

      if (isPaste || looksLikeFullNumber) {
        const parsed = parsePhoneNumberFromString(
          normalized,
          defaultCountryRef.current,
        );
        if (parsed?.number) {
          replaceEntireValueWithE164(parsed.number);
          return;
        }
      }

      insertNormalizedAtCursor(normalized);
    };

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (!text) return;
      const normalized = normalizePhoneInput(text);
      const parsed = parsePhoneNumberFromString(
        normalized,
        defaultCountryRef.current,
      );
      if (parsed?.number) {
        e.preventDefault();
        replaceEntireValueWithE164(parsed.number);
      }
    };

    input.addEventListener('beforeinput', handleBeforeInput);
    input.addEventListener('paste', handlePaste);
    return () => {
      input.removeEventListener('beforeinput', handleBeforeInput);
      input.removeEventListener('paste', handlePaste);
    };
  }, []);

  const parsed = useMemo(() => {
    if (!value) return null;
    return parsePhoneNumberFromString(value);
  }, [value]);

  const valid = Boolean(parsed?.isValid());
  const e164 = parsed?.number ?? null;
  const international = parsed?.formatInternational() ?? null;
  const type = parsed?.getType() ?? null;
  const country = parsed?.country ?? null;

  return (
    <div className="w-full space-y-4">
      <div className="phone-intl-wrap" ref={wrapRef}>
        <PhoneInput
          defaultCountry={defaultCountry.toLowerCase() as Lowercase<CountryCode>}
          value={value}
          onChange={setValue}
          countries={COUNTRIES}
          inputProps={{ dir: 'ltr' }}
          className="phone-intl-input"
        />
      </div>

      <div
        className="rounded-lg p-4 text-[13px] font-mono space-y-1.5"
        style={{ background: 'var(--rule-soft)', color: 'var(--fg)' }}
      >
        <Row label="Default country" value={defaultCountry} />
        <Row label="Raw value" value={value || '—'} />
        <Row label="E.164 (to store)" value={e164 || '—'} highlight={valid} />
        <Row label="International" value={international || '—'} />
        <Row label="Detected country" value={country || '—'} />
        <Row label="Type" value={type || '—'} />
        <Row label="Valid" value={valid ? '✓ yes' : value ? '✗ no' : '—'} />
      </div>

      <style jsx global>{`
        .phone-intl-wrap .react-international-phone-input-container {
          border-bottom: 2px solid var(--rule);
          transition: border-color 120ms ease;
        }
        .phone-intl-wrap .react-international-phone-input-container:focus-within {
          border-bottom-color: var(--accent);
        }
        .phone-intl-wrap .react-international-phone-country-selector-button {
          background: transparent;
          border: none;
          padding: 0 8px;
          height: auto;
        }
        .phone-intl-wrap .react-international-phone-country-selector-dropdown {
          background: var(--bg);
          color: var(--fg);
          border: 1px solid var(--rule);
        }
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item:hover,
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item--focused {
          background: var(--rule-soft);
        }
        .phone-intl-wrap .react-international-phone-input {
          background: transparent;
          border: none;
          color: var(--fg);
          caret-color: var(--accent);
          font-size: clamp(20px, 2.4vw, 26px);
          font-weight: 500;
          padding: 0 0 12px 0;
          outline: none;
          letter-spacing: 0.02em;
          width: 100%;
        }
        .phone-intl-wrap .react-international-phone-input::placeholder {
          color: var(--muted);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-3" dir="ltr">
      <span className="shrink-0 w-40" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span
        className="break-all"
        style={{
          color: highlight ? 'var(--accent)' : 'var(--fg)',
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
