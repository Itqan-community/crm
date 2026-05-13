'use server';

import { revalidatePath } from 'next/cache';
import {
  requireTeamAction,
  type AuthContext,
} from '@/lib/admin-guard';
import { EMAIL_REGEX, parsePhoneSmart } from '@/lib/validation';
import { isValidChannelKey } from '@/lib/source-channels';
import type {
  FormFieldRow,
  Lang,
  SourceChannelKey,
  SubmissionSource,
} from '@/types/database';

// Keep the referral note short — it's a hint, not a chat field. Anything
// longer is almost certainly accidental paste, and we don't want to widen
// the attack surface for storing arbitrary blobs in jsonb.
const REFERRAL_MAX_LEN = 500;
// Notes here are the team's own internal annotation; longer than the
// referral hint but still capped to keep one POST predictable.
const NOTES_MAX_LEN = 5000;

export async function setSubmissionStatus(submissionId: string, statusId: string) {
  const { supabase } = await requireTeamAction();
  const { error } = await supabase
    .from('submissions')
    .update({ status_id: statusId })
    .eq('id', submissionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath('/admin');
}

export async function archiveSubmissions(submissionIds: string[]) {
  if (submissionIds.length === 0) return;
  const { supabase } = await requireTeamAction();
  const { data: archivedStatus, error: statusErr } = await supabase
    .from('statuses')
    .select('id')
    .eq('key', 'archived')
    .maybeSingle();
  if (statusErr) throw new Error(statusErr.message);
  if (!archivedStatus) throw new Error('archived_status_missing');
  const { error } = await supabase
    .from('submissions')
    .update({ status_id: archivedStatus.id })
    .in('id', submissionIds);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function setSubmissionAssignee(submissionId: string, assigneeId: string | null) {
  const { supabase } = await requireTeamAction();
  const { error } = await supabase
    .from('submissions')
    .update({ assignee_id: assigneeId })
    .eq('id', submissionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath('/admin');
}

type ManualSubmissionInput = {
  category_id: string;
  language: Lang;
  submitter_name: string;
  submitter_email: string | null;
  submitter_phone: string | null;
  source: { channel: SourceChannelKey; referral: string | null };
  // field_id -> value entered in the modal for that custom field
  custom_answers: Record<string, string | string[] | null>;
  notes: string | null;
};

// Reusable shape for one row about to land in submission_answers.
type AnswerInsert = {
  submission_id: string;
  field_id: string;
  field_key_snap: string;
  field_label_snap: { ar: string; en: string };
  value_text: string | null;
  value_json: unknown;
};

type CleanedInput = {
  name: string;
  email: string;
  phoneE164: string | null;
  source: SubmissionSource;
};

// Validate + normalise client input. Throws with a stable error code on
// the first violation so the modal's translateError() can render Arabic.
// `channel` is the only field whose TS type doesn't survive the wire.
function validateManualInput(input: ManualSubmissionInput): CleanedInput {
  if (!isValidChannelKey(input.source.channel)) {
    throw new Error('invalid_channel');
  }

  const name = input.submitter_name.trim();
  const email = (input.submitter_email ?? '').trim().toLowerCase();
  const phoneRaw = (input.submitter_phone ?? '').trim();

  if (!name) throw new Error('name_required');
  if (!email && !phoneRaw) throw new Error('contact_required');
  if (email && !EMAIL_REGEX.test(email)) throw new Error('invalid_email');

  let phoneE164: string | null = null;
  if (phoneRaw) {
    const r = parsePhoneSmart(phoneRaw);
    if (!r.valid) throw new Error('invalid_phone');
    phoneE164 = r.e164;
  }

  const referralTrimmed = input.source.referral?.trim() ?? '';
  const source: SubmissionSource = {
    channel: input.source.channel,
    referral: referralTrimmed ? referralTrimmed.slice(0, REFERRAL_MAX_LEN) : null,
  };

  return { name, email, phoneE164, source };
}

// Confirm the category exists AND is active, then return its active
// fields. A stale browser tab could ship a deactivated id; surface the
// same `unknown_category` code in either case.
async function loadActiveCategoryFields(
  supabase: AuthContext['supabase'],
  category_id: string,
): Promise<FormFieldRow[]> {
  const { data: catRow, error: catErr } = await supabase
    .from('form_categories')
    .select('id, is_active')
    .eq('id', category_id)
    .eq('is_active', true)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);
  if (!catRow) throw new Error('unknown_category');

  const { data, error } = await supabase
    .from('form_fields')
    .select('*')
    .eq('category_id', category_id)
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as FormFieldRow[];
}

async function insertSubmissionRow(
  supabase: AuthContext['supabase'],
  input: ManualSubmissionInput,
  cleaned: CleanedInput,
): Promise<{ id: string; reference_no: string }> {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      category_id: input.category_id,
      language: input.language,
      submitter_name: cleaned.name,
      submitter_email: cleaned.email,
      newsletter_optin: false,
      source: cleaned.source,
    })
    .select('id, reference_no')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'submission_insert_failed');
  }
  return data;
}

