import Link from 'next/link';
import { requireTeamPage } from '@/lib/admin-guard';
import { dateKey } from '@/lib/dashboard/calendar';
import { SOURCE_ENV_NAMES, sourceConfigured } from '@/lib/stats/env';
import {
  getForumWeekly,
  type ForumWeeklySeries,
} from '@/lib/stats/sources/flarum-weekly';
import { describeError } from '@/lib/stats/util';
import { buildWeeklyPeriods, MAX_WEEKS } from '@/lib/stats/weekly';
import { ForumWeeklyTable } from '@/components/admin/stats/ForumWeeklyTable';

export const dynamic = 'force-dynamic';

export default async function ForumWeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // Redirects internally on missing auth.
  await requireTeamPage();

  const sp = await searchParams;
  const weeks = buildWeeklyPeriods({ from: sp.from, to: sp.to });
  const configured = sourceConfigured('forum');

  let series: ForumWeeklySeries | null = null;
  let error: string | null = null;
  if (configured) {
    try {
      series = await getForumWeekly({ weeks });
    } catch (err) {
      error = describeError(err);
    }
  }

  const first = weeks[0];
  const last = weeks[weeks.length - 1];

  return (
    <div className="max-w-full">
      <header className="mb-4">
        <h1 className="text-[20px] font-semibold" style={{ color: 'var(--fg)' }}>
          أرقام المنتدى الأسبوعية
        </h1>
        <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
          {weeks.length} أسبوعاً ·{' '}
          {first && last ? `${first.hijriLabel} ← ${last.hijriLabel}` : '—'} · الأسبوع
          يبدأ الأحد بتوقيت الرياض ·{' '}
          <Link href="/admin/stats" className="underline">
            جدول التحقّق
          </Link>
        </p>
      </header>

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-3"
        style={{ borderColor: 'var(--rule-soft)' }}
      >
        <RangeField name="from" label="من" defaultValue={first ? dateKey(first.start) : ''} />
        <RangeField name="to" label="إلى" defaultValue={last ? dateKey(last.start) : ''} />
        <button
          type="submit"
          className="px-3 py-2 rounded-lg text-[12.5px] border transition"
          style={{
            borderColor: 'var(--rule)',
            color: 'var(--accent-strong)',
            background: 'var(--option-bg-selected)',
          }}
        >
          عرض
        </button>
        <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
          أي تاريخ يُوسَّع إلى أسبوعه كاملاً · الحدّ الأقصى {MAX_WEEKS} أسبوعاً ·
          بدون تحديد: آخر ١٣ أسبوعاً مكتملاً
        </span>
      </form>

      {!configured && (
        <Notice tone="warn">
          مصدر المنتدى غير مُهيّأ — اضبط{' '}
          <code dir="ltr">{SOURCE_ENV_NAMES.forum.join(', ')}</code> في Vercel ثم
          أعد تحميل الصفحة.
        </Notice>
      )}

      {error && (
        <Notice tone="error">
          تعذّر جلب بيانات المنتدى:{' '}
          <span dir="ltr" style={{ color: 'var(--muted)' }}>
            {error}
          </span>
        </Notice>
      )}

      {series && <ForumWeeklyTable series={series} />}
    </div>
  );
}

function RangeField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12.5px]" style={{ color: 'var(--fg)' }}>
      {label}
      <input
        type="date"
        name={name}
        defaultValue={defaultValue}
        dir="ltr"
        className="px-2 py-1.5 rounded-lg border text-[12.5px]"
        style={{
          borderColor: 'var(--rule)',
          background: 'var(--bg)',
          color: 'var(--fg)',
        }}
      />
    </label>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: 'warn' | 'error';
  children: React.ReactNode;
}) {
  const hue = tone === 'error' ? '#dc2626' : '#b45309';
  return (
    <div
      className="rounded-xl border p-3 mb-4 text-[12.5px]"
      style={{
        borderColor: `color-mix(in oklch, ${hue} 35%, transparent)`,
        background: `color-mix(in oklch, ${hue} 6%, transparent)`,
        color: 'var(--fg)',
      }}
    >
      {children}
    </div>
  );
}
