import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-guard';
import { AdminOnlyNotice } from '@/components/admin/AdminOnlyNotice';
import { FieldsAdmin } from '@/components/admin/form-builder/FieldsAdmin';

export const dynamic = 'force-dynamic';

export default async function CategoryFieldsPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const ctx = await requireAdminPage();
  if (!ctx.allowed) return <AdminOnlyNotice />;
  const { supabase } = ctx;

  const { data: category } = await supabase.from('form_categories').select('*').eq('id', categoryId).maybeSingle();
  if (!category) notFound();

  const { data: fields } = await supabase.from('form_fields').select('*').eq('category_id', categoryId).order('position');

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin/settings/form-builder" className="text-[13px]" style={{ color: 'var(--muted)' }}>→ العودة للفئات</Link>
        <h1 className="text-[22px] font-semibold mt-1">حقول فئة: {category.label_ar}</h1>
      </div>
      <FieldsAdmin categoryId={categoryId} fields={fields ?? []} />
    </div>
  );
}
