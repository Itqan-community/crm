import {
  SOURCE_ENV_NAMES,
  SOURCE_LABELS,
  sourceConfigured,
  type StatsSource,
} from '@/lib/stats/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const ALL_SOURCES: StatsSource[] = [
  'newsletter',
  'github',
  'analytics',
  'forum',
  'quranApps',
  'cms',
];

// Which dashboard_metric_daily metric_keys each source populates. Used
// to show "data captured?" per source — complements "env var set?" so
// an admin can spot a configured-but-failing source (env var present,
// no rows produced in 30 days).
const SOURCE_TO_METRIC_KEYS: Partial<Record<StatsSource, string[]>> = {
  newsletter: ['newsletter'],
  analytics: ['site_visits'],
  forum: ['engagement', 'shares'],
  cms: ['publishers', 'beneficiaries', 'consumption'],
};

async function loadFreshness(): Promise<Map<string, string>> {
  // For each metric_key we care about, fetch the latest day with a row.
  // Single query, group max(day) — cheap on a tiny table.
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('dashboard_metric_daily')
    .select('metric_key, day')
    .order('day', { ascending: false });
  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    if (!latest.has(row.metric_key)) latest.set(row.metric_key, row.day as string);
  }
  return latest;
}

function daysAgo(isoDay: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(isoDay);
  d.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

export async function EnvStatusBanner() {
  // Fetch freshness in parallel with rendering — server component so
  // the page server-renders with the data already in hand.
  let freshness: Map<string, string> = new Map();
  try {
    freshness = await loadFreshness();
  } catch {
    // Supabase hiccup shouldn't crash the page; the env half of the
    // banner is still useful on its own.
  }

  // CRON_SECRET gates both the daily cron route and the diagnostic
  // tester endpoint. Without it Vercel Cron auth fails and nothing
  // gets captured automatically — surface it next to the source rows
  // so the admin can verify all the operational env vars in one place.
  const cronSecretSet = Boolean(process.env.CRON_SECRET);

  const rows = ALL_SOURCES.map((s) => {
    const keys = SOURCE_TO_METRIC_KEYS[s] ?? [];
    // Worst case wins: the source is "stale" if ANY of its metrics is
    // missing or stale. Reporting the most-stale metric makes it easy
    // to tell which key is broken.
    let latestDay: string | null = null;
    for (const k of keys) {
      const d = freshness.get(k);
      if (!d) {
        latestDay = null;
        break;
      }
      if (latestDay === null || d < latestDay) latestDay = d;
    }
    return {
      source: s,
      configured: sourceConfigured(s),
      tracksDashboard: keys.length > 0,
      latestDay,
      daysAgo: latestDay ? daysAgo(latestDay) : null,
    };
  });
  const missing = rows.filter((r) => !r.configured);

  return (
    <div
      className="rounded-xl border p-3 md:p-4 mb-4"
      style={{ borderColor: 'var(--rule-soft)', background: 'var(--surface)' }}
    >
      <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--fg)' }}>
        صحّة المتغيّرات
      </div>
      <div
        className="flex items-center justify-between gap-3 text-[12.5px] rounded-md px-2 py-1.5 mb-2"
        style={{ color: cronSecretSet ? 'var(--fg)' : 'var(--muted)', background: 'rgba(0,0,0,0.02)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden style={{ color: cronSecretSet ? '#16a34a' : '#d97706' }}>
            {cronSecretSet ? '✓' : '⚠'}
          </span>
          <span className="truncate">
            مفتاح الكرون (CRON_SECRET){cronSecretSet ? '' : ' — غير مضبوط'}
          </span>
        </div>
        {!cronSecretSet && (
          <code className="text-[11.5px] shrink-0" dir="ltr" style={{ color: 'var(--muted)' }}>
            CRON_SECRET
          </code>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {rows.map((r) => {
          // Three states for the freshness chip:
          //   ✓ green   → row within last 2 days
          //   ⏳ amber  → row exists but is older than 2 days
          //   × red    → tracksDashboard but no rows at all
          const stale = r.tracksDashboard && (r.daysAgo == null || r.daysAgo > 2);
          const noData = r.tracksDashboard && r.daysAgo == null;
          return (
            <div
              key={r.source}
              className="flex items-center justify-between gap-3 text-[12.5px] rounded-md px-2 py-1.5"
              style={{
                color: r.configured ? 'var(--fg)' : 'var(--muted)',
                background: 'rgba(0,0,0,0.02)',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span aria-hidden style={{ color: r.configured ? '#16a34a' : '#d97706' }}>
                  {r.configured ? '✓' : '⚠'}
                </span>
                <span className="truncate">{SOURCE_LABELS[r.source].ar}</span>
              </div>
              {r.tracksDashboard && (
                <span
                  className="text-[11.5px] shrink-0"
                  dir="ltr"
                  style={{
                    color: noData ? '#dc2626' : stale ? '#d97706' : 'var(--muted)',
                  }}
                  title={
                    noData
                      ? 'لا توجد بيانات في جدول اللوحة'
                      : `latest day: ${r.latestDay}`
                  }
                >
                  {noData ? 'لا توجد بيانات' : `${r.daysAgo}d`}
                </span>
              )}
            </div>
          );
        })}
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
