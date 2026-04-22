-- =====================================================================
-- Seed form schema from the design's schema.jsx
-- 5 categories + 39 fields (with Arabic & English text and options).
-- All editable later from /admin/settings/form-builder.
-- =====================================================================

-- categories
insert into public.form_categories (key, label_ar, label_en, hint_ar, hint_en, icon, position) values
  ('content',     'صاحب محتوى',          'Content Owner',                       'مصاحف، تفاسير، قراءات، تجويد، محتوى تعليمي',  'Mushafs, tafsir, qira''at, tajweed, educational content', 'book',      10),
  ('app',         'صاحب تطبيق',          'App Owner',                           'تطبيقات ومنصّات قرآنية',                        'Quranic apps and platforms',                              'app',       20),
  ('contributor', 'مطوّر / باحث / مصمم', 'Developer / Researcher / Designer',   'للمساهمة التقنية والبحثية والإبداعية',          'Technical, research, and creative contributions',         'code',      30),
  ('admin',       'إداري',               'Administrator',                       'إدارة مجتمع، تنظيم، تنسيق',                     'Community, organizing, coordination',                      'briefcase', 40),
  ('general',     'استفسار عام',         'General Inquiry',                     'أي تواصل آخر',                                  'Anything else',                                            'message',   50);

-- helper function for cleaner field inserts in this migration only
create or replace function pg_temp.add_field(
  p_cat_key       text,
  p_pos           int,
  p_key           text,
  p_kind          text,
  p_label_ar      text,
  p_label_en      text,
  p_required      boolean default false,
  p_help_ar       text default null,
  p_help_en       text default null,
  p_placeholder_ar text default null,
  p_placeholder_en text default null,
  p_is_multi      boolean default true,
  p_options       jsonb default '[]'::jsonb,
  p_semantic      text default null
) returns void language sql as $$
  insert into public.form_fields
    (category_id, key, kind, label_ar, label_en, help_ar, help_en,
     placeholder_ar, placeholder_en, is_required, is_multi, options, semantic_role, position)
  select c.id, p_key, p_kind, p_label_ar, p_label_en, p_help_ar, p_help_en,
         p_placeholder_ar, p_placeholder_en, p_required, p_is_multi, p_options, p_semantic, p_pos
    from public.form_categories c where c.key = p_cat_key;
$$;

-- ---------- content ----------
select pg_temp.add_field('content', 10, 'name',  'text',  'اسمك الكامل', 'Full name', true,
  null, null, 'مثال: محمد عبدالله', 'e.g. Muhammad Abdullah', true, '[]'::jsonb, 'name');
select pg_temp.add_field('content', 20, 'email', 'email', 'البريد الإلكتروني', 'Email address', true,
  null, null, 'name@example.com', 'name@example.com', true, '[]'::jsonb, 'email');
select pg_temp.add_field('content', 30, 'location', 'text', 'الدولة والمدينة', 'Country & city', true,
  null, null, 'الرياض، المملكة العربية السعودية', 'Riyadh, Saudi Arabia', true, '[]'::jsonb, 'location');
select pg_temp.add_field('content', 40, 'content_type', 'radio', 'نوع المحتوى القرآني لديك', 'Type of Quranic content', true,
  null, null, null, null, true,
  '[{"ar":"مصحف","en":"Mushaf"},{"ar":"تفسير","en":"Tafsir"},{"ar":"قراءات","en":"Qira''at"},{"ar":"تجويد","en":"Tajweed"},{"ar":"حديث","en":"Hadith"},{"ar":"سيرة","en":"Seerah"},{"ar":"محتوى تعليمي","en":"Educational content"},{"ar":"آخر","en":"Other"}]'::jsonb, null);
select pg_temp.add_field('content', 50, 'content_about', 'textarea', 'نبذة عن المحتوى وما الذي تحتاجه من إتقان؟', 'Tell us about your content and how Itqan can help', true,
  null, null,
  'صف محتواك بإيجاز، وكيف يمكننا مساعدتك في رقمنته أو إتاحته…',
  'Briefly describe your content and how we can help digitize or publish it…', true, '[]'::jsonb, null);
select pg_temp.add_field('content', 60, 'newsletter', 'checkbox', 'نشرة إتقان', 'Itqan Newsletter', false,
  'قصص مُلهمة، أدوات عملية، نقاشات ثرية، وأخبار من عالم التقنيات القرآنية — تصلك إلى بريدك.',
  'Inspiring stories, practical tools, thoughtful discussions, and news from the world of Quranic tech — delivered to your inbox.',
  null, null, false,
  '[{"ar":"نعم، أرغب بالاشتراك في نشرة إتقان","en":"Yes, subscribe me to the Itqan Newsletter"}]'::jsonb, 'newsletter');

