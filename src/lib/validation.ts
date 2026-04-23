import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import type { FormFieldRow, Lang } from '@/types/database';
import { UI, pick } from './i18n';

// Pragmatic email shape — we deliberately don't try to be RFC 5322 compliant
// (no consumer-facing email validator is). Resend will reject malformed
// addresses authoritatively.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AR_EN_DIGITS: Record<string, string> = {
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
  '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
};

export function normalizePhoneInput(raw: string): string {
  if (!raw) return '';
  let s = String(raw).replace(/[٠-٩۰-۹]/g, (d) => AR_EN_DIGITS[d] || d);
  s = s.replace(/[^\d+\s\-()]/g, '');
  const hasPlus = s.trim().startsWith('+');
  s = s.replace(/\+/g, '');
  return (hasPlus ? '+' : '') + s;
}

export type PhoneErrorKey = 'short' | 'long' | 'country' | 'invalid';

export type PhoneParseResult =
  | { valid: true; e164: string; errorKey?: undefined }
  | { valid: false; e164?: undefined; errorKey: PhoneErrorKey };

// Single source of truth for phone parsing/validation. Accepts any shape the
// user might type (local, international, Arabic-digit, spaced, hyphenated)
// and — when valid — returns the canonical E.164 string we actually want to
// store. A `defaultCountry` lets us interpret national formats like
// "0551234567" without a leading "+".
export function parsePhoneSmart(
  raw: string,
  defaultCountry?: CountryCode,
): PhoneParseResult {
  if (!raw) return { valid: false, errorKey: 'invalid' };

  const normalized = normalizePhoneInput(raw);
  const digits = normalized.replace(/\D/g, '');
  const parsed = parsePhoneNumberFromString(normalized, defaultCountry);

  if (parsed?.isValid()) {
    return { valid: true, e164: parsed.number };
  }

  // Pick a specific reason so the UI can tell the user what to fix instead
  // of a generic error. Order matters: check length first (the most common
  // mistake) and only then decide whether the country is the problem.
  if (digits.length === 0) return { valid: false, errorKey: 'invalid' };
  if (digits.length < 7) return { valid: false, errorKey: 'short' };
  if (digits.length > 15) return { valid: false, errorKey: 'long' };
  if (!parsed || !parsed.country) return { valid: false, errorKey: 'country' };
  return { valid: false, errorKey: 'invalid' };
}

function phoneErrorCopy(key: PhoneErrorKey) {
  switch (key) {
    case 'short':
      return UI.errPhoneShort;
    case 'long':
      return UI.errPhoneLong;
    case 'country':
      return UI.errPhoneCountry;
    case 'invalid':
    default:
      return UI.errPhone;
  }
}

type FieldValue = string | string[] | undefined | null;

export function validateField(field: FormFieldRow, value: FieldValue, lang: Lang): string | null {
  const isEmpty =
    value == null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);

  if (field.is_required && isEmpty) return pick(UI.errRequired, lang);
  if (isEmpty) return null;

  const str = Array.isArray(value) ? value.join(',') : String(value);

  if (field.kind === 'email') {
    if (!EMAIL_REGEX.test(str.trim())) return pick(UI.errEmail, lang);
  }
  if (field.kind === 'phone') {
    const result = parsePhoneSmart(str);
    if (!result.valid) return pick(phoneErrorCopy(result.errorKey), lang);
  }
  if (field.kind === 'url') {
    try { new URL(str.trim()); } catch { return pick(UI.errUrl, lang); }
  }
  return null;
}
