'use client';

import { useEffect, useMemo, useRef } from 'react';
import { PhoneInput as IntlPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import type { FormFieldRow, Lang } from '@/types/database';
import { normalizePhoneInput } from '@/lib/validation';
import { getPhoneCountries } from '@/lib/phone-countries';
import { ErrorNote } from './ErrorNote';

type Props = {
  field: FormFieldRow;
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  lang: Lang;
  defaultCountry?: CountryCode;
};

// Twemoji codepoints 1F1F5 1F1F8 = 🇵🇸. Uses the same CDN + version the
// react-international-phone library uses for its built-in flags, so the
// visual style matches every other country in the dropdown.
const CUSTOM_FLAGS = [
  {
    iso2: 'il' as const,
    src: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f1f5-1f1f8.svg',
  },
];

export function PhoneInput({
  value,
  onChange,
  error,
  autoFocus,
  lang,
  defaultCountry = 'SA',
}: Props) {
  // Country names in the dropdown are localised via i18n-iso-countries;
  // recompute when the UI language flips.
  const countries = useMemo(() => getPhoneCountries(lang), [lang]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the latest default country in a ref so the DOM listener below can
  // read it without re-subscribing on every prop change.
  const defaultCountryRef = useRef(defaultCountry);
  useEffect(() => {
    defaultCountryRef.current = defaultCountry;
  }, [defaultCountry]);

  // react-international-phone's internal AsYouType formatter only accepts
  // ASCII digits and has no notion of national trunk prefixes, so we wrap
  // the native input with two shims:
  //   • `beforeinput` rewrites Arabic/Persian numerals and any bulk digit
  //     payload (paste, autofill, replacement text) into an E.164 value via
  //     libphonenumber-js + the resolved default country.
  //   • `paste` is handled separately so clipboard text still gets routed
  //     through the parser even when the browser fires a pure paste event.
  useEffect(() => {
    const input = wrapRef.current?.querySelector<HTMLInputElement>(
      'input.react-international-phone-input',
    );
    if (!input) return;

    if (autoFocus) input.focus();

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    const hasNonAsciiDigits = (s: string) => /[٠-٩۰-۹]/.test(s);
    const digitsOnly = (s: string) => s.replace(/\D/g, '');

    const insertNormalizedAtCursor = (normalizedChunk: string) => {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const nextValue =
        input.value.slice(0, start) + normalizedChunk + input.value.slice(end);
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
  }, [autoFocus]);

  return (
    <div className="w-full">
      <div className="phone-intl-wrap" ref={wrapRef}>
        <IntlPhoneInput
          defaultCountry={defaultCountry.toLowerCase() as Lowercase<CountryCode>}
          value={value || ''}
          onChange={onChange}
          countries={countries}
          // The 'il' entry is renamed to "Palestinian Territories" /
          // "الأراضي الفلسطينية"; keeping the Israeli flag next to that
          // label is incoherent, so swap in the Palestinian flag
          // (twemoji codepoints 1F1F5 1F1F8) on the same CDN the library
          // uses for every other country so the style stays consistent.
          flags={CUSTOM_FLAGS}
          inputProps={{ dir: 'ltr', autoComplete: 'tel', name: 'phone' }}
        />
      </div>
      <ErrorNote>{error}</ErrorNote>

      <style jsx global>{`
        .phone-intl-wrap .react-international-phone-input-container {
          border-bottom: 2px solid var(--rule);
          transition: border-color 120ms ease;
          background: transparent;
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
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item {
          color: var(--fg);
        }
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item:hover,
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item--focused {
          background: var(--rule-soft);
        }
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item-dial-code {
          color: var(--muted);
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
