'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from './supabase/server';
import { EMAIL_REGEX, parsePhoneSmart } from './validation';
import type {
  Lang,
  SourceChannelKey,
  SubmissionSource,
} from '@/types/database';

async function requireTeam() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthenticated');
  const { data: tm } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm) throw new Error('forbidden');
  return { supabase, user, member: tm };
}

async function requireAdmin() {
  const ctx = await requireTeam();
  if (ctx.member.role !== 'admin') throw new Error('admin_required');
  return ctx;
}

// ----- submission actions -----

export async function setSubmissionStatus(submissionId: string, statusId: string) {
  const { supabase } = await requireTeam();
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
  const { supabase } = await requireTeam();
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
  const { supabase } = await requireTeam();
  const { error } = await supabase
    .from('submissions')
    .update({ assignee_id: assigneeId })
    .eq('id', submissionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath('/admin');
}

// Used by the manual-entry modal. Inserts a submission with the chosen
// source (channel + referral note), persists any category-specific custom
// answers, and — if the team member typed something into the notes field —
// posts that as the first internal note (which the existing trigger logs
// as a `note_added` activity automatically).
export async function createManualSubmission(input: {
  category_id: string;
  language: Lang;
  submitter_name: string;
  submitter_email: string | null;
  submitter_phone: string | null;
  source: { channel: SourceChannelKey; referral: string | null };
  // field_id -> value entered in the modal for that custom field
  custom_answers: Record<string, string | string[] | null>;
  notes: string | null;
}): Promise<{ id: string; reference_no: string }> {
  const { supabase, member } = await requireTeam();

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

  // Pull the category's active fields so we can snapshot labels alongside
  // the answers — same pattern the public /api/submissions route uses.
  const { data: catRow, error: catErr } = await supabase
    .from('form_categories')
    .select('id, is_active')
    .eq('id', input.category_id)
    .maybeSingle();
  if (catErr) throw new Error(catErr.message);
  if (!catRow) throw new Error('unknown_category');

  const { data: fieldsData, error: fieldsErr } = await supabase
    .from('form_fields')
    .select('*')
    .eq('category_id', input.category_id)
    .eq('is_active', true);
  if (fieldsErr) throw new Error(fieldsErr.message);
  const fields = fieldsData ?? [];

  const source: SubmissionSource = {
    channel: input.source.channel,
    referral: input.source.referral?.trim() || null,
  };

  const { data: inserted, error: subErr } = await supabase
    .from('submissions')
    .insert({
      category_id: input.category_id,
      language: input.language,
      submitter_name: name,
      submitter_email: email,
      newsletter_optin: false,
      source,
    })
    .select('id, reference_no')
    .single();

  if (subErr || !inserted) throw new Error(subErr?.message ?? 'submission_insert_failed');

  // Phone gets stored as an answer against the category's phone field
  // (matching the public-form path). If the category has no phone field
  // we silently skip — the operator entered a phone we don't have a
  // canonical slot for.
  const phoneField = fields.find((f) => f.semantic_role === 'phone');

  type AnswerInsert = {
    submission_id: string;
    field_id: string;
    field_key_snap: string;
    field_label_snap: { ar: string; en: string };
    value_text: string | null;
    value_json: unknown;
  };

  const answerRows: AnswerInsert[] = [];

  if (phoneE164 && phoneField) {
    answerRows.push({
      submission_id: inserted.id,
      field_id: phoneField.id,
      field_key_snap: phoneField.key,
      field_label_snap: { ar: phoneField.label_ar, en: phoneField.label_en },
      value_text: phoneE164,
      value_json: null,
    });
  }

  for (const f of fields) {
    if (['name', 'email', 'phone'].includes(f.semantic_role ?? '')) continue;
    const v = input.custom_answers[f.id];
    const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (isEmpty) continue;
    answerRows.push({
      submission_id: inserted.id,
      field_id: f.id,
      field_key_snap: f.key,
      field_label_snap: { ar: f.label_ar, en: f.label_en },
      value_text: typeof v === 'string' ? v : null,
      value_json: Array.isArray(v) ? v : null,
    });
  }

  if (answerRows.length > 0) {
    const { error: ansErr } = await supabase
      .from('submission_answers')
      .insert(answerRows);
    if (ansErr) {
      // Best-effort cleanup so we don't leave a half-built row behind.
      await supabase.from('submissions').delete().eq('id', inserted.id);
      throw new Error(ansErr.message);
    }
  }

  const noteBody = input.notes?.trim();
  if (noteBody) {
    await supabase.from('notes').insert({
      submission_id: inserted.id,
      author_id: member.id,
      body: noteBody,
    });
  }

  revalidatePath('/admin');
  return { id: inserted.id, reference_no: inserted.reference_no };
}

export async function addNote(submissionId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { supabase, member } = await requireTeam();
  const { error } = await supabase
    .from('notes')
    .insert({ submission_id: submissionId, author_id: member.id, body: trimmed });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${submissionId}`);
}

export async function deleteNote(noteId: string, submissionId: string) {
  const { supabase } = await requireTeam();
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${submissionId}`);
}

// ----- statuses -----

