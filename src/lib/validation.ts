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

export function isValidE164(raw: string): boolean {
  if (!raw) return false;
  const s = String(raw).replace(/[٠-٩۰-۹]/g, (d) => AR_EN_DIGITS[d] || d);
  if (!s.trim().startsWith('+')) return false;
  const digits = s.replace(/[^\d]/g, '');
  return /^[1-9]\d{7,14}$/.test(digits);
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
    if (!isValidE164(str)) return pick(UI.errPhone, lang);
  }
  if (field.kind === 'url') {
    try { new URL(str.trim()); } catch { return pick(UI.errUrl, lang); }
  }
  return null;
}
