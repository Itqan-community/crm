import {
  SOURCE_ENV_NAMES,
  SOURCE_LABELS,
  sourceConfigured,
  type StatsSource,
} from '@/lib/stats/env';

const ALL_SOURCES: StatsSource[] = [
  'newsletter',
  'github',
  'analytics',
  'forum',
  'quranApps',
  'cms',
];

export function EnvStatusBanner() {
  const rows = ALL_SOURCES.map((s) => ({
    source: s,
    configured: sourceConfigured(s),
  }));
  const missing = rows.filter((r) => !r.configured);

  return (
    <div
      className="rounded-xl border p-3 md:p-4 mb-4"
      style={{ borderColor: 'var(--rule-soft)', background: 'var(--surface)' }}
    >
      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--fg)' }}>
        صحّة المتغيّرات
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {rows.map((r) => (
          <div
            key={r.source}
            className="flex items-center gap-2 text-[12.5px]"
            style={{ color: r.configured ? 'var(--fg)' : 'var(--muted)' }}
          >
            <span aria-hidden style={{ color: r.configured ? '#16a34a' : '#d97706' }}>
              {r.configured ? '✓' : '⚠'}
            </span>
            <span>{SOURCE_LABELS[r.source].ar}</span>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <details className="mt-3 text-[12px]" style={{ color: 'var(--muted)' }}>
          <summary className="cursor-pointer">
            المتغيّرات المفقودة في Vercel ({missing.length})
          </summary>
          <ul className="mt-2 space-y-1.5 ps-4 list-disc">
            {missing.map((r) => (
              <li key={r.source}>
                <span style={{ color: 'var(--fg)' }}>{SOURCE_LABELS[r.source].ar}</span>:{' '}
                <code className="text-[11.5px]" dir="ltr">
                  {SOURCE_ENV_NAMES[r.source].join(', ')}
                </code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
