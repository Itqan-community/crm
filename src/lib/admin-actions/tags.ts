'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction, requireTeamAction } from '@/lib/admin-guard';

// Key constraint mirrors `key text primary key` on both tables; keep the
// accepted shape tight (slug-style) so it is safe in URLs and exports.
const KEY_REGEX = /^[a-z0-9_]{2,40}$/;
const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function validateKeyInput(input: { key: string }): string {
  const key = input.key.trim().toLowerCase();
  if (!KEY_REGEX.test(key)) throw new Error('invalid_tag_key');
  return key;
}

function validateTagInput(input: {
  label_ar: string;
  label_en: string;
  color: string;
}): { label_ar: string; label_en: string; color: string } {
  const label_ar = input.label_ar.trim();
  const label_en = input.label_en.trim();
  const color = input.color.trim();
  if (!label_ar) throw new Error('label_ar_required');
  if (!label_en) throw new Error('label_en_required');
  if (!COLOR_REGEX.test(color)) throw new Error('invalid_color');
  return { label_ar, label_en, color };
}

// ---------------------------------------------------------------------
// Tag groups (admin) — classification axes like "أوقات التطوع"
// ---------------------------------------------------------------------

export async function upsertTagGroup(input: {
  key: string;
  label_ar: string;
  label_en: string;
  position: number;
  is_active: boolean;
}) {
  const { supabase } = await requireAdminAction();
  const key = validateKeyInput(input);
  if (!input.label_ar.trim()) throw new Error('label_ar_required');
  if (!input.label_en.trim()) throw new Error('label_en_required');
  const row = {
    key,
    label_ar: input.label_ar.trim(),
    label_en: input.label_en.trim(),
    position: input.position,
    is_active: input.is_active,
  };

  // The tag_groups key is the PK (no separate id), so upsert on key.
  const { error } = await supabase
    .from('tag_groups')
    .upsert(row, { onConflict: 'key' });
  if (error) {
    if (error.code === '23505') throw new Error('group_key_exists');
    throw new Error(error.message);
  }
  revalidatePath('/admin/tags');
  revalidatePath('/admin/submissions');
}

export async function deleteTagGroup(groupKey: string) {
  const { supabase } = await requireAdminAction();
  // The FK (tags_group_fk, ON DELETE RESTRICT) refuses when tags still
  // reference the group — surfaced to the UI as group_in_use.
  const { error } = await supabase.from('tag_groups').delete().eq('key', groupKey);
  if (error) {
    if (error.code === '23503') throw new Error('group_in_use');
    throw new Error(error.message);
  }
  revalidatePath('/admin/tags');
  revalidatePath('/admin/submissions');
}

// ---------------------------------------------------------------------
// Tags (admin)
// ---------------------------------------------------------------------

export async function upsertTag(input: {
  id?: string;
  key: string;
  label_ar: string;
  label_en: string;
  kind: string;
  color: string;
  position: number;
  is_active: boolean;
}) {
  const { supabase } = await requireAdminAction();
  const kind = input.kind?.trim() || 'general';
  const cleaned = validateTagInput(input);

  // kind references tag_groups.key — verify the group exists so the FK
  // can't surprise the operator with a raw 23503.
  const { data: group } = await supabase
    .from('tag_groups')
    .select('key')
    .eq('key', kind)
    .maybeSingle();
  if (!group) throw new Error('unknown_group');

  const row = { ...cleaned, kind, position: input.position, is_active: input.is_active };

  if (input.id) {
    const { error } = await supabase.from('tags').update(row).eq('id', input.id);
    if (error) {
      if (error.code === '23505') throw new Error('tag_key_exists');
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('tags').insert({ ...row, key: validateKeyInput(input) });
    if (error) {
      if (error.code === '23505') throw new Error('tag_key_exists');
      throw new Error(error.message);
    }
  }
  revalidatePath('/admin/tags');
  revalidatePath('/admin/submissions');
}

export async function deleteTag(tagId: string) {
  const { supabase } = await requireAdminAction();
  // submission_tags rows cascade on delete, and the log trigger records
  // each removal, so no manual cleanup is needed here.
  const { error } = await supabase.from('tags').delete().eq('id', tagId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/tags');
  revalidatePath('/admin/submissions');
}

// ---------------------------------------------------------------------
// Tag assignment (team)
// ---------------------------------------------------------------------

// Replace-set semantics: diff against the current links so the activity
// log (via the DB trigger) records exactly the added/removed tags.
export async function setSubmissionTags(submissionId: string, tagIds: string[]) {
  const { supabase, member } = await requireTeamAction();
  const next = [...new Set(tagIds)];

  const { data: current, error: loadErr } = await supabase
    .from('submission_tags')
    .select('tag_id')
    .eq('submission_id', submissionId);
  if (loadErr) throw new Error(loadErr.message);

  const currentIds = new Set((current ?? []).map((r) => r.tag_id as string));
  const toAdd = next.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !next.includes(id));

  if (toAdd.length > 0) {
    const { error } = await supabase.from('submission_tags').insert(
      toAdd.map((tag_id) => ({
        submission_id: submissionId,
        tag_id,
        assigned_by: member.id,
      })),
    );
    if (error) throw new Error(error.message);
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('submission_tags')
      .delete()
      .eq('submission_id', submissionId)
      .in('tag_id', toRemove);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath('/admin/submissions');
  revalidatePath('/admin/tags');
}
