-- =====================================================================
-- Add the phone / WhatsApp field to every category that doesn't have it.
-- contributor + admin already expose phone (0003_seed_form_schema.sql);
-- this migration backfills the same field for content, app, and general
-- so phone capture is consistent across submissions.
-- Position 25 slots it between email (20) and the next field (30).
-- =====================================================================

insert into public.form_fields
  (category_id, key, kind,
   label_ar, label_en,
   help_ar, help_en,
   placeholder_ar, placeholder_en,
   is_required, is_multi, options, semantic_role, position)
select c.id,
       'phone', 'phone',
       'رقم الجوال / واتساب', 'Phone / WhatsApp',
       'اختياري — بالصيغة الدولية مع + ورمز الدولة (مثال: +966551234567)',
       'Optional — international format with + and country code (e.g. +966551234567)',
       '+966 5X XXX XXXX', '+966 5X XXX XXXX',
       false, true, '[]'::jsonb, 'phone', 25
  from public.form_categories c
 where c.key in ('content', 'app', 'general')
on conflict (category_id, key) do nothing;
