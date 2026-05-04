import { requireAdminPage } from '@/lib/admin-guard';
import { AdminOnlyNotice } from '@/components/admin/AdminOnlyNotice';
import { MetricsForm } from '@/components/admin/MetricsForm';
import { loadMetricsForWeeks } from '@/lib/dashboard-queries';
import {
  formatGregorianRange,
  formatHijriRange,
  lastNWeekStarts,
  weekKey,
} from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function MetricsSettingsPage() {
  const ctx = await requireAdminPage();
  if (!ctx.allowed) return <AdminOnlyNotice />;

  // Show last 4 weeks (current + 3 prior). Enough to bootstrap the
  // dashboard's current-vs-prior comparison and start filling sparklines.
  const weeks = lastNWeekStarts(4).reverse(); // newest first
  const cols = weeks.map((d) => {
    const end = new Date(d.getTime() + 7 * 24 * 3_600_000 - 1);
    return {
      weekKey: weekKey(d),
      hijriLabel: formatHijriRange(d, end),
      gregorianLabel: formatGregorianRange(d, end),
    };
  });
  const stored = await loadMetricsForWeeks(weeks);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold">إدخال المؤشّرات الأسبوعية</h1>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          الأسبوع يبدأ يوم الأحد وينتهي يوم السبت بتوقيت الرياض. ترتيب الأولوية لكل مؤشّر:
          <strong style={{ color: 'var(--fg)' }}> stats &lt; MailerLite &lt; إدخال يدوي</strong>.
        </p>
        <ul
          className="text-[12.5px] leading-relaxed mt-2 ps-4"
          style={{ color: 'var(--muted)', listStyle: 'disc' }}
        >
          <li>
            مع ضبط <code>STATS_BASE_URL</code> (مثلاً
            <code style={{ marginInlineStart: 4 }}>https://stats.itqan.dev</code>) تُسحب
            معظم القيم تلقائياً من مشروع{' '}
            <a href="https://github.com/Itqan-community/stats" style={{ color: 'var(--accent)' }}>
              Itqan-community/stats
            </a>{' '}
            (المنتدى، GA، LinkedIn، دليل التطبيقات).
          </li>
          <li>
            مع ضبط <code>MAILERLITE_API_KEY</code> يُسحب معدل فتح النشرة لأسبوعنا الفعلي بدلاً من
            المتوسط العام في stats.
          </li>
          <li>
            ما تُدخله هنا يكتب في <code>dashboard_metrics</code> ويُستخدم كقيمة احتياطية أو override
            لأي قناة لا يغطّيها stats (X، إنستقرام، يوتيوب، الاستماع، إلخ).
          </li>
        </ul>
      </div>
      <MetricsForm weeks={cols} initial={stored} />
    </div>
  );
}
