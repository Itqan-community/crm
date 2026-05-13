'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction } from '@/lib/admin-guard';
import { EMAIL_REGEX } from '@/lib/validation';

export async function addAllowedEmail(email: string, role: 'admin' | 'member', fullName?: string) {
  const { supabase } = await requireAdminAction();
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
  const { supabase } = await requireAdminAction();
  const { error } = await supabase.from('allowed_emails').delete().eq('email', email);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/settings');
}
