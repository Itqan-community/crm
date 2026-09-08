import {
  FORUM_WEEKLY_ROWS,
  type ForumWeeklySeries,
} from '@/lib/stats/sources/flarum-weekly';

// Values stay in Latin digits: these cells get copied into the
// community report sheet, and every other admin table formats numbers
// the same way. The date headers keep Arabic-Indic numerals so the
// column titles read exactly like the report they mirror.
const FMT_INT = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

const LABEL_WIDTH = 210;
const CELL_WIDTH = 104;

export function ForumWeeklyTable({ series }: { series: ForumWeeklySeries }) {
  const { weeks, counts, degraded } = series;

  if (weeks.length === 0) {
    return (
      <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
        لا توجد فترات ضمن النطاق المحدّد.
      </p>
    );
  }

  return (
    <div>
      <div
        className="rounded-xl border overflow-x-auto"
        style={{ borderColor: 'var(--rule)', background: 'var(--bg)' }}
      >
        <table
          className="border-collapse text-[12.5px]"
          style={{ minWidth: LABEL_WIDTH + weeks.length * CELL_WIDTH }}
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky text-start align-bottom px-3 py-2 font-semibold"
                style={{
                  right: 0,
                  zIndex: 2,
                  width: LABEL_WIDTH,
                  minWidth: LABEL_WIDTH,
                  background: 'var(--option-bg-selected)',
                  color: 'var(--accent-strong)',
                  borderBottom: '1px solid var(--rule)',
                  borderInlineEnd: '1px solid var(--rule)',
                }}
              >
                الرقم / التاريخ
              </th>
              {weeks.map((w) => (
                <th
                  key={w.key}
                  scope="col"
                  className="px-2 py-2 text-center font-medium align-bottom"
                  style={{
                    width: CELL_WIDTH,
                    minWidth: CELL_WIDTH,
                    background: 'var(--option-bg-selected)',
                    color: 'var(--accent-strong)',
                    borderBottom: '1px solid var(--rule)',
                    borderInlineEnd: '1px solid var(--rule-soft)',
                  }}
                >
                  <div className="leading-tight">{w.hijriLabel}</div>
                  <div
                    className="leading-tight text-[11px] font-normal mt-0.5"
                    style={{ color: 'var(--muted)' }}
                  >
                    {w.gregorianLabel}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FORUM_WEEKLY_ROWS.map((row, i) => {
              const striped = i % 2 === 1;
              const rowBg = striped ? 'var(--option-bg-selected)' : 'var(--bg)';
              return (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="sticky text-start px-3 py-2 font-medium"
                    style={{
                      right: 0,
                      zIndex: 1,
                      background: rowBg,
                      color: 'var(--fg)',
                      borderBottom: '1px solid var(--rule-soft)',
                      borderInlineEnd: '1px solid var(--rule)',
                    }}
                    title={row.note}
                  >
                    {row.label}
                  </th>
                  {weeks.map((w, wi) => (
                    <td
                      key={w.key}
                      className="px-2 py-2 text-center tabular-nums"
                      style={{
                        background: rowBg,
                        color: 'var(--fg)',
                        borderBottom: '1px solid var(--rule-soft)',
                        borderInlineEnd: '1px solid var(--rule-soft)',
                      }}
                    >
                      {FMT_INT.format(counts[wi][row.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="mt-3 space-y-1 text-[11.5px]" style={{ color: 'var(--muted)' }}>
        {FORUM_WEEKLY_ROWS.map((row) => (
          <div key={row.key} className="flex flex-wrap gap-x-1.5">
            <dt className="font-medium" style={{ color: 'var(--fg)' }}>
              {row.label}:
            </dt>
            <dd>{row.note}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        <span className="font-medium" style={{ color: 'var(--fg)' }}>
          تنبيه عن صف القرّاء:
        </span>{' '}
        فلورم يحفظ آخر قراءة لكل (عضو، موضوع) فقط، فمن قرأ الموضوع نفسه مراراً
        يُحتسب في أسبوع قراءته الأخيرة وحده. الرقم إذن حدّ أدنى للأسابيع
        الماضية، ويميل للدقّة كلما اقترب الأسبوع. الزوار الضيوف غير مسجّلين في
        فلورم أصلاً — لإضافتهم نحتاج Google Analytics لموقع المنتدى.
      </p>

      {degraded.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11.5px]" style={{ color: 'var(--muted)' }}>
          {degraded.map((d, i) => (
            <li key={i}>⚠ {d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
