import Link from 'next/link';
import { requireTeamPage } from '@/lib/admin-guard';
import { loadSubmissions, loadTags, loadTagGroups } from '@/lib/admin-queries';
import { TagsFilters } from '@/components/admin/TagsFilters';
import { TagsAdmin } from '@/components/admin/TagsAdmin';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { CategoryBadge } from '@/components/admin/CategoryBadge';
import { Tag } from '@/components/admin/Tag';
import { LocalTime } from '@/components/admin/LocalTime';

export const dynamic = 'force-dynamic';

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tags?: string; include_archived?: string }>;
}) {
  const { member } = await requireTeamPage();
  const sp = await searchParams;

  const [rows, allTags, allGroups] = await Promise.all([
    loadSubmissions(sp),
    loadTags(true),
    loadTagGroups(true),
  ]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-[22px] font-semibold">التصنيفات</h1>
        <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
          {rows.length} نتيجة
        </span>
      </div>

      <TagsFilters tags={allTags} groups={allGroups} />

      <div className="border rounded-xl overflow-x-auto mb-6" style={{ borderColor: 'var(--rule)' }}>
        <table className="w-full min-w-[900px] text-[13.5px]">
          <thead style={{ background: 'var(--option-bg-selected)' }}>
            <tr style={{ color: 'var(--muted)' }}>
              <Th>الرقم المرجعي</Th>
              <Th>الاسم</Th>
              <Th>البريد</Th>
              <Th>الفئة</Th>
              <Th>التصنيفات</Th>
              <Th>الحالة</Th>
              <Th>التاريخ</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--muted)' }}>
                  لا توجد طلبات تطابق هذه الفلاتر.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t hover:bg-[var(--option-bg-selected)] transition"
                style={{ borderColor: 'var(--rule-soft)' }}
              >
                <Td>
                  <Link
                    href={`/admin/submissions/${r.id}`}
                    className="font-mono text-[12.5px] hover:underline"
                    style={{ color: 'var(--accent-strong)' }}
                  >
                    {r.reference_no}
                  </Link>
                </Td>
                <Td><span className="font-medium">{r.submitter_name}</span></Td>
                <Td>
                  <span className="text-[12.5px]" style={{ color: 'var(--muted)' }} dir="ltr">
                    {r.submitter_email}
                  </span>
                </Td>
                <Td>
                  {r.category ? (
                    <CategoryBadge label={r.category.label_ar} categoryKey={r.category.key} />
                  ) : '—'}
                </Td>
                <Td>
                  {r.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {r.tags.map((t) => (
                        <Tag key={t.id} color={t.color}>{t.label_ar}</Tag>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </Td>
                <Td>
                  {r.status ? <StatusBadge label={r.status.label_ar} color={r.status.color} /> : '—'}
                </Td>
                <Td><LocalTime iso={r.created_at} mode="date" /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {member.role === 'admin' ? (
        <TagsAdmin tags={allTags} groups={allGroups} />
      ) : (
        <section className="rounded-xl border p-5 text-[13px]" style={{ borderColor: 'var(--rule)', color: 'var(--muted)' }}>
          إدارة التصنيفات (إضافة/تعديل/حذف) متاحة للمشرفين فقط.
        </section>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-start font-medium text-[12px] uppercase tracking-wider">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}
