-- Default statuses (editable from /admin/settings)

insert into public.statuses (key, label_ar, label_en, color, position, is_default, is_terminal) values
  ('new',        'جديد',         'New',         '#6B6B68', 10, true,  false),
  ('in_review',  'قيد المراجعة', 'In review',   '#1B4332', 20, false, false),
  ('contacted',  'تم التواصل',   'Contacted',   '#946E52', 30, false, false),
  ('completed',  'مكتمل',        'Completed',   '#2E7D32', 40, false, true),
  ('archived',   'مؤرشف',        'Archived',    '#9E9E9E', 50, false, true),
  ('rejected',   'غير مناسب',    'Not a fit',   '#B0493A', 60, false, true);
