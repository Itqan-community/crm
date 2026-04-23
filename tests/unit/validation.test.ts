import { describe, it, expect } from 'vitest';
import {
  EMAIL_REGEX,
  normalizePhoneInput,
  parsePhoneSmart,
  validateField,
} from '@/lib/validation';
import type { FormFieldRow } from '@/types/database';

function field(over: Partial<FormFieldRow> = {}): FormFieldRow {
  return {
    id: 'f1',
    category_id: 'c1',
    key: 'k',
    kind: 'text',
    label_ar: 'س',
    label_en: 'q',
    help_ar: null,
    help_en: null,
    placeholder_ar: null,
    placeholder_en: null,
    is_required: false,
    is_multi: true,
    options: [],
    semantic_role: null,
    position: 0,
    is_active: true,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('EMAIL_REGEX', () => {
  it.each([
    ['ash@itqan.dev', true],
    ['ash+tag@itqan.co.uk', true],
    ['no-at-sign', false],
    ['no@dot', false],
    ['has space@itqan.dev', false],
    ['', false],
  ])('matches %s -> %s', (input, expected) => {
    expect(EMAIL_REGEX.test(input)).toBe(expected);
  });
});

describe('normalizePhoneInput', () => {
  it('converts Arabic-Indic digits to Latin', () => {
    expect(normalizePhoneInput('+٩٦٦٥٥١٢٣٤٥٦٧')).toBe('+966551234567');
  });
  it('converts Persian (Eastern Arabic) digits', () => {
    expect(normalizePhoneInput('+۹۶۶۵۵۱۲۳۴۵۶۷')).toBe('+966551234567');
  });
  it('preserves a single leading plus', () => {
    expect(normalizePhoneInput('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
  });
  it('strips invalid characters', () => {
    expect(normalizePhoneInput('+1 abc 555-1234 xyz')).toBe('+1  555-1234 ');
  });
  it('collapses multiple plus signs to one leading plus', () => {
    expect(normalizePhoneInput('++1++555')).toBe('+1555');
  });
  it('returns empty for empty input', () => {
    expect(normalizePhoneInput('')).toBe('');
  });
});

describe('parsePhoneSmart', () => {
  it('parses SA national format with defaultCountry', () => {
    const r = parsePhoneSmart('0551234567', 'SA');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.e164).toBe('+966551234567');
  });
  it('parses SA national with spaces + dashes', () => {
    const r = parsePhoneSmart('055-123-4567', 'SA');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.e164).toBe('+966551234567');
  });
  it('parses Arabic-Indic digits', () => {
    const r = parsePhoneSmart('٠٥٥١٢٣٤٥٦٧', 'SA');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.e164).toBe('+966551234567');
  });
  it('parses international format without defaultCountry', () => {
    const r = parsePhoneSmart('+966 55 123 4567');
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.e164).toBe('+966551234567');
  });
  it('flags a too-short number', () => {
    const r = parsePhoneSmart('+12', 'SA');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errorKey).toBe('short');
  });
  it('flags a number with no recognisable country', () => {
    const r = parsePhoneSmart('12345678');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errorKey).toBe('country');
  });
  it('returns invalid for empty input', () => {
    const r = parsePhoneSmart('');
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errorKey).toBe('invalid');
  });
  it('rejects garbage text', () => {
    const r = parsePhoneSmart('hello world');
    expect(r.valid).toBe(false);
  });
});

describe('validateField', () => {
  it('required + empty string returns errRequired', () => {
    expect(validateField(field({ is_required: true }), '', 'ar')).toMatch(/مطلوب/);
  });
  it('required + non-empty string returns null', () => {
    expect(validateField(field({ is_required: true }), 'value', 'ar')).toBeNull();
  });
  it('required + empty array returns errRequired', () => {
    expect(validateField(field({ is_required: true, kind: 'checkbox' }), [], 'ar')).toMatch(/مطلوب/);
  });
  it('non-required + empty returns null', () => {
    expect(validateField(field(), '', 'ar')).toBeNull();
  });
  it('email + invalid returns errEmail', () => {
    const result = validateField(field({ kind: 'email' }), 'not-an-email', 'en');
    expect(result).toMatch(/Invalid email/);
  });
  it('email + valid returns null', () => {
    expect(validateField(field({ kind: 'email' }), 'ash@itqan.dev', 'en')).toBeNull();
  });
  it('phone + invalid returns a phone-specific error', () => {
    const result = validateField(field({ kind: 'phone' }), '12345', 'ar');
    expect(result).not.toBeNull();
    expect(result).toMatch(/رقم|الدولة/);
  });
  it('phone + valid E.164 returns null', () => {
    expect(validateField(field({ kind: 'phone' }), '+966551234567', 'ar')).toBeNull();
  });
  it('url + invalid returns errUrl', () => {
    expect(validateField(field({ kind: 'url' }), 'not a url', 'en')).toMatch(/Invalid URL/);
  });
  it('url + valid returns null', () => {
    expect(validateField(field({ kind: 'url' }), 'https://itqan.dev', 'en')).toBeNull();
  });
});
