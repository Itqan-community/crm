import { Delta, Ring, SourceBadge, Sparkline, fmt } from './atoms';
import type { DashboardData } from './types';

export function CommunitySection({ data }: { data: DashboardData }) {
  const { newsletter, socialReach, siteVisits } = data.community;
  return (
    <>
      <SectionHeader title="المجتمع" subtitle="وصول · تفاعل · زيارات" />
      <div className="dash-row dash-row-3" style={{ marginBottom: 22 }}>
        {/* Newsletter ring card */}
        <div
          className="dash-glass"
          style={{ padding: 22, borderRadius: 18, position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: -30,
              insetInlineStart: -30,
              width: 160,
              height: 160,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, color-mix(in srgb, var(--gold) 22%, transparent), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>وصول النشرة</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                معدل الفتح
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <SourceBadge source={newsletter.source} />
              <Delta
                value={
                  newsletter.delta === null
                    ? null
                    : Number((newsletter.rate - newsletter.prevRate).toFixed(1))
                }
                suffix=" نقطة"
              />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            <Ring pct={newsletter.rate} size={108} stroke={10} color="var(--gold)" />
            <div>
              <div className="dash-num" style={{ fontSize: 13, color: 'var(--muted)' }}>
                {fmt(newsletter.opened)} فتحوا
              </div>
              <div
                className="dash-num"
                style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}
              >
                {fmt(newsletter.sent)} مُرسَلة
              </div>
              <div
                style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}
              >
                {newsletter.source.startsWith('mailerlite') || newsletter.source === 'stats:newsletter'
                  ? 'تُجمع تلقائياً من MailerLite'
                  : 'إدخال يدوي'}
              </div>
            </div>
          </div>
        </div>

        {/* Social reach */}
        <div className="dash-glass" style={{ padding: 22, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>الوصول عبر الشبكات</div>
              <div className="dash-num" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
                {fmt(socialReach.value)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <SourceBadge source={socialReach.source} />
              <Delta value={socialReach.delta} />
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {socialReach.channels.length > 0 ? (
              socialReach.channels.map((c, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
                >
                  <span style={{ color: 'var(--muted)' }}>{c.k}</span>
                  <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="dash-num">{fmt(c.v)}</span>
                    <Delta value={c.d} />
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                لا توجد قنوات مدخلة بعد
              </div>
            )}
          </div>
        </div>

        {/* Visits */}
        <div className="dash-glass" style={{ padding: 22, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>زيارات الموقع</div>
              <div className="dash-num" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
                {fmt(siteVisits.value)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <SourceBadge source={siteVisits.source} />
              <Delta value={siteVisits.delta} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Sparkline
              data={data.series.siteVisits.now}
              prev={data.series.siteVisits.prev}
              showPrev={true}
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
              <span
                className="dash-num"
                style={{ color: 'var(--fg)', fontWeight: 500 }}
              >
                {fmt(siteVisits.uniq)}
              </span>{' '}
              فريد
            </span>
            <span>
              <span
                className="dash-num"
                style={{ color: 'var(--fg)', fontWeight: 500 }}
              >
                {fmt(siteVisits.returning)}
              </span>{' '}
              عائد
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        marginBottom: 14,
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
        }}
      >
        {title}
      </h2>
      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{subtitle}</span>
      <div style={{ flex: 1, minWidth: 30, height: 1, background: 'var(--rule-soft)' }} />
    </div>
  );
}
