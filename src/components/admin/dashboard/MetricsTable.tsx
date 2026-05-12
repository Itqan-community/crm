'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { saveWeeklyMetrics, type WeeklyMetricInput } from '@/lib/dashboard/actions';
import type { EditableMetric } from '@/lib/dashboard/queries';

// Bottom-of-dashboard table for admins to review and adjust the daily
// numbers that feed every chart. One section per metric; inside each
// section a small grid: main value + meta sub-fields × 7 weekday
// cells (Sun→Sat). Saving upserts only the cells the user actually
// touched (`dirty` tracking) and then revalidates /admin so the
// charts redraw with the new numbers.

export function MetricsTable({ metrics }: { metrics: EditableMetric[] }) {
  // Per-cell state keyed by "metricKey|day|fieldKey" where fieldKey is
  // 'value' for the main number and the meta key otherwise. Flat
  // map keeps updates O(1).
  type CellKey = string;
  type CellMap = Record<CellKey, string>;
  const initial = useMemo<CellMap>(() => {
    const map: CellMap = {};
    for (const m of metrics) {
      for (const row of m.rows) {
        map[cellKey(m.metricKey, row.day, 'value')] = String(row.value ?? 0);
        for (const f of m.metaFields) {
          map[cellKey(m.metricKey, row.day, f.key)] = String(row.meta[f.key] ?? 0);
        }
      }
    }
    return map;
  }, [metrics]);

  const router = useRouter();
  const [values, setValues] = useState<CellMap>(initial);
  const [dirty, setDirty] = useState<Set<CellKey>>(new Set());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const onChange = (mk: string, day: string, field: string, v: string) => {
    const k = cellKey(mk, day, field);
    setValues((s) => ({ ...s, [k]: v }));
    setDirty((s) => {
      if (s.has(k)) return s;
      const next = new Set(s);
      next.add(k);
      return next;
    });
  };

  const onSave = () => {
    setFeedback(null);
    // Group dirty cells back into the WeeklyMetricInput shape — one
    // entry per (metric, day) that has at least one dirty field.
    const byMetricDay = new Map<string, WeeklyMetricInput>();
    for (const m of metrics) {
      for (const row of m.rows) {
        const valueDirty = dirty.has(cellKey(m.metricKey, row.day, 'value'));
        const dirtyMeta = m.metaFields.filter((f) =>
          dirty.has(cellKey(m.metricKey, row.day, f.key)),
        );
        if (!valueDirty && dirtyMeta.length === 0) continue;
        // Re-include ALL fields for this (metric,day) so we don't
        // accidentally null out unchanged-but-stored meta keys.
        const meta: Record<string, string> = {};
        for (const f of m.metaFields) {
          meta[f.key] = values[cellKey(m.metricKey, row.day, f.key)] ?? '0';
        }
        byMetricDay.set(`${m.metricKey}|${row.day}`, {
          day: row.day,
          metric_key: m.metricKey,
          value: values[cellKey(m.metricKey, row.day, 'value')] ?? '0',
          meta,
        });
      }
    }
    const payload = Array.from(byMetricDay.values());
    if (payload.length === 0) {
      setFeedback({ kind: 'ok', msg: 'لا توجد تعديلات للحفظ.' });
      return;
    }
    startTransition(async () => {
      try {
        await saveWeeklyMetrics(payload);
        setDirty(new Set());
        setFeedback({ kind: 'ok', msg: `تم حفظ ${payload.length} يوماً — ستظهر التحديثات في الرسوم.` });
        router.refresh();
      } catch (e) {
        setFeedback({ kind: 'err', msg: e instanceof Error ? e.message : 'فشل الحفظ' });
      }
    });
  };

  return (
    <section
      style={{
        marginTop: 28,
        padding: 22,
        borderRadius: 18,
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid var(--rule-soft)',
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          مراجعة وتعديل أرقام الأسبوع الماضي
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
          كل صف يمثل قيمة يوم في الأسبوع الماضي (الأحد إلى السبت). عدّل أي خانة واضغط حفظ —
          الرسوم البيانية فوق ستحدّث تلقائياً.
          <br />
          القيم التي تُدخلها يدوياً <strong>تُثبَّت</strong> (يظهر بجانبها 📌)
          ولن يُكتب فوقها من الكرون الليلي أو زر إعادة الملء. لتراجعها لاحقاً عدّل الخانة وحفظ.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {metrics.map((m) => (
          <MetricCard key={m.metricKey} metric={m} values={values} onChange={onChange} dirty={dirty} />
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {feedback && (
          <span
            style={{
              fontSize: 12.5,
              color: feedback.kind === 'ok' ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {feedback.msg}
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="dash-btn dash-btn-primary"
          style={{ minWidth: 140 }}
        >
          {pending ? 'جارٍ الحفظ…' : `حفظ التعديلات (${dirty.size})`}
        </button>
      </div>
    </section>
  );
}

function MetricCard({
  metric,
  values,
  onChange,
  dirty,
}: {
  metric: EditableMetric;
  values: Record<string, string>;
  onChange: (mk: string, day: string, field: string, v: string) => void;
  dirty: Set<string>;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: '1px solid var(--rule-soft)',
        background: 'rgba(255,255,255,0.6)',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{metric.label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.55 }}>
          {metric.description}
        </div>
      </div>

      {/* Grid: first column = field label, remaining 7 = weekday cells */}
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1fr) repeat(7, minmax(70px, 1fr))',
            gap: 6,
            alignItems: 'center',
            minWidth: 640,
          }}
        >
          {/* Header row */}
          <div />
          {metric.rows.map((r) => (
            <div
              key={`hdr-${r.day}`}
              style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}
              title={r.isManual ? `${r.day} — مُثبَّت يدوياً` : r.day}
            >
              {r.weekdayLabel}
              {r.isManual && (
                <span
                  aria-label="مُثبَّت يدوياً"
                  style={{ marginInlineStart: 4, fontSize: 10 }}
                >
                  📌
                </span>
              )}
            </div>
          ))}

          {/* Main value row */}
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{metric.valueLabel}</div>
          {metric.rows.map((r) => (
            <Cell
              key={`v-${r.day}`}
              value={values[cellKey(metric.metricKey, r.day, 'value')] ?? ''}
              disabled={r.isFuture}
              isDirty={dirty.has(cellKey(metric.metricKey, r.day, 'value'))}
              onChange={(v) => onChange(metric.metricKey, r.day, 'value', v)}
            />
          ))}

          {/* Meta sub-field rows */}
          {metric.metaFields.map((field) => (
            <FieldRow
              key={field.key}
              metric={metric}
              field={field}
              values={values}
              dirty={dirty}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  metric,
  field,
  values,
  dirty,
  onChange,
}: {
  metric: EditableMetric;
  field: { key: string; label: string };
  values: Record<string, string>;
  dirty: Set<string>;
  onChange: (mk: string, day: string, field: string, v: string) => void;
}) {
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--muted)', paddingInlineStart: 12 }}>
        ↳ {field.label}
      </div>
      {metric.rows.map((r) => (
        <Cell
          key={`${field.key}-${r.day}`}
          value={values[cellKey(metric.metricKey, r.day, field.key)] ?? ''}
          disabled={r.isFuture}
          isDirty={dirty.has(cellKey(metric.metricKey, r.day, field.key))}
          onChange={(v) => onChange(metric.metricKey, r.day, field.key, v)}
        />
      ))}
    </>
  );
}

function Cell({
  value,
  disabled,
  isDirty,
  onChange,
}: {
  value: string;
  disabled: boolean;
  isDirty: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="num"
      style={{
        width: '100%',
        padding: '6px 8px',
        fontSize: 13,
        borderRadius: 6,
        textAlign: 'center',
        border: `1px solid ${isDirty ? 'var(--accent)' : 'var(--rule-soft)'}`,
        background: disabled ? 'transparent' : isDirty ? 'rgba(27,67,50,0.04)' : 'var(--bg)',
        color: disabled ? 'var(--muted)' : 'var(--fg)',
      }}
    />
  );
}

function cellKey(metricKey: string, day: string, field: string): string {
  return `${metricKey}|${day}|${field}`;
}
