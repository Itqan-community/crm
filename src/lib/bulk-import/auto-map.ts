import type { ColumnMapping, ColumnRole } from './types';

// Lowercase keyword bag per role. Match is case-insensitive substring on a
// normalised header. The first role that matches wins; if a header matches
// nothing we fall back to 'custom' (any extra columns become per-category
// answers at submit time).
const ROLE_KEYWORDS: Record<Exclude<ColumnRole, 'custom' | 'ignore'>, string[]> = {
  name: ['name', 'الاسم', 'الإسم', 'submitter', 'full name'],
  email: ['email', 'e-mail', 'mail', 'البريد', 'الإيميل', 'الايميل'],
  phone: ['phone', 'mobile', 'whatsapp', 'الهاتف', 'الجوال', 'الموبايل', 'رقم'],
  category: ['category', 'type', 'الفئة', 'النوع', 'category_key'],
  language: ['language', 'lang', 'اللغة'],
  channel: ['channel', 'source', 'القناة', 'المصدر'],
  referral: ['referral', 'referer', 'ملاحظة المصدر', 'مصدر الإحالة', 'إحالة'],
  notes: ['notes', 'note', 'comment', 'comments', 'ملاحظات', 'ملاحظة'],
};

const ROLE_ORDER: (keyof typeof ROLE_KEYWORDS)[] = [
  // Order matters: more-specific roles probe first so "channel" doesn't
  // capture a header literally named "source channel referral note".
  'email',
  'phone',
  'name',
  'category',
  'language',
  'channel',
  'referral',
  'notes',
];

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_\-]+/g, ' ');
}

function matchRole(header: string): ColumnRole {
  const norm = normalise(header);
  for (const role of ROLE_ORDER) {
    for (const kw of ROLE_KEYWORDS[role]) {
      if (norm.includes(kw.toLowerCase())) return role;
    }
  }
  return 'custom';
}

// Builds the initial mapping for a file. Each header gets its best-guess
// role; unique-role conflicts (two columns matching "email") leave the
// first match alone and demote subsequent ones to 'custom' so the user
// is forced to pick the right one in the wizard.
export function autoMap(headers: string[]): ColumnMapping[] {
  const seen = new Set<ColumnRole>();
  const uniqueRoles: ColumnRole[] = [
    'name',
    'email',
    'phone',
    'category',
    'language',
    'channel',
    'referral',
    'notes',
  ];

  return headers.map((column) => {
    let role = matchRole(column);
    if (uniqueRoles.includes(role)) {
      if (seen.has(role)) role = 'custom';
      else seen.add(role);
    }
    return { column, role };
  });
}
