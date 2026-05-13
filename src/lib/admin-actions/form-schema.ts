'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction } from '@/lib/admin-guard';

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
  const { supabase } = await requireAdminAction();
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
  const { supabase } = await requireAdminAction();
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
  const { supabase } = await requireAdminAction();
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
  const { supabase } = await requireAdminAction();
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
  const { supabase } = await requireAdminAction();
  const { error } = await supabase
    .from('form_fields')
    .update({ is_active: isActive })
    .eq('id', fieldId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/settings/form-builder/${categoryId}`);
}
