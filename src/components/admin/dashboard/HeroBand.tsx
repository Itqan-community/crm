import { fmt } from './atoms';
import type { DashboardData } from './types';

export function HeroBand({ data }: { data: DashboardData }) {
  const heroNow = data.series.engagement.now;
  const heroPrev = data.series.engagement.prev;
  const W = 720;
  const H = 220;
  const P = 16;

  const all = heroNow.length === heroPrev.length ? [...heroNow, ...heroPrev] : heroNow;
  const finite = all.filter((n) => Number.isFinite(n));
  const min = finite.length > 0 ? Math.min(...finite) * 0.9 : 0;
  const max = finite.length > 0 ? Math.max(...finite) * 1.08 : 1;
  const range = max - min || 1;
  const step = heroNow.length > 1 ? (W - P * 2) / (heroNow.length - 1) : 0;
  const toPath = (vals: number[]): string =>
    vals
      .map((v, i) => {
        const x = P + i * step;
        const y = H - P - ((v - min) / range) * (H - P * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const engagement = data.community.engagement;
  const deltaPct = engagement.delta;
  const deltaUp = (deltaPct ?? 0) > 0;
  const deltaSign = deltaUp ? '↑' : (deltaPct ?? 0) < 0 ? '↓' : '→';

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 22,
        overflow: 'hidden',
        padding: 28,
        marginBottom: 22,
        background:
          'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 78%, black 22%))',
        color: 'var(--accent-fg)',
        boxShadow: '0 24px 60px -30px rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr',
          gap: 24,
          alignItems: 'end',
        }}
        className="dash-hero-grid"
      >
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
            className="dash-num"
            style={{
              fontSize: 54,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              fontFamily: 'var(--font-display)',
            }}
          >
            {fmt(engagement.value)}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {deltaPct !== null && Number.isFinite(deltaPct) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'color-mix(in srgb, var(--gold) 28%, transparent)',
                  color: 'var(--accent-fg)',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {deltaSign} {Math.abs(deltaPct).toFixed(1)}% عن الأسبوع السابق
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 18,
              fontSize: 11.5,
              opacity: 0.85,
              flexWrap: 'wrap',
            }}
          >
            {engagement.breakdown.slice(0, 4).map((b, i) => (
              <div key={i}>
                <div style={{ opacity: 0.7 }}>{b.k}</div>
                <div className="dash-num" style={{ fontSize: 16, fontWeight: 500, opacity: 1 }}>
                  {fmt(b.v)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }} className="dash-hero-chart">
          {heroNow.length > 1 ? (
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
              <defs>
                <linearGradient id="dash-hero-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {heroPrev.length === heroNow.length && (
                <path
                  d={toPath(heroPrev)}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1.4"
                  fill="none"
                  strokeDasharray="4 5"
                />
              )}
              <path
                d={
                  toPath(heroNow) +
                  ` L${P + (heroNow.length - 1) * step},${H - P} L${P},${H - P} Z`
                }
                fill="url(#dash-hero-area)"
              />
              <path
                d={toPath(heroNow)}
                stroke="var(--gold)"
                strokeWidth="2.4"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {heroNow.map((v, i) => {
                const x = P + i * step;
                const y = H - P - ((v - min) / range) * (H - P * 2);
                return <circle key={i} cx={x} cy={y} r="3" fill="var(--gold)" />;
              })}
              {data.days.map((d, i) => (
                <text
                  key={i}
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
          ) : (
            <div
              style={{
                height: H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                opacity: 0.6,
              }}
            >
              تتراكم البيانات قريباً
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
