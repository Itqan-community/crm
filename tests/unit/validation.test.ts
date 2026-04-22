import { describe, it, expect } from 'vitest';
import {
  EMAIL_REGEX,
  isValidE164,
  normalizePhoneInput,
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

describe('isValidE164', () => {
  it.each<[string, boolean]>([
    ['+966551234567', true],
    ['+15551234567', true],
    ['+٩٦٦٥٥١٢٣٤٥٦٧', true],     // Arabic-Indic digits
    ['966551234567', false],       // missing +
    ['+0551234567', false],        // starts with 0 after +
    ['+12', false],                // too short
    ['+12345678901234567', false], // too long
    ['', false],
  ])('isValidE164(%s) -> %s', (input, expected) => {
    expect(isValidE164(input)).toBe(expected);
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
  it('phone + invalid returns errPhone', () => {
    expect(validateField(field({ kind: 'phone' }), '12345', 'ar')).toMatch(/رقم غير صالح/);
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
