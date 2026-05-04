-- =====================================================================
-- Add a new "Partnership" category for institutional partners:
-- Quran memorization associations, Quranic-content associations,
-- and development companies.
-- Adds the category at position 45 (between admin and general) plus
-- 10 fields covering contact, organization details, and partnership
-- scope. All editable later from /admin/settings/form-builder.
-- =====================================================================

-- category
insert into public.form_categories (key, label_ar, label_en, hint_ar, hint_en, icon, position)
values (
  'partnership',
  'شراكة مؤسسية',
  'Institutional Partnership',
  'جمعيات تحفيظ القرآن، جمعيات المحتوى القرآني، شركات التطوير',
  'Quran memorization associations, Quranic content associations, development companies',
  'handshake',
  45
)
on conflict (key) do nothing;

-- helper for cleaner field inserts (scoped to this migration)
create or replace function pg_temp.add_partnership_field(
  p_pos            int,
  p_key            text,
  p_kind           text,
  p_label_ar       text,
  p_label_en       text,
  p_required       boolean default false,
  p_help_ar        text default null,
  p_help_en        text default null,
  p_placeholder_ar text default null,
  p_placeholder_en text default null,
  p_is_multi       boolean default true,
  p_options        jsonb default '[]'::jsonb,
  p_semantic       text default null
) returns void language sql as $$
  insert into public.form_fields
    (category_id, key, kind, label_ar, label_en, help_ar, help_en,
     placeholder_ar, placeholder_en, is_required, is_multi, options, semantic_role, position)
  select c.id, p_key, p_kind, p_label_ar, p_label_en, p_help_ar, p_help_en,
         p_placeholder_ar, p_placeholder_en, p_required, p_is_multi, p_options, p_semantic, p_pos
    from public.form_categories c where c.key = 'partnership'
  on conflict (category_id, key) do nothing;
$$;

-- ---------- partnership fields ----------

-- contact
select pg_temp.add_partnership_field(10, 'contact_name', 'text',
  'اسم المسؤول', 'Contact person name', true,
  null, null,
  'مثال: محمد عبدالله', 'e.g. Muhammad Abdullah',
  true, '[]'::jsonb, 'name');

select pg_temp.add_partnership_field(20, 'job_title', 'text',
  'المسمى الوظيفي', 'Job title', false,
  null, null,
  'مثال: مدير الشراكات', 'e.g. Partnerships Manager',
  true, '[]'::jsonb, null);

select pg_temp.add_partnership_field(30, 'email', 'email',
  'البريد الإلكتروني', 'Email address', true,
  null, null,
  'name@example.com', 'name@example.com',
  true, '[]'::jsonb, 'email');

select pg_temp.add_partnership_field(40, 'phone', 'phone',
  'رقم الجوال / واتساب', 'Phone / WhatsApp', true,
  'بالصيغة الدولية مع + ورمز الدولة (مثال: +966551234567)',
  'International format with + and country code (e.g. +966551234567)',
  '+966 5X XXX XXXX', '+966 5X XXX XXXX',
  true, '[]'::jsonb, 'phone');

-- organization
select pg_temp.add_partnership_field(50, 'org_name', 'text',
  'اسم الجهة', 'Organization name', true,
  null, null,
  'مثال: جمعية تحفيظ القرآن الكريم', 'e.g. Quran Memorization Association',
  true, '[]'::jsonb, null);

select pg_temp.add_partnership_field(60, 'org_type', 'radio',
  'نوع الجهة', 'Organization type', true,
  null, null, null, null, true,
  '[
    {"ar":"جمعية تحفيظ القرآن","en":"Quran memorization association"},
    {"ar":"جمعية محتوى قرآني","en":"Quranic content association"},
    {"ar":"شركة تطوير","en":"Development company"},
    {"ar":"أخرى","en":"Other"}
  ]'::jsonb, null);

select pg_temp.add_partnership_field(70, 'website', 'url',
  'الموقع الإلكتروني / حسابات التواصل', 'Website / social links', false,
  null, null,
  'https://…', 'https://…',
  true, '[]'::jsonb, null);

select pg_temp.add_partnership_field(80, 'org_about', 'textarea',
  'نبذة عن الجهة ونشاطها', 'About the organization and its activity', true,
  null, null,
  'صف باختصار رسالة الجهة، نشاطها، حجم فريقها، ونطاق عملها…',
  'Briefly describe the organization''s mission, activity, team size, and scope…',
  true, '[]'::jsonb, null);

-- partnership scope
select pg_temp.add_partnership_field(90, 'partnership_areas', 'checkbox',
  'مجالات الشراكة المقترحة', 'Proposed partnership areas', true,
  'اختر كل ما ينطبق', 'Select all that apply',
  null, null, true,
  '[
    {"ar":"محتوى مشترك","en":"Co-content"},
    {"ar":"تقنية / تطوير","en":"Technology / Development"},
    {"ar":"رعاية / تمويل","en":"Sponsorship / Funding"},
    {"ar":"تدريب","en":"Training"},
    {"ar":"ترجمة","en":"Translation"},
    {"ar":"توزيع","en":"Distribution"},
    {"ar":"أخرى","en":"Other"}
  ]'::jsonb, null);

-- newsletter
select pg_temp.add_partnership_field(100, 'newsletter', 'checkbox',
  'نشرة إتقان', 'Itqan Newsletter', false,
  'قصص مُلهمة، أدوات عملية، نقاشات ثرية، وأخبار من عالم التقنيات القرآنية — تصلك إلى بريدك.',
  'Inspiring stories, practical tools, thoughtful discussions, and news from the world of Quranic tech — delivered to your inbox.',
  null, null, false,
  '[{"ar":"نعم، أرغب بالاشتراك في نشرة إتقان","en":"Yes, subscribe me to the Itqan Newsletter"}]'::jsonb,
  'newsletter');
