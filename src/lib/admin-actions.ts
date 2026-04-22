'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from './supabase/server';
import { EMAIL_REGEX } from './validation';

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

export async function deleteField(fieldId: string, categoryId: string) {
  const { supabase } = await requireAdmin();
  // Soft-delete if any answers reference it; otherwise hard-delete.
  const { count } = await supabase
    .from('submission_answers')
    .select('id', { count: 'exact', head: true })
    .eq('field_id', fieldId);
  if ((count ?? 0) > 0) {
    const { error } = await supabase.from('form_fields').update({ is_active: false }).eq('id', fieldId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('form_fields').delete().eq('id', fieldId);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/admin/settings/form-builder/${categoryId}`);
}
