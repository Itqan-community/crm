'use client';

import { useId } from 'react';
import type { MetricSource } from './types';

const SOURCE_LABEL: Record<MetricSource, string> = {
  mailerlite: 'MailerLite',
  'stats:newsletter': 'MailerLite (stats)',
  'stats:forum': 'المنتدى',
  'stats:analytics': 'Google Analytics',
  'stats:linkedin': 'لينكدإن',
  'stats:github': 'GitHub',
  'stats:apps': 'دليل التطبيقات',
  manual: 'إدخال يدوي',
  mixed: 'مصادر متعددة',
};

export function SourceBadge({ source }: { source: MetricSource }) {
  return (
    <span
      title={`مصدر البيانات: ${SOURCE_LABEL[source]}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 500,
        color: 'var(--muted)',
        border: '1px solid var(--rule-soft)',
        background: 'var(--accent-soft)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className="dash-dot"
        style={{
          background: source === 'manual' ? 'var(--muted)' : 'var(--success)',
          width: 5,
          height: 5,
        }}
      />
      {SOURCE_LABEL[source]}
    </span>
  );
}

// Number formatting matches the design: م/ك (million/thousand) shorthand
// for big numbers, Arabic-Egyptian locale for thousands grouping otherwise.
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'م';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'ك';
  return n.toLocaleString('ar-EG');
}

export function fmtPct(n: number, withSign = true): string {
  if (!Number.isFinite(n)) return '—';
  return (withSign && n > 0 ? '+' : '') + n.toFixed(1) + '%';
}

export function Sparkline({
  data,
  prev,
  color = 'var(--accent)',
  height = 40,
  fill = true,
  showPrev = false,
}: {
  data: number[];
  prev?: number[];
  color?: string;
  height?: number;
  fill?: boolean;
  showPrev?: boolean;
}) {
  const id = useId();
  const W = 200;
  const H = height;

  if (!data || data.length < 2) {
    return (
      <div
        style={{
          height: H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--muted)',
        }}
      >
        لا توجد بيانات كافية
      </div>
    );
  }

  const all = prev && prev.length === data.length ? [...data, ...prev] : data;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const path = (vals: number[]): string => {
    const step = W / (vals.length - 1);
    return vals
      .map((v, i) => {
        const x = i * step;
        const y = H - 3 - ((v - min) / range) * (H - 6);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };
  const linePath = path(data);
  const areaPath = linePath + ` L${W},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showPrev && prev && prev.length === data.length && (
        <path
          d={path(prev)}
          stroke={color}
          strokeOpacity="0.28"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray="3 3"
        />
      )}
      {fill && <path d={areaPath} fill={`url(#spark-${id})`} />}
      <path
        d={linePath}
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Ring({
  pct,
  size = 100,
  stroke = 8,
  color = 'var(--accent)',
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  const dash = (safePct / 100) * C;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${C - dash}`}
        strokeDashoffset={C / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.26}
        fontWeight="600"
        fill="var(--fg)"
        className="dash-num"
      >
        {safePct.toFixed(0)}%
      </text>
    </svg>
  );
}

export function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="dash-delta-flat dash-num" style={{ fontSize: 12, fontWeight: 500 }}>
        —
      </span>
    );
  }
  const flat = value === 0;
  const up = value > 0;
  const cls = flat ? 'dash-delta-flat' : up ? 'dash-delta-up' : 'dash-delta-down';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  return (
    <span className={cls + ' dash-num'} style={{ fontSize: 12, fontWeight: 500 }}>
      {arrow} {Math.abs(value).toFixed(1)}%{suffix}
    </span>
  );
}

export function BigStat({
  label,
  value,
  delta,
  series,
  sub,
  accent = 'var(--accent)',
  source,
}: {
  label: string;
  value: number;
  delta: number | null;
  series: number[];
  sub?: string;
  accent?: string;
  source?: MetricSource;
}) {
  return (
    <div
      className="dash-glass"
      style={{
        padding: 22,
        borderRadius: 18,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 180,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
        {source && <SourceBadge source={source} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span
          className="dash-num"
          style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}
        >
          {fmt(value)}
        </span>
        <Delta value={delta} />
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{sub}</div>}
      <div style={{ marginTop: 'auto' }}>
        <Sparkline data={series} color={accent} height={48} />
      </div>
    </div>
  );
}
