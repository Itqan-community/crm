import { fmt } from './atoms';
import type { DashboardData } from './types';
import type { DashboardWindow } from '@/lib/dashboard/types';

const W = 720;
const H = 200;
const P = 16;

const PERIOD_AR: Record<DashboardWindow, string> = {
  day: 'اليوم السابق',
  week: 'الأسبوع السابق',
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
  // "All zeros" → no daily snapshot history yet. Drawing a flat line at
  // the bottom edge looks broken; show a placeholder instead.
  const hasSeries = all.some((v) => v > 0);
  const min = Math.min(...all) * 0.9;
  const max = Math.max(...all) * 1.08;
  const range = max - min || 1;
  // A 1-point series would divide by zero — clamp the denominator so
  // toPath returns either an empty path or a single M-point.
  const canPlot = heroSeries.length > 1;
  const step = canPlot ? (W - P * 2) / (heroSeries.length - 1) : 0;
  const toPath = (vals: number[]) => {
    if (vals.length === 0) return '';
    if (vals.length === 1) {
      const x = P;
      const y = H - P - ((vals[0] - min) / range) * (H - P * 2);
      return `M${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return vals
      .map((v, i) => {
        const x = P + i * step;
        const y = H - P - ((v - min) / range) * (H - P * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

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
              {data.community.engagement.delta >= 0 ? '↑' : '↓'}{' '}
              {Math.abs(data.community.engagement.delta)}% عن {PERIOD_AR[window]}
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
          {hasSeries ? (
            <>
              {/* Chart paths only — labels live in the HTML row below
                  so they don't get stretched by preserveAspectRatio="none". */}
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
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
                  vectorEffect="non-scaling-stroke"
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
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {/* Day labels rendered in HTML so each glyph keeps its
                  natural width regardless of how wide the SVG stretches. */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: 6,
                  paddingInline: P,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {data.days.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                height: H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.55)',
                fontSize: 13,
                lineHeight: 1.6,
                textAlign: 'center',
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: 12,
              }}
            >
              لم تُسجَّل بيانات يومية بعد.
              <br />
              ستظهر هنا حالما يبدأ تخزين اللقطات اليومية.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
