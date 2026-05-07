import { Delta, Ring, Sparkline, fmt } from './atoms';
import type { DashboardData } from './types';

export function CommunitySection({
  data,
  series,
}: {
  data: DashboardData['community'];
  series: DashboardData['series'];
}) {
  return (
    <>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          المجتمع
        </h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>وصول · تفاعل · زيارات</span>
        <div style={{ flex: 1, height: 1, background: 'var(--rule-soft)' }} />
      </div>

      <div className="dash-grid-community">
        {/* Newsletter ring card */}
        <div
          className="glass-deep"
          style={{ padding: 22, borderRadius: 18, position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: -30,
              left: -30,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(148,110,82,0.18), transparent 70%)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>وصول النشرة</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>معدل الفتح</div>
            </div>
            <Delta value={3.3} suffix=" نقطة" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 16 }}>
            <Ring pct={data.newsletter.rate} size={108} stroke={10} color="var(--gold)" />
            <div>
              <div className="num" style={{ fontSize: 13, color: 'var(--muted)' }}>
                {fmt(data.newsletter.opened)} فتحوا
              </div>
              <div className="num" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                {fmt(data.newsletter.sent)} مُرسَلة
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                أعلى من المتوسط
                <br />
                الصناعي (38%)
              </div>
            </div>
          </div>
        </div>

        {/* Social reach */}
        <div className="glass-deep" style={{ padding: 22, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>الوصول عبر الشبكات</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
                {fmt(data.socialReach.value)}
              </div>
            </div>
            <Delta value={data.socialReach.delta} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.socialReach.channels.map((c) => (
              <div
                key={c.k}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
              >
                <span style={{ color: 'var(--muted)' }}>{c.k}</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="num">{fmt(c.v)}</span>
                  <Delta value={c.d} />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Visits */}
        <div className="glass-deep" style={{ padding: 22, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>زيارات الموقع</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
                {fmt(data.siteVisits.value)}
              </div>
            </div>
            <Delta value={data.siteVisits.delta} />
          </div>
          <div style={{ marginTop: 14 }}>
            <Sparkline
              data={series.siteVisits.now}
              prev={series.siteVisits.prev}
              showPrev
              height={60}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 10,
              fontSize: 11.5,
              color: 'var(--muted)',
            }}
          >
            <span>
              <span className="num" style={{ color: 'var(--fg)', fontWeight: 500 }}>
                {fmt(data.siteVisits.uniq)}
              </span>{' '}
              فريد
            </span>
            <span>
              <span className="num" style={{ color: 'var(--fg)', fontWeight: 500 }}>
                {fmt(data.siteVisits.returning)}
              </span>{' '}
              عائد
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