export async function upsertStatus(input: {
  id?: string;
  key: string;
  label_ar: string;
  label_en: string;
  color: string;
  position: number;
  is_default: boolean;
  is_terminal: boolean;
}) {
  const { supabase } = await requireAdmin();
  if (input.is_default) {
    // Clear existing default first (only one is allowed by index)
    await supabase.from('statuses').update({ is_default: false }).neq('key', input.key);
  }
  if (input.id) {
    const { error } = await supabase
      .from('statuses')
      .update({
        key: input.key,
        label_ar: input.label_ar,
        label_en: input.label_en,
        color: input.color,
        position: input.position,
        is_default: input.is_default,
        is_terminal: input.is_terminal,
      })
      .eq('id', input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('statuses').insert({
      key: input.key,
      label_ar: input.label_ar,
      label_en: input.label_en,
      color: input.color,
      position: input.position,
      is_default: input.is_default,
      is_terminal: input.is_terminal,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/settings');
}

export async function deleteStatus(statusId: string) {
  const { supabase } = await requireAdmin();
  // Try the delete and let the FK constraint refuse if the status is in use.
  // Avoids a check-then-delete race window.
  const { error } = await supabase.from('statuses').delete().eq('id', statusId);
  if (error) {
    if (error.code === '23503') throw new Error('status_in_use');
    throw new Error(error.message);
  }
  revalidatePath('/admin/settings');
}

// ----- team & allowed_emails -----

export async function addAllowedEmail(email: string, role: 'admin' | 'member', fullName?: string) {
  const { supabase } = await requireAdmin();
  const e = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(e)) throw new Error('invalid_email');
  const name = fullName?.trim() || null;
  const { error } = await supabase
    .from('allowed_emails')
    .upsert({ email: e, role, full_name: name }, { onConflict: 'email' });
  if (error) throw new Error(error.message);
  // Keep an existing team_members row in sync if the user has already signed in.
  if (name) {
    await supabase.from('team_members').update({ full_name: name, role }).eq('email', e);
  } else {
    await supabase.from('team_members').update({ role }).eq('email', e);
  }
  revalidatePath('/admin/settings');
}

export async function removeAllowedEmail(email: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('allowed_emails').delete().eq('email', email);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/settings');
}

// ----- form schema -----

export async function upsertCategory(input: {
  id?: string;
  key: string;
  label_ar: string;
  label_en: string;
  hint_ar: string | null;
  hint_en: string | null;
  icon: string | null;
  position: number;
  is_active: boolean;
}) {
  const { supabase } = await requireAdmin();
  if (input.id) {
    const { error } = await supabase
      .from('form_categories')
      .update({
        key: input.key,
        label_ar: input.label_ar,
        label_en: input.label_en,
        hint_ar: input.hint_ar,
        hint_en: input.hint_en,
        icon: input.icon,
        position: input.position,
        is_active: input.is_active,
      })
      .eq('id', input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('form_categories').insert({
      key: input.key,
      label_ar: input.label_ar,
      label_en: input.label_en,
      hint_ar: input.hint_ar,
      hint_en: input.hint_en,
      icon: input.icon,
      position: input.position,
      is_active: input.is_active,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/settings/form-builder');
}

export async function deleteCategory(categoryId: string) {
  const { supabase } = await requireAdmin();
  // Same race-free pattern: attempt the delete, translate FK violation.
  const { error } = await supabase.from('form_categories').delete().eq('id', categoryId);
  if (error) {
    if (error.code === '23503') throw new Error('category_in_use');
    throw new Error(error.message);
  }
  revalidatePath('/admin/settings/form-builder');
}

export async function upsertField(input: {
  id?: string;
  category_id: string;
  key: string;
  kind: 'text' | 'email' | 'phone' | 'url' | 'textarea' | 'radio' | 'checkbox';
  label_ar: string;
  label_en: string;
  help_ar: string | null;
  help_en: string | null;
  placeholder_ar: string | null;
  placeholder_en: string | null;
  is_required: boolean;
  is_multi: boolean;
  options: { ar: string; en: string }[];
  semantic_role: 'name' | 'email' | 'phone' | 'location' | 'newsletter' | null;
  position: number;
  is_active: boolean;
}) {
  const { supabase } = await requireAdmin();
  const payload = { ...input };
  if (input.id) {
    const { id, ...rest } = payload;
    const { error } = await supabase.from('form_fields').update(rest).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('form_fields').insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/settings/form-builder');
  revalidatePath(`/admin/settings/form-builder/${input.category_id}`);
}

export async function deleteField(
  fieldId: string,
  categoryId: string,
): Promise<{ action: 'deleted' | 'disabled'; answerCount: number }> {
  const { supabase } = await requireAdmin();
  // Soft-delete if any answers reference it; otherwise hard-delete. The
  // return value tells the caller which branch ran so the admin UI can
  // explain what actually happened to the field.
  const { count } = await supabase
    .from('submission_answers')
    .select('id', { count: 'exact', head: true })
    .eq('field_id', fieldId);
  const answerCount = count ?? 0;
  if (answerCount > 0) {
    const { error } = await supabase.from('form_fields').update({ is_active: false }).eq('id', fieldId);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/settings/form-builder/${categoryId}`);
    return { action: 'disabled', answerCount };
  }
  const { error } = await supabase.from('form_fields').delete().eq('id', fieldId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/settings/form-builder/${categoryId}`);
  return { action: 'deleted', answerCount };
}

export async function setFieldActive(fieldId: string, categoryId: string, isActive: boolean) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from('form_fields')
    .update({ is_active: isActive })
    .eq('id', fieldId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/settings/form-builder/${categoryId}`);
}