// Build the answer-row array for a freshly-inserted submission. Phone
// (if provided) goes against the category's phone field, matching the
// public-form path. Custom answers are filtered: empties drop, and the
// reserved semantic roles (name/email/phone) are handled separately.
//
// `phoneField` is resolved upstream by `requirePhoneFieldIfNeeded`
// before INSERT, so if it's null we know phoneE164 is also null.
function buildAnswerRows(
  submissionId: string,
  fields: FormFieldRow[],
  phoneE164: string | null,
  phoneField: FormFieldRow | null,
  customAnswers: ManualSubmissionInput['custom_answers'],
): AnswerInsert[] {
  const rows: AnswerInsert[] = [];
  const RESERVED = new Set(['name', 'email', 'phone']);

  if (phoneE164 && phoneField) {
    rows.push({
      submission_id: submissionId,
      field_id: phoneField.id,
      field_key_snap: phoneField.key,
      field_label_snap: { ar: phoneField.label_ar, en: phoneField.label_en },
      value_text: phoneE164,
      value_json: null,
    });
  }

  for (const f of fields) {
    if (RESERVED.has(f.semantic_role ?? '')) continue;
    const v = customAnswers[f.id];
    const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (isEmpty) continue;
    rows.push({
      submission_id: submissionId,
      field_id: f.id,
      field_key_snap: f.key,
      field_label_snap: { ar: f.label_ar, en: f.label_en },
      value_text: typeof v === 'string' ? v : null,
      value_json: Array.isArray(v) ? v : null,
    });
  }

  return rows;
}

// Notes are best-effort — the submission already exists, and the
// operator can re-add later from the detail page. Log to the server so
// a systemic note-write outage stays visible.
async function seedFirstNote(
  supabase: AuthContext['supabase'],
  submissionId: string,
  authorId: string,
  body: string | null,
): Promise<void> {
  const trimmed = body?.trim().slice(0, NOTES_MAX_LEN);
  if (!trimmed) return;
  const { error } = await supabase.from('notes').insert({
    submission_id: submissionId,
    author_id: authorId,
    body: trimmed,
  });
  if (error) console.error('[createManualSubmission] note insert failed', error);
}

// Resolve the category's active phone field if the operator typed a
// phone. Throwing here (BEFORE the submission INSERT) is what makes the
// phone-required-but-not-supported case a clean failure instead of
// silently dropping the digits the operator just typed.
function requirePhoneFieldIfNeeded(
  fields: FormFieldRow[],
  phoneE164: string | null,
): FormFieldRow | null {
  if (!phoneE164) return null;
  const phoneField = fields.find((f) => f.semantic_role === 'phone');
  if (!phoneField) throw new Error('category_missing_phone_field');
  return phoneField;
}

// Orchestrator. Each step throws a stable error code on failure that the
// modal's translateError() turns into Arabic for the operator.
export async function createManualSubmission(
  input: ManualSubmissionInput,
): Promise<{ id: string; reference_no: string }> {
  const { supabase, member } = await requireTeamAction();
  const cleaned = validateManualInput(input);
  const fields = await loadActiveCategoryFields(supabase, input.category_id);
  // Validate phone-vs-category compatibility BEFORE INSERT so a missing
  // phone field doesn't leave behind an orphan submission.
  const phoneField = requirePhoneFieldIfNeeded(fields, cleaned.phoneE164);
  const inserted = await insertSubmissionRow(supabase, input, cleaned);

  const answerRows = buildAnswerRows(
    inserted.id,
    fields,
    cleaned.phoneE164,
    phoneField,
    input.custom_answers,
  );
  if (answerRows.length > 0) {
    const { error } = await supabase.from('submission_answers').insert(answerRows);
    if (error) {
      // Cleanup so we don't leave a half-built row behind. Activity log
      // entries cascade-delete via the FK.
      await supabase.from('submissions').delete().eq('id', inserted.id);
      throw new Error(error.message);
    }
  }

  await seedFirstNote(supabase, inserted.id, member.id, input.notes);
  revalidatePath('/admin');
  return inserted;
}

export async function addNote(submissionId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { supabase, member } = await requireTeamAction();
  const { error } = await supabase
    .from('notes')
    .insert({ submission_id: submissionId, author_id: member.id, body: trimmed });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${submissionId}`);
}

export async function deleteNote(noteId: string, submissionId: string) {
  const { supabase } = await requireTeamAction();
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${submissionId}`);
}