-- ---------- app ----------
select pg_temp.add_field('app', 10, 'name',  'text',  'اسمك الكامل', 'Full name', true,
  null, null, 'مثال: محمد عبدالله', 'e.g. Muhammad Abdullah', true, '[]'::jsonb, 'name');
select pg_temp.add_field('app', 20, 'email', 'email', 'البريد الإلكتروني', 'Email address', true,
  null, null, 'name@example.com', 'name@example.com', true, '[]'::jsonb, 'email');
select pg_temp.add_field('app', 30, 'location', 'text', 'الدولة والمدينة', 'Country & city', true,
  null, null, 'الرياض، المملكة العربية السعودية', 'Riyadh, Saudi Arabia', true, '[]'::jsonb, 'location');
select pg_temp.add_field('app', 40, 'app_name', 'text', 'اسم التطبيق', 'App name', true,
  null, null, 'مثال: تطبيق تدبّر', 'e.g. Tadabbur App', true, '[]'::jsonb, null);
select pg_temp.add_field('app', 50, 'app_url', 'url', 'رابط التطبيق أو متجره', 'App or store link', false,
  null, null, 'https://…', 'https://…', true, '[]'::jsonb, null);
select pg_temp.add_field('app', 60, 'app_need', 'textarea', 'كيف يمكن لإتقان مساعدتك؟', 'How can Itqan help?', true,
  null, null,
  'بيانات قرآنية موثّقة، تكاملات، دعم تقني، مراجعة، إلخ…',
  'Verified Quranic data, integrations, technical support, review, etc.', true, '[]'::jsonb, null);
select pg_temp.add_field('app', 70, 'newsletter', 'checkbox', 'نشرة إتقان', 'Itqan Newsletter', false,
  'قصص مُلهمة، أدوات عملية، نقاشات ثرية، وأخبار من عالم التقنيات القرآنية — تصلك إلى بريدك.',
  'Inspiring stories, practical tools, thoughtful discussions, and news from the world of Quranic tech — delivered to your inbox.',
  null, null, false,
  '[{"ar":"نعم، أرغب بالاشتراك في نشرة إتقان","en":"Yes, subscribe me to the Itqan Newsletter"}]'::jsonb, 'newsletter');

-- ---------- contributor ----------
select pg_temp.add_field('contributor', 10, 'name',  'text',  'اسمك الكامل', 'Full name', true,
  null, null, 'مثال: محمد عبدالله', 'e.g. Muhammad Abdullah', true, '[]'::jsonb, 'name');
select pg_temp.add_field('contributor', 20, 'email', 'email', 'البريد الإلكتروني', 'Email address', true,
  null, null, 'name@example.com', 'name@example.com', true, '[]'::jsonb, 'email');
select pg_temp.add_field('contributor', 30, 'phone', 'phone', 'رقم الجوال / واتساب', 'Phone / WhatsApp', false,
  'اختياري — بالصيغة الدولية مع + ورمز الدولة (مثال: +966551234567)',
  'Optional — international format with + and country code (e.g. +966551234567)',
  '+966 5X XXX XXXX', '+966 5X XXX XXXX', true, '[]'::jsonb, 'phone');
select pg_temp.add_field('contributor', 40, 'location', 'text', 'الدولة والمدينة', 'Country & city', true,
  null, null, 'الرياض، المملكة العربية السعودية', 'Riyadh, Saudi Arabia', true, '[]'::jsonb, 'location');
select pg_temp.add_field('contributor', 50, 'areas', 'checkbox', 'مجالات المساهمة', 'Areas of contribution', true,
  'اختر كل ما ينطبق — لا تقلق إن كنت في البداية، نرحّب بالمتعلّمين.',
  'Select all that apply — beginners are welcome.',
  null, null, true,
  '[{"ar":"تطوير Backend (Python, Node.js…)","en":"Backend (Python, Node.js…)"},{"ar":"تطوير Frontend (React, Vue, HTML/CSS)","en":"Frontend (React, Vue, HTML/CSS)"},{"ar":"تطبيقات الجوال (iOS, Android)","en":"Mobile (iOS, Android)"},{"ar":"تصميم الواجهات / تجربة المستخدم","en":"UI / UX design"},{"ar":"DevOps / بنية تحتية","en":"DevOps / Infrastructure"},{"ar":"ضمان الجودة والاختبار","en":"QA / Testing"},{"ar":"إدارة المنتجات","en":"Product management"},{"ar":"إدارة المشاريع","en":"Project management"},{"ar":"بيانات وتعلّم الآلة","en":"Data / Machine Learning"},{"ar":"توثيق تقني","en":"Technical writing"},{"ar":"إدارة وتفعيل المجتمع","en":"Community management"},{"ar":"تنظيم ملتقيات","en":"Event organizing"},{"ar":"الدعم المالي / إدارة الداعمين","en":"Fundraising / donor relations"}]'::jsonb, null);
