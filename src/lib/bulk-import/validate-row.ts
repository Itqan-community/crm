import type {
  FormCategoryRow,
  Lang,
  SourceChannelKey,
} from '@/types/database';
import { EMAIL_REGEX, parsePhoneSmart } from '@/lib/validation';
import { isValidChannelKey } from '@/lib/source-channels';
import type {
  ColumnMapping,
  ParsedFile,
  RowValues,
  ValidatedRow,
} from './types';

// Minimal projection of an existing submission, for client-side dup
// detection. Defined locally so this pure module doesn't have to import
// the ExistingSubmissionRef shape from the query layer (cross-layer coupling
// belongs at the call site, not inside the validator).
export type ExistingSubmissionRef = {
  reference_no: string;
  submitter_email: string;
};

// Snapshot of existing submissions, indexed by lowercased email for O(1)
// dup-lookup per row. Phone-based dedup needs a server-side query against
// submission_answers (phones don't live on the row itself); we'll add it
// in the BE phase rather than carry an unused stub here.
type DuplicateIndex = {
  byEmail: Map<string, ExistingSubmissionRef>;
};

export function buildDuplicateIndex(
  existing: ExistingSubmissionRef[],
): DuplicateIndex {
  const byEmail = new Map<string, ExistingSubmissionRef>();
  for (const r of existing) {
    if (r.submitter_email) byEmail.set(r.submitter_email.toLowerCase(), r);
  }
  return { byEmail };
}

export type ValidateOptions = {
  defaultChannel: SourceChannelKey;
  defaultReferral: string | null;
  categories: FormCategoryRow[];
  duplicateIndex: DuplicateIndex;
};

// ---------------------------------------------------------------------
// Per-row helpers. Each one reads its raw cell (already trimmed where
// useful), pushes any errors/warnings, and returns the resolved value.
// They're side-effecty by design — passing accumulators around keeps the
// orchestrator below tidy without forcing each step into a result tuple.
// ---------------------------------------------------------------------

function resolveName(raw: string, errors: string[]): string {
  const name = raw.trim();
  if (!name) errors.push('الاسم مطلوب');
  return name;
}

function resolveEmail(raw: string, errors: string[]): string | null {
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (EMAIL_REGEX.test(email)) return email;
  errors.push('بريد غير صحيح');
  return null;
}

function resolvePhone(raw: string, errors: string[]): string | null {
  const phoneRaw = raw.trim();
  if (!phoneRaw) return null;
  const r = parsePhoneSmart(phoneRaw);
  if (r.valid) return r.e164;
  errors.push('رقم هاتف غير صحيح');
  return null;
}

function resolveCategory(
  raw: string,
  errors: string[],
  byKey: Map<string, FormCategoryRow>,
): { id: string | null; key: string | null } {
  const cell = raw.trim();
  if (!cell) {
    errors.push('الفئة مطلوبة');
    return { id: null, key: null };
  }
  const matched = byKey.get(cell.toLowerCase());
  if (!matched) {
    errors.push(`فئة غير معروفة: ${cell}`);
    return { id: null, key: null };
  }
  if (!matched.is_active) {
    errors.push(`الفئة غير مفعّلة: ${cell}`);
    return { id: null, key: null };
  }
  return { id: matched.id, key: matched.key };
}

function resolveLanguage(raw: string, errors: string[]): Lang {
  const lang = raw.trim().toLowerCase();
  if (!lang) return 'ar';
  if (['ar', 'arabic', 'العربية'].includes(lang)) return 'ar';
  if (['en', 'english', 'الإنجليزية'].includes(lang)) return 'en';
  errors.push(`لغة غير صحيحة: ${lang}`);
  return 'ar';
}

function resolveChannel(
  raw: string,
  fallback: SourceChannelKey,
  errors: string[],
): SourceChannelKey {
  const channel = raw.trim().toLowerCase();
  if (!channel) return fallback;
  if (isValidChannelKey(channel)) return channel;
  errors.push(`قناة غير معروفة: ${channel}`);
  return fallback;
}

function resolveCustomAnswers(
  raw: Record<string, string>,
  customCols: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of customCols) {
    const v = (raw[col] ?? '').trim();
    if (v) out[col] = v;
  }
  return out;
}

function checkContactRequired(
  email: string | null,
  phone: string | null,
  emailRaw: string,
  phoneRaw: string,
  errors: string[],
): void {
  // Skip if either field already raised a format error — otherwise the
  // user sees "invalid email" + "contact required" together which is noisy.
  if (email || phone) return;
  if (emailRaw || phoneRaw) return;
  errors.push('أدخل البريد أو رقم الهاتف على الأقل');
}

function checkEmailDuplicate(
  email: string | null,
  index: DuplicateIndex,
  warnings: string[],
): void {
  if (!email) return;
  const dup = index.byEmail.get(email);
  if (dup) warnings.push(`بريد مكرر — موجود مسبقًا (${dup.reference_no})`);
}

// Build a column→header lookup once per call. Single-instance roles use
// the first mapping to win; 'custom' columns are kept as a flat list.
function indexColumns(mapping: ColumnMapping[]): {
  byRole: Map<string, string>;
  customCols: string[];
} {
  const SINGLE = new Set(['name', 'email', 'phone', 'category', 'language', 'channel', 'referral', 'notes']);
  const byRole = new Map<string, string>();
  const customCols: string[] = [];
  for (const m of mapping) {
    if (m.role === 'ignore') continue;
    if (m.role === 'custom') {
      customCols.push(m.column);
      continue;
    }
    if (SINGLE.has(m.role) && !byRole.has(m.role)) byRole.set(m.role, m.column);
  }
  return { byRole, customCols };
}

export function validateRows(
  parsed: ParsedFile,
  mapping: ColumnMapping[],
  opts: ValidateOptions,
): ValidatedRow[] {
  const { byRole, customCols } = indexColumns(mapping);
  const categoryByKey = new Map(
    opts.categories.map((c) => [c.key.toLowerCase(), c]),
  );
  const cell = (role: string, raw: Record<string, string>): string =>
    raw[byRole.get(role) ?? ''] ?? '';

  return parsed.rows.map((raw, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const emailRaw = cell('email', raw);
    const phoneRaw = cell('phone', raw);

    const name = resolveName(cell('name', raw), errors);
    const email = resolveEmail(emailRaw, errors);
    const phone = resolvePhone(phoneRaw, errors);
    checkContactRequired(email, phone, emailRaw, phoneRaw, errors);

    const category = resolveCategory(cell('category', raw), errors, categoryByKey);
    const language = resolveLanguage(cell('language', raw), errors);
    const channel = resolveChannel(cell('channel', raw), opts.defaultChannel, errors);

    const referral = cell('referral', raw).trim() || opts.defaultReferral;
    const notes = cell('notes', raw).trim() || null;
    const custom_answers = resolveCustomAnswers(raw, customCols);

    checkEmailDuplicate(email, opts.duplicateIndex, warnings);

    const values: RowValues = {
      name,
      email,
      phone,
      category_key: category.key,
      category_id: category.id,
      language,
      channel,
      referral,
      notes,
      custom_answers,
    };

    const status: ValidatedRow['status'] = errors.length > 0
      ? 'error'
      : warnings.length > 0
        ? 'warning'
        : 'ok';

    return { rowIndex: idx + 1, raw, values, status, errors, warnings };
  });
}
