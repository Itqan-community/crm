-- Refine the Arabic hint text on two categories. The seeded English text
-- stays unchanged; only Arabic hint copy is updated.

update public.form_categories
   set hint_ar = 'تلاوات، تفاسير، تجويد ...'
 where key = 'content';

update public.form_categories
   set hint_ar = 'إدارة المجتمع، التنظيم والتنسيق'
 where key = 'admin';
