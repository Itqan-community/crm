export function Toolbar({ range }: { range: { label: string; compare: string } }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        borderBottom: '1px solid var(--rule-soft)',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontSize: 19, fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          نظرة الأسبوع
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
          {range.label} · {range.compare}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="نطاق زمني">
          <button type="button" aria-pressed="false">اليوم</button>
          <button type="button" aria-pressed="true">الأسبوع</button>
          <button type="button" aria-pressed="false">الشهر</button>
        </div>
        <button type="button" className="dash-btn">⤓ تصدير CSV</button>
        <button type="button" className="dash-btn dash-btn-primary">⎙ تصدير PDF</button>
      </div>
    </div>
  );
}
