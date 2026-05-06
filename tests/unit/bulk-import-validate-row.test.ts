import { describe, it, expect } from 'vitest';
import {
  validateRows,
  buildDuplicateIndex,
} from '@/lib/bulk-import/validate-row';
import type { ColumnMapping } from '@/lib/bulk-import/types';
import type { FormCategoryRow } from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';

const CATEGORIES: FormCategoryRow[] = [
  {
    id: 'cat-app',
    key: 'app',
    label_ar: 'تطبيق',
    label_en: 'App',
    hint_ar: null,
    hint_en: null,
    icon: null,
    position: 0,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'cat-old',
    key: 'old',
    label_ar: 'قديم',
    label_en: 'Old',
    hint_ar: null,
    hint_en: null,
    icon: null,
    position: 0,
    is_active: false,
    created_at: '',
    updated_at: '',
  },
];

const FULL_MAPPING: ColumnMapping[] = [
  { column: 'name', role: 'name' },
  { column: 'email', role: 'email' },
  { column: 'phone', role: 'phone' },
  { column: 'category', role: 'category' },
  { column: 'language', role: 'language' },
  { column: 'channel', role: 'channel' },
  { column: 'referral', role: 'referral' },
  { column: 'notes', role: 'notes' },
  { column: 'organization', role: 'custom' },
];

function row(overrides: Record<string, string> = {}) {
  return {
    name: 'فاطمة',
    email: 'fatima@example.com',
    phone: '',
    category: 'app',
    language: '',
    channel: '',
    referral: '',
    notes: '',
    organization: '',
    ...overrides,
  };
}

const NO_DUPLICATES = buildDuplicateIndex([]);

const baseOpts = {
  defaultChannel: 'phone' as const,
  defaultReferral: null,
  categories: CATEGORIES,
  duplicateIndex: NO_DUPLICATES,
};

describe('validateRows — happy path', () => {
  it('marks a fully valid row as ok and resolves category_id from category_key', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row()] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('ok');
    expect(result[0].errors).toEqual([]);
    expect(result[0].values.category_id).toBe('cat-app');
    expect(result[0].values.category_key).toBe('app');
  });

  it('lowercases the email and trims surrounding whitespace', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ email: '   Foo@Example.COM  ' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].values.email).toBe('foo@example.com');
  });

  it('normalises phone to E.164 format', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [row({ email: '', phone: '+966 50 123 4567' })],
      },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].status).toBe('ok');
    expect(result[0].values.phone).toMatch(/^\+966\d+$/);
  });

  it('inherits the file-level default channel when no channel column value is set', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row()] },
      FULL_MAPPING,
      { ...baseOpts, defaultChannel: 'event' },
    );
    expect(result[0].values.channel).toBe('event');
  });

  it('per-row channel column overrides the file default', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [row({ channel: 'whatsapp' })],
      },
      FULL_MAPPING,
      { ...baseOpts, defaultChannel: 'event' },
    );
    expect(result[0].values.channel).toBe('whatsapp');
  });

  it('inherits the file-level default referral when no row-level value is given', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row()] },
      FULL_MAPPING,
      { ...baseOpts, defaultReferral: 'ملف من شريك سابق' },
    );
    expect(result[0].values.referral).toBe('ملف من شريك سابق');
  });

  it('persists non-empty custom-column values into custom_answers', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [row({ organization: 'إتقان' })],
      },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].values.custom_answers).toEqual({ organization: 'إتقان' });
  });

  it('parses lang aliases (ar/arabic/العربية and en/english/الإنجليزية)', () => {
    for (const v of ['ar', 'Arabic', 'العربية']) {
      const result = validateRows(
        { filename: 'x', headers: [], rows: [row({ language: v })] },
        FULL_MAPPING,
        baseOpts,
      );
      expect(result[0].values.language).toBe('ar');
    }
    for (const v of ['en', 'English', 'الإنجليزية']) {
      const result = validateRows(
        { filename: 'x', headers: [], rows: [row({ language: v })] },
        FULL_MAPPING,
        baseOpts,
      );
      expect(result[0].values.language).toBe('en');
    }
  });
});

