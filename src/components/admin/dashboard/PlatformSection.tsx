import { BigStat, Delta, SourceBadge, fmt } from './atoms';
import type { DashboardData } from './types';

export function PlatformSection({ data }: { data: DashboardData }) {
  const { publishers, beneficiaries, consumption, shares } = data.platform;
  const total = consumption.mix.reduce((s, x) => s + x.v, 0);

  return (
    <>
      <SectionHeader
        title="المنصة"
        subtitle="الناشرون · المستفيدون · الاستهلاك · المشاركات"
      />
      <div className="dash-row dash-row-4">
        <BigStat
          label="عدد الناشرين"
          value={publishers.value}
          delta={publishers.delta}
          series={data.series.publishers.now}
          sub={`${fmt(publishers.new)} ناشرون جدد هذا الأسبوع`}
          source={publishers.source}
        />
        <BigStat
          label="عدد المستفيدين"
          value={beneficiaries.value}
          delta={beneficiaries.delta}
          series={data.series.beneficiaries.now}
          sub={`${fmt(beneficiaries.new)} انضموا حديثاً`}
          accent="var(--gold)"
          source={beneficiaries.source}
        />

        <div className="dash-glass" style={{ padding: 22, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>استهلاك المواد المنشورة</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <SourceBadge source={consumption.source} />
              <Delta value={consumption.delta} />
            </div>
          </div>
          <div className="dash-num" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
            {fmt(consumption.value)}
          </div>
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 999,
              overflow: 'hidden',
              marginTop: 14,
              background: 'var(--accent-soft)',
            }}
          >
            {total > 0 ? (
              consumption.mix.map((m, i) => (
                <div
                  key={i}
                  style={{ width: (m.v / total) * 100 + '%', background: m.c }}
                  title={`${m.k}: ${fmt(m.v)}`}
                />
              ))
            ) : (
              <div style={{ flex: 1, background: 'var(--rule-soft)' }} />
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {consumption.mix.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11.5,
                }}
              >
                <span className="dash-dot" style={{ background: m.c }}></span>
                <span>{m.k}</span>
                <span className="dash-num" style={{ color: 'var(--muted)' }}>
                  {total > 0 ? ((m.v / total) * 100).toFixed(0) : '0'}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <BigStat
          label="مشاركات المجتمع"
          value={shares.value}
          delta={shares.delta}
          series={data.series.shares.now}
          sub="من قِبل المستفيدين"
          accent="var(--info)"
          source={shares.source}
        />
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
