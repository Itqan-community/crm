import type { ColumnRole } from '@/lib/bulk-import/types';

// Arabic labels and the wizard's preferred display order for the role
// dropdown in MapStep. Kept here so MapStep stays focused on layout.
export const ROLE_LABEL_AR: Record<ColumnRole, string> = {
  name: 'الاسم',
  email: 'البريد',
  phone: 'الهاتف',
  category: 'الفئة',
  language: 'اللغة',
  channel: 'القناة',
  referral: 'ملاحظة المصدر',
  notes: 'ملاحظات داخلية',
  custom: 'حقل إضافي',
  ignore: 'تجاهل',
};

export const ROLE_OPTIONS: ColumnRole[] = [
  'ignore',
  'name',
  'email',
  'phone',
  'category',
  'language',
  'channel',
  'referral',
  'notes',
  'custom',
];

// Roles that can map to at most one column. The wizard rejects (and the
// validator defends against) duplicate mappings of these roles. 'custom'
// and 'ignore' are excluded — multiple columns of either are fine.
export const UNIQUE_ROLES: ColumnRole[] = [
  'name',
  'email',
  'phone',
  'category',
  'language',
  'channel',
  'referral',
  'notes',
];
