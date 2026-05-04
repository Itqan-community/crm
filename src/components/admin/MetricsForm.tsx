'use client';

import { useState, useTransition } from 'react';
import { upsertWeeklyMetrics, type MetricEntry } from '@/lib/dashboard-actions';

type Field = { key: string; label: string };
type Group = { title: string; subtitle?: string; fields: Field[] };

// Groups are ordered by how often the admin should touch them. The
// "Channels not in stats" group is the only one that needs regular
// updates if STATS_BASE_URL is wired up. The rest are backfill / overrides.
const GROUPS: Group[] = [
  {
    title: 'الشبكات غير المشمولة في «stats»',
    subtitle: 'لينكدإن يأتي تلقائياً من stats — أدخل هنا الباقي يدوياً',
    fields: [
      { key: 'social_reach.x', label: 'X (تويتر)' },
      { key: 'social_reach.instagram', label: 'إنستقرام' },
      { key: 'social_reach.youtube', label: 'يوتيوب' },
    ],
  },
  {
    title: 'تجاوزات «overrides» — تُستخدم عند تعطّل stats أو غياب الإعداد',
    subtitle: 'اتركها صفراً إذا كانت stats تعمل بشكل صحيح',
    fields: [
      { key: 'newsletter.sent', label: 'النشرة: مُرسَل' },
      { key: 'newsletter.opened', label: 'النشرة: فُتِح' },
      { key: 'site_visits.total', label: 'زيارات الموقع: إجمالي' },
      { key: 'site_visits.unique', label: 'زيارات الموقع: فريد' },
      { key: 'site_visits.returning', label: 'زيارات الموقع: عائد' },
      { key: 'publishers.total', label: 'الناشرون: إجمالي' },
      { key: 'publishers.new', label: 'الناشرون: جدد' },
      { key: 'beneficiaries.total', label: 'المستفيدون: إجمالي' },
      { key: 'beneficiaries.new', label: 'المستفيدون: جدد' },
      { key: 'shares.total', label: 'مشاركات المجتمع' },
    ],
  },
  {
    title: 'تكميلات الاستهلاك',
    subtitle: 'stats يوفّر «المشاهدات» و«النقرات»؛ الاستماع/المشاركة يدوي',
    fields: [
      { key: 'consumption.listen', label: 'استماع' },
      { key: 'consumption.share', label: 'مشاركة' },
      { key: 'consumption.read', label: 'قراءة (override)' },
      { key: 'consumption.download', label: 'تحميل (override)' },
    ],
  },
  {
    title: 'تكميلات التفاعل',
    subtitle: 'تفاصيل لا يوفّرها stats',
    fields: [
      { key: 'engagement.shares', label: 'مشاركات (إعادة نشر)' },
      { key: 'engagement.mentions', label: 'إشارات وذكر (override)' },
      { key: 'engagement.total', label: 'الإجمالي (override)' },
      { key: 'engagement.replies', label: 'ردود (override)' },
      { key: 'engagement.likes', label: 'إعجابات (override)' },
    ],
  },
];

type WeekColumn = {
  weekKey: string;
  hijriLabel: string;
  gregorianLabel: string;
};

export function MetricsForm({
  weeks,
  initial,
}: {
  weeks: WeekColumn[]; // current first, then prior weeks
  initial: Record<string, Record<string, number>>; // weekKey -> metricKey -> value
}) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const set = (week: string, key: string, raw: string) => {
    const v = raw === '' ? 0 : Number(raw);
    setValues((prev) => ({
      ...prev,
      [week]: { ...(prev[week] ?? {}), [key]: Number.isFinite(v) ? v : 0 },
    }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const entries: MetricEntry[] = [];
    for (const w of weeks) {
      const wv = values[w.weekKey] ?? {};
      for (const g of GROUPS) {
        for (const f of g.fields) {
          const v = wv[f.key];
          if (v === undefined || v === null) continue;
          entries.push({ weekStart: w.weekKey, metricKey: f.key, value: Number(v) || 0 });
        }
      }
    }
    startTransition(async () => {
      try {
        await upsertWeeklyMetrics(entries);
        setMessage({ kind: 'ok', text: 'تم الحفظ' });
      } catch (err) {
        const text = err instanceof Error ? err.message : 'فشل الحفظ';
        setMessage({ kind: 'err', text });
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {GROUPS.map((g) => (
        <section
          key={g.title}
          className="dash-glass"
          style={{ padding: 18, borderRadius: 14 }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{g.title}</h3>
          {g.subtitle && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, marginBottom: 12 }}>
              {g.subtitle}
            </div>
          )}
          {!g.subtitle && <div style={{ marginBottom: 12 }} />}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '8px 12px',
                      color: 'var(--muted)',
                      fontWeight: 500,
                    }}
                  >
                    المؤشّر
                  </th>
                  {weeks.map((w, i) => (
                    <th
                      key={w.weekKey}
                      style={{
                        textAlign: 'right',
                        padding: '8px 12px',
                        color: 'var(--muted)',
                        fontWeight: 500,
                        minWidth: 140,
                      }}
                    >
                      <div style={{ color: 'var(--fg)' }}>
                        {i === 0 ? 'هذا الأسبوع' : i === 1 ? 'السابق' : `−${i}`}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 400 }}>{w.hijriLabel}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.fields.map((f) => (
                  <tr key={f.key} style={{ borderTop: '1px solid var(--rule-soft)' }}>
                    <td style={{ padding: '8px 12px' }}>{f.label}</td>
                    {weeks.map((w) => (
                      <td key={w.weekKey} style={{ padding: '8px 12px' }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={values[w.weekKey]?.[f.key] ?? 0}
                          onChange={(e) => set(w.weekKey, f.key, e.target.value)}
                          className="dash-num"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--rule)',
                            background: 'var(--option-bg)',
                            color: 'var(--fg)',
                            fontFamily: 'inherit',
                            textAlign: 'start',
                          }}
                          aria-label={`${f.label} — ${w.hijriLabel}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" className="dash-btn dash-btn-primary" disabled={pending}>
          {pending ? '…جارٍ الحفظ' : 'حفظ التغييرات'}
        </button>
        {message && (
          <span
            style={{
              fontSize: 12.5,
              color: message.kind === 'ok' ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
