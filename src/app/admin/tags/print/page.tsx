import { requireTeamPage } from '@/lib/admin-guard';
import { loadSubmissions } from '@/lib/admin-queries';
import { PrintBar } from '@/components/admin/PrintBar';

export const dynamic = 'force-dynamic';

// Print-friendly view = the team's "PDF export". Browser print-to-PDF
// shapes Arabic correctly (unlike jsPDF-style generation), so the page is
// deliberately bare: no sidebar (admin layout chrome hides the aside via
// print rules in globals.css), tight rows, explicit page title.
export default async function TagsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tags?: string; include_archived?: string }>;
}) {
  await requireTeamPage();
  const sp = await searchParams;
  const rows = await loadSubmissions(sp);

  return (
    <div className="max-w-5xl">
      <PrintBar count={rows.length} />
      <h1 className="text-[18px] font-semibold mb-1 print:block">تصنيفات الأشخاص — مجتمع إتقان</h1>
      <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
        أُنشئ في {new Date().toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['الرقم المرجعي', 'الاسم', 'البريد', 'الفئة', 'التصنيفات', 'الحالة'].map((h) => (
              <th
                key={h}
                className="px-2 py-2 text-start border"
                style={{ borderColor: 'var(--rule)', background: 'var(--option-bg-selected)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-2 py-1.5 border font-mono" style={{ borderColor: 'var(--rule-soft)' }} dir="ltr">
                {r.reference_no}
              </td>
              <td className="px-2 py-1.5 border" style={{ borderColor: 'var(--rule-soft)' }}>{r.submitter_name}</td>
              <td className="px-2 py-1.5 border" style={{ borderColor: 'var(--rule-soft)' }} dir="ltr">{r.submitter_email}</td>
              <td className="px-2 py-1.5 border" style={{ borderColor: 'var(--rule-soft)' }}>{r.category?.label_ar ?? '—'}</td>
              <td className="px-2 py-1.5 border" style={{ borderColor: 'var(--rule-soft)' }}>
                {r.tags.length > 0 ? r.tags.map((t) => t.label_ar).join('، ') : '—'}
              </td>
              <td className="px-2 py-1.5 border" style={{ borderColor: 'var(--rule-soft)' }}>{r.status?.label_ar ?? '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-8 text-center" style={{ color: 'var(--muted)' }}>
                لا توجد نتائج.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