select pg_temp.add_field('contributor', 60, 'skills', 'textarea', 'مهاراتك وأدواتك الأساسية', 'Core skills & tools', false,
  null, null,
  'لغات، أدوات، شهادات، مشاريع بارزة، تقنيات تتقنها…',
  'Languages, tools, certifications, notable projects…', true, '[]'::jsonb, null);
select pg_temp.add_field('contributor', 70, 'level', 'radio', 'مستوى الخبرة', 'Experience level', true,
  null, null, null, null, true,
  '[{"ar":"مبتدئ — في بداية الطريق","en":"Beginner — starting out"},{"ar":"متوسط — أنجزت بعض المشاريع","en":"Intermediate — some projects shipped"},{"ar":"متقدم — خبرة مهنية","en":"Advanced — professional experience"},{"ar":"مُرشد — أستطيع توجيه الآخرين","en":"Mentor — can guide others"}]'::jsonb, null);
select pg_temp.add_field('contributor', 80, 'commitment', 'radio', 'الالتزام الأسبوعي', 'Weekly commitment', true,
  'يمكنك تعديل ذلك لاحقاً', 'You can adjust this later', null, null, true,
  '[{"ar":"أقل من ساعتين","en":"Less than 2 hours"},{"ar":"من ساعتين إلى خمس ساعات","en":"2–5 hours"},{"ar":"من خمس إلى عشر ساعات","en":"5–10 hours"},{"ar":"أكثر من عشر ساعات","en":"More than 10 hours"},{"ar":"مرن، حسب المشروع","en":"Flexible, project-based"}]'::jsonb, null);
select pg_temp.add_field('contributor', 90, 'motivation', 'textarea', 'لماذا تريد الانضمام إلى إتقان؟', 'Why do you want to join Itqan?', false,
  null, null,
  'شاركنا دوافعك للمساهمة في المشاريع التقنية القرآنية…',
  'Share what drives you to contribute to Quranic tech projects…', true, '[]'::jsonb, null);
select pg_temp.add_field('contributor', 100, 'prior_work', 'textarea', 'أعمال قرآنية سابقة — إن وجدت', 'Prior Quranic work — if any', false,
  null, null,
  'تطبيقات، مواقع، أبحاث، ترجمات، أعمال مجتمعية…',
  'Apps, sites, research, translations, community work…', true, '[]'::jsonb, null);
