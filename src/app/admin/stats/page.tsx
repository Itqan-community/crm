import { requireTeamPage } from '@/lib/admin-guard';
import { loadStatsBundle } from '@/lib/stats/loader';
import { EnvStatusBanner } from '@/components/admin/stats/EnvStatusBanner';
import { RefreshButton } from '@/components/admin/stats/RefreshButton';
import { StatsTable } from '@/components/admin/stats/StatsTable';

export const dynamic = 'force-dynamic';

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // requireTeamPage redirects internally on missing auth — no need to
  // re-check its return value.
  await requireTeamPage();

  const sp = await searchParams;
  const parsed = Number.parseInt(sp.days ?? '', 10);
  const windowDays = [7, 30, 90].includes(parsed) ? parsed : 7;

  const bundle = await loadStatsBundle({ windowDays });

  const generatedAt = new Date(bundle.generatedAt).toLocaleString('en-CA', {
    timeZone: 'Asia/Riyadh',
    hour12: false,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold" style={{ color: 'var(--fg)' }}>
            البيانات
          </h1>
          <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
            جدول التحقّق — مصادر البيانات الحيّة · النطاق: آخر {windowDays}{' '}
            {windowDays === 1 ? 'يوم' : 'أيام'} · جُلب{' '}
            <span dir="ltr">{generatedAt}</span> (KSA)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangeSwitch current={windowDays} />
          <RefreshButton />
        </div>
      </header>

      <EnvStatusBanner />

      {bundle.errors.length > 0 && (
        <div
          className="rounded-xl border p-3 mb-4 text-[12.5px]"
          style={{
            borderColor: 'color-mix(in oklch, #dc2626 35%, transparent)',
            background: 'color-mix(in oklch, #dc2626 6%, transparent)',
            color: 'var(--fg)',
          }}
        >
          <div className="font-medium mb-1">تعذّر جلب بعض المصادر:</div>
          <ul className="space-y-0.5">
            {bundle.errors.map((e, i) => (
              <li key={i} dir="ltr" style={{ color: 'var(--muted)' }}>
                {e.source}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <StatsTable bundle={bundle} />
    </div>
  );
}

function RangeSwitch({ current }: { current: number }) {
  const options = [7, 30, 90];
  return (
    <div
      className="inline-flex rounded-lg border overflow-hidden"
      style={{ borderColor: 'var(--rule)' }}
      role="group"
      aria-label="نطاق زمني"
    >
      {options.map((d) => {
        const active = d === current;
        return (
          <a
            key={d}
            href={`/admin/stats?days=${d}`}
            className="px-3 py-2 text-[12.5px] transition"
            style={{
              color: active ? 'var(--accent-strong)' : 'var(--fg)',
              background: active ? 'var(--option-bg-selected)' : 'transparent',
              borderInlineEnd:
                d === options[options.length - 1] ? 'none' : '1px solid var(--rule-soft)',
            }}
          >
            {d}d
          </a>
        );
      })}
    </div>
  );
}
