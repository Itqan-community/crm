import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CategoriesAdmin } from '@/components/admin/form-builder/CategoriesAdmin';

export const dynamic = 'force-dynamic';

export default async function FormBuilderHome() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: tm } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle();
  if (tm?.role !== 'admin') {
    return <div className="text-[14px]" style={{ color: 'var(--muted)' }}>هذه الصفحة متاحة للأدمن فقط.</div>;
  }

  const { data: categories } = await supabase.from('form_categories').select('*').order('position');
  const { data: fieldCounts } = await supabase
    .from('form_fields')
    .select('category_id, is_active');

  const counts = (fieldCounts ?? []).reduce<Record<string, { active: number; total: number }>>((acc, f) => {
    if (!acc[f.category_id]) acc[f.category_id] = { active: 0, total: 0 };
    acc[f.category_id].total += 1;
    if (f.is_active) acc[f.category_id].active += 1;
    return acc;
  }, {});

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold mb-1">بناء النموذج</h1>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
          عدّل الفئات والحقول التي يراها زوار <span dir="ltr">join.itqan.dev</span>. لن تتأثر إجابات الطلبات السابقة.
        </p>
      </div>
      <CategoriesAdmin categories={categories ?? []} counts={counts} />
    </div>
  );
}
