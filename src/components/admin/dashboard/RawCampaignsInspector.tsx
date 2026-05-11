'use client';

import { useState, useTransition } from 'react';

// Shows the raw MailerLite campaign data so you can verify what the
// dashboard's daily opens are derived from. The two numbers we care
// about:
//   - opens_raw_from_API  : what /api/campaigns list returned for
//                           unique_opens_count. Often 0 on this
//                           endpoint — MailerLite omits raw counts
//                           there.
//   - opens_derived_from_rate : sent × open_rate, our fallback.
// If both columns disagree, only one of them is real.

type Campaign = {
  id: string;
  name: string;
  subject: string;
  sentAt: string | null;
  sent: number;
  opens_raw_from_API: number;
  opens_derived_from_rate: number;
  openRate_pct: number;
  clicks: number;
  clickRate_pct: number;
};

type Response = {
  configured: boolean;
  hint?: string;
  activeSubscribers?: number;
  last7Days?: {
    count: number;
    totalSent: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
  recentCampaigns?: Campaign[];
};

export function RawCampaignsInspector() {
  const [data, setData] = useState<Response | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setData(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/dashboard-campaigns');
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(body || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as Response;
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل');
      }
    });
  };

  return (
    <section
      className="rounded-xl border p-5 space-y-4"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div>
        <h2 className="text-[16px] font-semibold">القيم الخام من MailerLite</h2>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--muted)' }}>
          يعرض ما ترجعه MailerLite API لكل حملة مرسلة في آخر فترة. عمود
          <code className="mono ms-1">opens_raw_from_API</code> هو
          <code className="mono ms-1">unique_opens_count</code> كما ترسله الخدمة — قد يكون ٠ لأن
          endpoint قائمة الحملات لا يُعيد العداد الخام. عمود
          <code className="mono ms-1">opens_derived_from_rate</code> هو حسابنا
          <code className="mono ms-1">sent × open_rate</code>.
        </p>
      </div>

      <button
        type="button"
        onClick={load}
        disabled={pending}
        className="dash-btn dash-btn-primary"
      >
        {pending ? 'جارٍ التحميل…' : 'اجلب القيم الحالية من MailerLite'}
      </button>

      {error && (
        <div className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {data && !data.configured && (
        <div className="text-[13px]" style={{ color: 'var(--danger)' }}>
          MailerLite غير مهيأ: {data.hint}
        </div>
      )}

      {data?.configured && data.recentCampaigns && (
        <>
          <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
            مشتركون نشطون: <span className="num">{data.activeSubscribers}</span>
            {' · '}
            آخر 7 أيام: <span className="num">{data.last7Days?.count}</span> حملات،
            متوسط الفتح <span className="num">{data.last7Days?.avgOpenRate?.toFixed(1)}%</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              className="w-full text-[12.5px]"
              style={{ borderCollapse: 'collapse', direction: 'rtl' }}
            >
              <thead style={{ background: 'var(--option-bg-selected)' }}>
                <tr>
                  <th style={th}>اسم الحملة</th>
                  <th style={th}>تاريخ الإرسال</th>
                  <th style={th}>المُرسَلين</th>
                  <th style={th}>opens_raw (API)</th>
                  <th style={th}>opens_derived (sent × rate)</th>
                  <th style={th}>معدل الفتح %</th>
                  <th style={th}>النقرات</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCampaigns.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--rule-soft)' }}>
                    <td style={td}>{c.name}</td>
                    <td style={td}>{c.sentAt?.slice(0, 16).replace('T', ' ')}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>
                      {c.sent}
                    </td>
                    <td
                      style={{
                        ...td,
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'end',
                        color: c.opens_raw_from_API === 0 ? 'var(--danger)' : 'var(--fg)',
                        fontWeight: c.opens_raw_from_API === 0 ? 500 : 400,
                      }}
                      title={c.opens_raw_from_API === 0 ? 'MailerLite returned 0 — list endpoint omits raw count' : ''}
                    >
                      {c.opens_raw_from_API}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>
                      {c.opens_derived_from_rate}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>
                      {c.openRate_pct.toFixed(1)}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', textAlign: 'end' }}>
                      {c.clicks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'start', fontWeight: 600 };
const td: React.CSSProperties = { padding: '8px 10px' };