select pg_temp.add_field('contributor', 110, 'portfolio', 'textarea', 'روابط مشاريعك أو معرض أعمالك', 'Project links or portfolio', false,
  'رابط في كل سطر', 'One link per line',
  'https://github.com/username
https://…', 'https://github.com/username
https://…', true, '[]'::jsonb, null);
select pg_temp.add_field('contributor', 120, 'languages', 'checkbox', 'لغات التواصل والعمل', 'Working languages', true,
  null, null, null, null, true,
  '[{"ar":"العربية","en":"Arabic"},{"ar":"الإنجليزية","en":"English"},{"ar":"أخرى","en":"Other"}]'::jsonb, null);
select pg_temp.add_field('contributor', 130, 'local_chapter', 'radio', 'فرع إتقان المحلي — إن توفّر في منطقتك', 'Local Itqan chapter — if available in your area', true,
  null, null, null, null, true,
  '[{"ar":"نعم، مهتم جداً","en":"Yes, very interested"},{"ar":"ربما، حسب الاستطاعة","en":"Maybe, depending on availability"},{"ar":"لا، أرغب بالمشاركة عن بُعد","en":"No, remote only"},{"ar":"نعم، وأودّ المشاركة في التنسيق","en":"Yes, and I''d like to help coordinate"}]'::jsonb, null);
select pg_temp.add_field('contributor', 140, 'newsletter', 'checkbox', 'نشرة إتقان', 'Itqan Newsletter', false,
  'قصص مُلهمة، أدوات عملية، نقاشات ثرية، وأخبار من عالم التقنيات القرآنية — تصلك إلى بريدك.',
  'Inspiring stories, practical tools, thoughtful discussions, and news from the world of Quranic tech — delivered to your inbox.',
  null, null, false,
  '[{"ar":"نعم، أرغب بالاشتراك في نشرة إتقان","en":"Yes, subscribe me to the Itqan Newsletter"}]'::jsonb, 'newsletter');

-- ---------- admin ----------
select pg_temp.add_field('admin', 10, 'name',  'text',  'اسمك الكامل', 'Full name', true,
  null, null, 'مثال: محمد عبدالله', 'e.g. Muhammad Abdullah', true, '[]'::jsonb, 'name');
select pg_temp.add_field('admin', 20, 'email', 'email', 'البريد الإلكتروني', 'Email address', true,
  null, null, 'name@example.com', 'name@example.com', true, '[]'::jsonb, 'email');
select pg_temp.add_field('admin', 30, 'phone', 'phone', 'رقم الجوال / واتساب', 'Phone / WhatsApp', false,
  'اختياري — بالصيغة الدولية مع + ورمز الدولة (مثال: +966551234567)',
  'Optional — international format with + and country code (e.g. +966551234567)',
  '+966 5X XXX XXXX', '+966 5X XXX XXXX', true, '[]'::jsonb, 'phone');
select pg_temp.add_field('admin', 40, 'location', 'text', 'الدولة والمدينة', 'Country & city', true,
  null, null, 'الرياض، المملكة العربية السعودية', 'Riyadh, Saudi Arabia', true, '[]'::jsonb, 'location');
select pg_temp.add_field('admin', 50, 'admin_role', 'radio', 'المجال الإداري', 'Administrative focus', true,
  null, null, null, null, true,
  '[{"ar":"إدارة وتفعيل المجتمع","en":"Community management"},{"ar":"تنظيم ملتقيات","en":"Event organizing"},{"ar":"إدارة مشاريع","en":"Project management"},{"ar":"تنسيق متطوعين","en":"Volunteer coordination"},{"ar":"الدعم المالي / إدارة الداعمين","en":"Fundraising / donor relations"},{"ar":"آخر","en":"Other"}]'::jsonb, null);
select pg_temp.add_field('admin', 60, 'admin_experience', 'textarea', 'خبرتك الإدارية السابقة', 'Prior administrative experience', false,
  null, null,
  'منظمات، فرق، مبادرات شاركت فيها أو قُدتها…',
  'Organizations, teams, initiatives you joined or led…', true, '[]'::jsonb, null);
select pg_temp.add_field('admin', 70, 'commitment', 'radio', 'الالتزام الأسبوعي', 'Weekly commitment', true,
  null, null, null, null, true,
  '[{"ar":"أقل من ساعتين","en":"Less than 2 hours"},{"ar":"من ساعتين إلى خمس ساعات","en":"2–5 hours"},{"ar":"من خمس إلى عشر ساعات","en":"5–10 hours"},{"ar":"أكثر من عشر ساعات","en":"More than 10 hours"},{"ar":"مرن، حسب المشروع","en":"Flexible, project-based"}]'::jsonb, null);
select pg_temp.add_field('admin', 80, 'motivation', 'textarea', 'لماذا تريد الانضمام إلى إتقان؟', 'Why do you want to join Itqan?', false,
  null, null,
  'شاركنا دوافعك…', 'Tell us what motivates you…', true, '[]'::jsonb, null);
select pg_temp.add_field('admin', 90, 'newsletter', 'checkbox', 'نشرة إتقان', 'Itqan Newsletter', false,
  'قصص مُلهمة، أدوات عملية، نقاشات ثرية، وأخبار من عالم التقنيات القرآنية — تصلك إلى بريدك.',
  'Inspiring stories, practical tools, thoughtful discussions, and news from the world of Quranic tech — delivered to your inbox.',
  null, null, false,
  '[{"ar":"نعم، أرغب بالاشتراك في نشرة إتقان","en":"Yes, subscribe me to the Itqan Newsletter"}]'::jsonb, 'newsletter');

-- ---------- general ----------
select pg_temp.add_field('general', 10, 'name',  'text',  'اسمك الكامل', 'Full name', true,
  null, null, 'مثال: محمد عبدالله', 'e.g. Muhammad Abdullah', true, '[]'::jsonb, 'name');
select pg_temp.add_field('general', 20, 'email', 'email', 'البريد الإلكتروني', 'Email address', true,
  null, null, 'name@example.com', 'name@example.com', true, '[]'::jsonb, 'email');
select pg_temp.add_field('general', 30, 'message', 'textarea', 'رسالتك', 'Your message', true,
  null, null,
  'اكتب استفسارك أو ملاحظتك بوضوح، وسنعود إليك قريباً بإذن الله.',
  'Write your question or note clearly — we''ll get back to you soon.', true, '[]'::jsonb, null);