describe('validateRows — error paths', () => {
  it('flags missing name', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ name: '   ' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].status).toBe('error');
    expect(result[0].errors).toContain('الاسم مطلوب');
  });

  it('flags missing contact (no email AND no phone)', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ email: '', phone: '' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].errors).toContain('أدخل البريد أو رقم الهاتف على الأقل');
  });

  it('flags malformed email', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ email: 'not-an-email' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].errors).toContain('بريد غير صحيح');
  });

  it('flags an unparseable phone', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [row({ email: '', phone: '123' })],
      },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].errors).toContain('رقم هاتف غير صحيح');
  });

  it('flags an unknown category key', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ category: 'banana' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].errors).toEqual(
      expect.arrayContaining([expect.stringContaining('فئة غير معروفة')]),
    );
  });

  it('flags an inactive category (operator must reactivate first)', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ category: 'old' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].errors).toEqual(
      expect.arrayContaining([expect.stringContaining('غير مفعّلة')]),
    );
  });

  it('flags a missing category column entirely', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ category: '' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].errors).toContain('الفئة مطلوبة');
  });

  it('flags an unknown channel value', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row({ channel: 'sms' })] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].errors).toEqual(
      expect.arrayContaining([expect.stringContaining('قناة غير معروفة')]),
    );
  });
});

describe('validateRows — duplicate detection', () => {
  const existing: SubmissionListRow[] = [
    {
      id: 's-1',
      reference_no: 'ITQ-EXIST-1',
      category_id: 'cat-app',
      language: 'ar',
      status_id: 'st-1',
      assignee_id: null,
      submitter_name: 'مستخدم سابق',
      submitter_email: 'duplicate@example.com',
      newsletter_optin: false,
      source: { channel: 'form', referral: null },
      created_at: '',
      updated_at: '',
      category: null,
      status: null,
      assignee: null,
    },
  ];

  it('warns (not errors) when an email duplicates an existing submission', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [row({ email: 'duplicate@example.com' })],
      },
      FULL_MAPPING,
      { ...baseOpts, duplicateIndex: buildDuplicateIndex(existing) },
    );
    expect(result[0].status).toBe('warning');
    expect(result[0].errors).toEqual([]);
    expect(result[0].warnings.join(' ')).toContain('ITQ-EXIST-1');
  });

  it('matches duplicates case-insensitively (email)', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [row({ email: 'DUPLICATE@example.COM' })],
      },
      FULL_MAPPING,
      { ...baseOpts, duplicateIndex: buildDuplicateIndex(existing) },
    );
    expect(result[0].status).toBe('warning');
  });
});

describe('validateRows — custom answers', () => {
  it('drops empty custom-column values from custom_answers', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [row({ organization: '   ' })],
      },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result[0].values.custom_answers).toEqual({});
  });

  it('keeps multiple custom columns side-by-side', () => {
    const mapping: ColumnMapping[] = [
      ...FULL_MAPPING,
      { column: 'website', role: 'custom' },
    ];
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [
          { ...row(), organization: 'إتقان', website: 'https://itqan.dev' },
        ],
      },
      mapping,
      baseOpts,
    );
    expect(result[0].values.custom_answers).toEqual({
      organization: 'إتقان',
      website: 'https://itqan.dev',
    });
  });

  it('ignores columns whose role is "ignore"', () => {
    const mapping: ColumnMapping[] = [
      ...FULL_MAPPING.filter((m) => m.role !== 'custom'),
      { column: 'organization', role: 'ignore' },
    ];
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [{ ...row(), organization: 'should not appear' }],
      },
      mapping,
      baseOpts,
    );
    expect(result[0].values.custom_answers).toEqual({});
  });
});

describe('validateRows — row indexing & shape', () => {
  it('uses 1-based rowIndex matching the spreadsheet data row position', () => {
    const result = validateRows(
      { filename: 'x', headers: [], rows: [row(), row(), row()] },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result.map((r) => r.rowIndex)).toEqual([1, 2, 3]);
  });

  it('returns one ValidatedRow per parsed row even if all are bad', () => {
    const result = validateRows(
      {
        filename: 'x',
        headers: [],
        rows: [
          row({ name: '', email: '', phone: '', category: '' }),
          row({ name: '', email: '', phone: '', category: '' }),
        ],
      },
      FULL_MAPPING,
      baseOpts,
    );
    expect(result).toHaveLength(2);
    for (const r of result) {
      expect(r.status).toBe('error');
    }
  });
});
