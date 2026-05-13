'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction } from '@/lib/admin-guard';

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
  const { supabase } = await requireAdminAction();
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
  const { supabase } = await requireAdminAction();
  // Try the delete and let the FK constraint refuse if the status is in use.
  // Avoids a check-then-delete race window.
  const { error } = await supabase.from('statuses').delete().eq('id', statusId);
  if (error) {
    if (error.code === '23503') throw new Error('status_in_use');
    throw new Error(error.message);
  }
  revalidatePath('/admin/settings');
}
