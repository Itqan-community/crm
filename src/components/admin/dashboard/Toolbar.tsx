'use client';

import { useState } from 'react';
import type { DashboardData } from './types';

export function DashboardToolbar({ data }: { data: DashboardData }) {
  const [exporting, setExporting] = useState(false);

  const onExportCsv = () => {
    setExporting(true);
    try {
      const rows: Array<[string, string]> = [
        ['المؤشّر', 'القيمة'],
        ['الأسبوع الحالي', data.range.hijriLabel],
        ['الأسبوع المقارن', data.range.compareHijriLabel],
        ['وصول النشرة (مُرسَل)', String(data.community.newsletter.sent)],
        ['وصول النشرة (فُتِح)', String(data.community.newsletter.opened)],
        ['معدل فتح النشرة %', data.community.newsletter.rate.toFixed(2)],
        ['تفاعل المجتمع', String(data.community.engagement.value)],
        ['الوصول عبر الشبكات', String(data.community.socialReach.value)],
        ['زيارات الموقع', String(data.community.siteVisits.value)],
        ['زيارات الموقع (فريد)', String(data.community.siteVisits.uniq)],
        ['زيارات الموقع (عائد)', String(data.community.siteVisits.returning)],
        ['عدد الناشرين', String(data.platform.publishers.value)],
        ['ناشرون جدد', String(data.platform.publishers.new)],
        ['عدد المستفيدين', String(data.platform.beneficiaries.value)],
        ['مستفيدون جدد', String(data.platform.beneficiaries.new)],
        ['استهلاك المواد', String(data.platform.consumption.value)],
        ['مشاركات المجتمع', String(data.platform.shares.value)],
      ];
      const csv = rows
        .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
        .join('\n');
      // BOM so Excel reads it as UTF-8 instead of mojibake.
      const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `itqan-dashboard-${data.range.startISO.slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 22,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.01em',
          }}
        >
          لوحة البيانات
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          {data.range.hijriLabel}
          <span style={{ opacity: 0.6, marginInlineStart: 8 }}>· {data.range.gregorianLabel}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
          مقارنة بـ {data.range.compareHijriLabel}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="dash-seg" role="group" aria-label="نطاق زمني">
          <button type="button" aria-pressed="false" disabled title="قريباً">
            اليوم
          </button>
          <button type="button" aria-pressed="true">
            الأسبوع
          </button>
          <button type="button" aria-pressed="false" disabled title="قريباً">
            الشهر
          </button>
        </div>
        <button
          type="button"
          className="dash-btn"
          onClick={onExportCsv}
          disabled={exporting}
          aria-label="تصدير CSV"
        >
          ⤓ تصدير CSV
        </button>
        <button
          type="button"
          className="dash-btn"
          disabled
          aria-disabled="true"
          title="قريباً"
          aria-label="تصدير PDF"
        >
          ⎙ تصدير PDF
        </button>
      </div>
    </div>
  );
}
