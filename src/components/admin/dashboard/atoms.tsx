import { useId } from 'react';

export const fmt = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'م';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'ك';
  return n.toLocaleString('ar-EG');
};

export const fmtPct = (n: number, withSign = true): string =>
  (withSign && n > 0 ? '+' : '') + n.toFixed(1) + '%';

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
  const W = 200;
  const H = height;
  const all = prev ? [...data, ...prev] : data;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const path = (vals: number[]) => {
    const step = W / (vals.length - 1);
    return vals
      .map((v, i) => {
        const x = i * step;
        const y = H - 3 - ((v - min) / range) * (H - 6);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  };
  const linePath = path(data);
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const id = useId();
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showPrev && prev && (
        <path
          d={path(prev)}
          stroke={color}
          strokeOpacity="0.28"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray="3 3"
        />
      )}
      {fill && <path d={areaPath} fill={`url(#g-${id})`} />}
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

export function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  const up = value > 0;
  const flat = value === 0;
  const cls = flat ? 'delta-flat' : up ? 'delta-up' : 'delta-down';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  return (
    <span className={`${cls} num`} style={{ fontSize: 12, fontWeight: 500 }}>
      {arrow} {Math.abs(value).toFixed(1)}%{suffix}
    </span>
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
  const dash = (pct / 100) * C;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(27,67,50,0.08)" strokeWidth={stroke} />
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
        fontFamily="var(--font-body)"
        className="num"
      >
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
}

export function BigStat({
  label,
  value,
  delta,
  series,
  sub,
  accent = 'var(--accent)',
}: {
  label: string;
  value: number;
  delta: number;
  series: number[];
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className="glass-deep"
      style={{ padding: 22, borderRadius: 18, display: 'flex', flexDirection: 'column', minHeight: 180 }}
    >
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span className="num" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
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
