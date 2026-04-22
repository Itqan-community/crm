import { createSupabaseServerClient } from './supabase/server';
import type { FormCategoryRow, FormFieldRow } from '@/types/database';

export type FormSchema = {
  categories: FormCategoryRow[];
  fieldsByCategory: Record<string, FormFieldRow[]>;
};

// Reads only active categories + active fields, ordered by `position`.
// For dashboard contexts (showing legacy fields too) call queryAllForAdmin().
export async function loadActiveFormSchema(): Promise<FormSchema> {
  const supabase = await createSupabaseServerClient();
  const [{ data: categories }, { data: fields }] = await Promise.all([
    supabase
      .from('form_categories')
      .select('*')
      .eq('is_active', true)
      .order('position'),
    supabase
      .from('form_fields')
      .select('*')
      .eq('is_active', true)
      .order('position'),
  ]);

  const cats = (categories || []) as FormCategoryRow[];
  const fieldsAll = (fields || []) as FormFieldRow[];
  const byCat: Record<string, FormFieldRow[]> = {};
  for (const c of cats) byCat[c.id] = [];
  for (const f of fieldsAll) {
    if (byCat[f.category_id]) byCat[f.category_id].push(f);
  }
  return { categories: cats, fieldsByCategory: byCat };
}
