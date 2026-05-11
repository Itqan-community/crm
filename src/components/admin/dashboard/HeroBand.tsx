import { fmt } from './atoms';
import type { DashboardData } from './types';
import type { DashboardWindow } from '@/lib/dashboard/types';

const W = 720;
const H = 220;
const P = 16;

const PERIOD_AR: Record<DashboardWindow, string> = {
  day: 'اليوم السابق',
  month: 'الشهر السابق',
};

export function HeroBand({
  data,
  window,
}: {
  data: DashboardData;
  window: DashboardWindow;
}) {
  const heroSeries = data.series.engagement.now;
  const heroPrev = data.series.engagement.prev;
  const all = [...heroSeries, ...heroPrev];
  const min = Math.min(...all) * 0.9;
  const max = Math.max(...all) * 1.08;
  const range = max - min || 1;
  const step = (W - P * 2) / (heroSeries.length - 1);
  const toPath = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = P + i * step;
        const y = H - P - ((v - min) / range) * (H - P * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 22,
        overflow: 'hidden',
        padding: 28,
        marginBottom: 22,
        background: 'linear-gradient(135deg, rgba(27,67,50,0.92), rgba(27,67,50,0.78))',
        color: '#FAF6F0',
        boxShadow: '0 24px 60px -30px rgba(27,67,50,0.6)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div className="dash-grid-hero" style={{ position: 'relative' }}>
        <div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              fontWeight: 500,
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            أسبوع متماسك ✦ تفاعل المجتمع
          </div>
          <div
            className="num"
            style={{
              fontSize: 54,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              fontFamily: 'var(--font-display)',
            }}
          >
            {fmt(data.community.engagement.value)}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(212,180,131,0.25)',
                color: '#E6C99A',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              ↑ {data.community.engagement.delta}% عن {PERIOD_AR[window]}
            </span>
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 18, fontSize: 11.5, opacity: 0.85, flexWrap: 'wrap' }}>
            {data.community.engagement.breakdown.slice(0, 4).map((b) => (
              <div key={b.k}>
                <div style={{ opacity: 0.7 }}>{b.k}</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 500, opacity: 1 }}>
                  {fmt(b.v)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
            <defs>
              <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4B483" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#D4B483" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={toPath(heroPrev)}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.4"
              fill="none"
              strokeDasharray="4 5"
            />
            <path
              d={
                toPath(heroSeries) +
                ` L${P + (heroSeries.length - 1) * step},${H - P} L${P},${H - P} Z`
              }
              fill="url(#hero-area)"
            />
            <path
              d={toPath(heroSeries)}
              stroke="#E6C99A"
              strokeWidth="2.4"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {heroSeries.map((v, i) => {
              const x = P + i * step;
              const y = H - P - ((v - min) / range) * (H - P * 2);
              return <circle key={i} cx={x} cy={y} r="3" fill="#E6C99A" />;
            })}
            {data.days.map((d, i) => (
              <text
                key={d}
                x={P + i * step}
                y={H - 2}
                fontSize="10.5"
                fill="rgba(255,255,255,0.55)"
                textAnchor="middle"
                fontFamily="var(--font-body)"
              >
                {d}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
