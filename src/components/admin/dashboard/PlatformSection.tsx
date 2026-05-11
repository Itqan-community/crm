import { BigStat, Delta, fmt, fmtStr } from './atoms';
import type { DashboardData } from './types';
import type { DashboardWindow } from '@/lib/dashboard/types';

const PERIOD_AR: Record<DashboardWindow, string> = {
  day: 'اليوم',
  month: 'الشهر',
};

export function PlatformSection({
  data,
  series,
  window,
}: {
  data: DashboardData['platform'];
  series: DashboardData['series'];
  window: DashboardWindow;
}) {
  const total = data.consumption.mix.reduce((s, x) => s + x.v, 0);

  return (
    <>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          المنصة
        </h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          الناشرون · المستفيدون · الاستهلاك · المشاركات
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--rule-soft)' }} />
      </div>

      <div className="dash-grid-platform">
        <BigStat
          label="عدد الناشرين"
          value={data.publishers.value}
          delta={data.publishers.delta}
          series={series.publishers.now}
          sub={`${data.publishers.new} جدد هذا ${PERIOD_AR[window]}`}
        />
        <BigStat
          label="عدد المستفيدين"
          value={data.beneficiaries.value}
          delta={data.beneficiaries.delta}
          series={series.beneficiaries.now}
          sub={`${fmtStr(data.beneficiaries.new)} انضموا حديثاً`}
          accent="var(--gold)"
        />

        {/* Consumption mix card */}
        <div className="glass-deep" style={{ padding: 22, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>استهلاك المواد المنشورة</div>
            <Delta value={data.consumption.delta} />
          </div>
          <div className="num" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
            {fmt(data.consumption.value)}
          </div>
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 999,
              overflow: 'hidden',
              marginTop: 14,
              background: 'rgba(27,67,50,0.06)',
            }}
          >
            {data.consumption.mix.map((m) => (
              <div key={m.k} style={{ width: `${(m.v / total) * 100}%`, background: m.c }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {data.consumption.mix.map((m) => {
              const pct = total > 0 ? ((m.v / total) * 100).toFixed(0) + '%' : '—';
              return (
                <div
                  key={m.k}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}
                >
                  <span className="dot" style={{ background: m.c }} />
                  <span>{m.k}</span>
                  <span className="num" style={{ color: 'var(--muted)' }}>{pct}</span>
                </div>
              );
            })}
          </div>
        </div>

        <BigStat
          label="مشاركات المجتمع"
          value={data.shares.value}
          delta={data.shares.delta}
          series={series.shares.now}
          sub="من قِبل المستفيدين"
          accent="var(--info)"
        />
      </div>
    </>
  );
}
