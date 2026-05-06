import type {
  FormCategoryRow,
  Lang,
  SourceChannelKey,
} from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';
import { EMAIL_REGEX, parsePhoneSmart } from '@/lib/validation';
import { SOURCE_CHANNELS } from '@/lib/source-channels';
import type {
  ColumnMapping,
  ParsedFile,
  RowValues,
  ValidatedRow,
} from './types';

const VALID_CHANNEL_KEYS = new Set<string>(SOURCE_CHANNELS.map((c) => c.key));

// Snapshot of existing submissions, indexed by lowercased email for O(1)
// dup-lookup per row. Phone-based dedup needs a server-side query against
// submission_answers (phones don't live on the row itself); we'll add it
// in the BE phase rather than carry an unused stub here.
type DuplicateIndex = {
  byEmail: Map<string, SubmissionListRow>;
};

export function buildDuplicateIndex(
  existing: SubmissionListRow[],
): DuplicateIndex {
  const byEmail = new Map<string, SubmissionListRow>();
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

export function validateRows(
  parsed: ParsedFile,
  mapping: ColumnMapping[],
  opts: ValidateOptions,
): ValidatedRow[] {
  // Index columns by role for fast lookup. Multi-instance roles ('custom',
  // 'ignore') stay as a list so we can iterate.
  const singleRoles = [
    'name', 'email', 'phone', 'category', 'language',
    'channel', 'referral', 'notes',
  ] as const;
  const colByRole = new Map<string, string>();
  const customCols: string[] = [];
  for (const m of mapping) {
    if (m.role === 'ignore') continue;
    if (m.role === 'custom') customCols.push(m.column);
    else if (singleRoles.includes(m.role as (typeof singleRoles)[number])) {
      // First mapping wins for unique roles; the wizard prevents duplicates
      // up front but we're defensive here too.
      if (!colByRole.has(m.role)) colByRole.set(m.role, m.column);
    }
  }

  const categoryByKey = new Map(opts.categories.map((c) => [c.key.toLowerCase(), c]));

  return parsed.rows.map((raw, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ----- Name -----
    const name = (raw[colByRole.get('name') ?? ''] ?? '').trim();
    if (!name) errors.push('الاسم مطلوب');

    // ----- Email -----
    const emailRaw = (raw[colByRole.get('email') ?? ''] ?? '').trim().toLowerCase();
    let email: string | null = null;
    if (emailRaw) {
      if (EMAIL_REGEX.test(emailRaw)) email = emailRaw;
      else errors.push('بريد غير صحيح');
    }

    // ----- Phone -----
    const phoneRaw = (raw[colByRole.get('phone') ?? ''] ?? '').trim();
    let phone: string | null = null;
    if (phoneRaw) {
      const r = parsePhoneSmart(phoneRaw);
      if (r.valid) phone = r.e164;
      else errors.push('رقم هاتف غير صحيح');
    }

    if (!email && !phone && !errors.includes('الاسم مطلوب')) {
      // Only add the contact-required error if there isn't already a
      // "wrong format" error for either field; otherwise the user sees
      // both "invalid email" and "contact required" which is noisy.
      if (!emailRaw && !phoneRaw) errors.push('أدخل البريد أو رقم الهاتف على الأقل');
    }

    // ----- Category (per-row) -----
    const categoryCellRaw = (raw[colByRole.get('category') ?? ''] ?? '').trim();
    let category_key: string | null = null;
    let category_id: string | null = null;
    if (!categoryCellRaw) {
      errors.push('الفئة مطلوبة');
    } else {
      const matched = categoryByKey.get(categoryCellRaw.toLowerCase());
      if (!matched) {
        errors.push(`فئة غير معروفة: ${categoryCellRaw}`);
      } else if (!matched.is_active) {
        errors.push(`الفئة غير مفعّلة: ${categoryCellRaw}`);
      } else {
        category_key = matched.key;
        category_id = matched.id;
      }
    }

    // ----- Language -----
    const langRaw = (raw[colByRole.get('language') ?? ''] ?? '').trim().toLowerCase();
    let language: Lang = 'ar';
    if (langRaw) {
      if (langRaw === 'ar' || langRaw === 'arabic' || langRaw === 'العربية') language = 'ar';
      else if (langRaw === 'en' || langRaw === 'english' || langRaw === 'الإنجليزية') language = 'en';
      else errors.push(`لغة غير صحيحة: ${langRaw}`);
    }

    // ----- Channel + referral -----
    let channel: SourceChannelKey = opts.defaultChannel;
    const channelRaw = (raw[colByRole.get('channel') ?? ''] ?? '').trim().toLowerCase();
    if (channelRaw) {
      if (VALID_CHANNEL_KEYS.has(channelRaw)) channel = channelRaw as SourceChannelKey;
      else errors.push(`قناة غير معروفة: ${channelRaw}`);
    }
    const referralRaw = (raw[colByRole.get('referral') ?? ''] ?? '').trim();
    const referral = referralRaw || opts.defaultReferral;

    // ----- Notes -----
    const notesRaw = (raw[colByRole.get('notes') ?? ''] ?? '').trim();
    const notes = notesRaw || null;

    // ----- Custom answers (any column not mapped to a role above) -----
    const custom_answers: Record<string, string> = {};
    for (const col of customCols) {
      const v = (raw[col] ?? '').trim();
      if (v) custom_answers[col] = v;
    }

    // ----- Duplicate detection (email only; see DuplicateIndex comment) -----
    if (email && opts.duplicateIndex.byEmail.has(email)) {
      const dup = opts.duplicateIndex.byEmail.get(email)!;
      warnings.push(`بريد مكرر — موجود مسبقًا (${dup.reference_no})`);
    }

    const values: RowValues = {
      name,
      email,
      phone,
      category_key,
      category_id,
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
