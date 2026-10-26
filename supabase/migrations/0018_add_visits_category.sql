-- =====================================================================
-- Add a "Visits" category — a quick 3-field form (name, phone,
-- workplace) for people who walk in and want a fast follow-up call
-- instead of filling the full contact form. No email field: the phone
-- is the contact channel, so /api/submissions treats email as optional
-- for phone-only categories. All editable later from
-- /admin/settings/form-builder.
-- Plain INSERTs (no DDL) so the same statements can be replayed through
-- the REST API when a dashboard roundtrip isn't convenient.
-- =====================================================================

-- category (position 46: between partnership 45 and general 50)
insert into public.form_categories (key, label_ar, label_en, hint_ar, hint_en, icon, position)
values (
  'visit',
  'زيارات',
  'Visits',
  'نموذج سريع — نتواصل معك بأسرع وقت',
  'Quick form — we''ll get back to you fast',
  'bolt',
  46
)
on conflict (key) do nothing;

-- ---------- fields (3 only — the whole point is speed) ----------

insert into public.form_fields (category_id, key, kind, label_ar, label_en, help_ar, help_en,
  placeholder_ar, placeholder_en, is_required, is_multi, options, semantic_role, position)
select c.id, 'name', 'text', 'الاسم', 'Name', null, null,
  'الاسم الكريم', 'Your full name',
  true, true, '[]'::jsonb, 'name', 10
from public.form_categories c where c.key = 'visit'
on conflict (category_id, key) do nothing;

insert into public.form_fields (category_id, key, kind, label_ar, label_en, help_ar, help_en,
  placeholder_ar, placeholder_en, is_required, is_multi, options, semantic_role, position)
select c.id, 'phone', 'phone', 'رقم الجوال / واتساب', 'Phone / WhatsApp',
  'بالصيغة الدولية مع + ورمز الدولة (مثال: +966551234567)',
  'International format with + and country code (e.g. +966551234567)',
  '+966 5X XXX XXXX', '+966 5X XXX XXXX',
  true, true, '[]'::jsonb, 'phone', 20
from public.form_categories c where c.key = 'visit'
on conflict (category_id, key) do nothing;

insert into public.form_fields (category_id, key, kind, label_ar, label_en, help_ar, help_en,
  placeholder_ar, placeholder_en, is_required, is_multi, options, semantic_role, position)
select c.id, 'workplace', 'text', 'جهة العمل', 'Workplace', null, null,
  'مثال: مدرسة النور التعليمية', 'e.g. Al-Noor School',
  true, true, '[]'::jsonb, null, 30
from public.form_categories c where c.key = 'visit'
on conflict (category_id, key) do nothing;
