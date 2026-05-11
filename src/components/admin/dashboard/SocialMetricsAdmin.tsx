'use client';

import { useState, useTransition } from 'react';
import { saveSocialSnapshot } from '@/lib/dashboard/actions';
import {
  type SocialChannelKey,
  SOCIAL_LABELS,
} from '@/lib/dashboard/types';
import type { SocialEditorRow } from '@/lib/dashboard/queries';

// Per-channel metric schema. Drives both the form layout and which
// fields end up in the row's structured columns vs the `extra` jsonb.
type FieldDef = { key: string; label: string; in: 'column' | 'extra' };

const CHANNEL_FIELDS: Record<SocialChannelKey, FieldDef[]> = {
  linkedin: [
    { key: 'followers_total', label: 'عدد المتابعين الكلي', in: 'column' },
    { key: 'followers_new', label: 'المتابعون الجدد (آخر ٧ أيام)', in: 'column' },
    { key: 'impressions', label: 'مرات العرض', in: 'column' },
    { key: 'engagements', label: 'التفاعلات', in: 'column' },
    { key: 'page_views', label: 'مشاهدات الصفحة', in: 'column' },
    { key: 'unique_visitors', label: 'زوار فريدون', in: 'column' },
    { key: 'search_appearances', label: 'الظهور في نتائج البحث', in: 'extra' },
  ],
  facebook: [
    { key: 'followers_total', label: 'عدد المتابعين الكلي', in: 'column' },
    { key: 'followers_new', label: 'المتابعون الجدد', in: 'column' },
    { key: 'page_views', label: 'مشاهدات الصفحة', in: 'column' },
    { key: 'unique_visitors', label: 'زوار فريدون', in: 'column' },
    { key: 'engagements', label: 'التفاعلات', in: 'column' },
  ],
  x: [
    { key: 'followers_total', label: 'عدد المتابعين الكلي', in: 'column' },
    { key: 'followers_new', label: 'المتابعون الجدد', in: 'column' },
    { key: 'impressions', label: 'مرات العرض', in: 'column' },
    { key: 'engagements', label: 'التفاعلات', in: 'column' },
    { key: 'profile_visits', label: 'زيارات الملف الشخصي', in: 'extra' },
    { key: 'likes', label: 'الإعجابات', in: 'extra' },
    { key: 'replies', label: 'الردود', in: 'extra' },
    { key: 'reposts', label: 'إعادة النشر', in: 'extra' },
    { key: 'shares', label: 'المشاركات', in: 'extra' },
    { key: 'bookmarks', label: 'الإشارات المرجعية', in: 'extra' },
  ],
  instagram: [
    { key: 'followers_total', label: 'عدد المتابعين الكلي', in: 'column' },
    { key: 'followers_new', label: 'المتابعون الجدد', in: 'column' },
    { key: 'impressions', label: 'مرات العرض', in: 'column' },
    { key: 'engagements', label: 'التفاعلات', in: 'column' },
  ],
  youtube: [
    { key: 'followers_total', label: 'المشتركون', in: 'column' },
    { key: 'followers_new', label: 'مشتركون جدد', in: 'column' },
    { key: 'impressions', label: 'مرات العرض', in: 'column' },
  ],
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export function SocialMetricsAdmin({ rows }: { rows: SocialEditorRow[] }) {
  return (
    <section
      className="rounded-xl border p-5 space-y-6"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div>
        <h2 className="text-[16px] font-semibold">شبكات التواصل (إدخال يدوي)</h2>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--muted)' }}>
          هذه الأرقام تظهر في بطاقة «الوصول عبر الشبكات» في لوحة البيانات.
          أدخل لقطة جديدة كل أسبوع — اللقطة الأحدث هي ما يظهر في اللوحة.
        </p>
      </div>

      {rows.map(({ channel, latest }) => (
        <ChannelEditor key={channel} channel={channel} latest={latest} />
      ))}
    </section>
  );
}

function ChannelEditor({
  channel,
  latest,
}: {
  channel: SocialChannelKey;
  latest: SocialEditorRow['latest'];
}) {
  const fields = CHANNEL_FIELDS[channel];
  const [date, setDate] = useState<string>(latest?.snapshot_date ?? todayISO());
  // Single map keyed by field.key — easier to bind inputs against than
  // splitting columns vs extras at the state level.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      const v =
        f.in === 'column'
          ? (latest?.[f.key as keyof typeof latest] as number | null | undefined)
          : ((latest?.extra?.[f.key] as number | undefined) ?? null);
      init[f.key] = v != null ? String(v) : '';
    }
    return init;
  });
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(latest?.updated_at ?? null);
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    setError(null);
    const payload = {
      channel,
      snapshot_date: date,
      followers_total: values.followers_total ?? null,
      followers_new: values.followers_new ?? null,
      impressions: values.impressions ?? null,
      page_views: values.page_views ?? null,
      unique_visitors: values.unique_visitors ?? null,
      engagements: values.engagements ?? null,
      extra: Object.fromEntries(
        fields.filter((f) => f.in === 'extra').map((f) => [f.key, values[f.key] ?? '']),
      ),
    };
    startTransition(async () => {
      try {
        await saveSocialSnapshot(payload);
        setSavedAt(new Date().toISOString());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل الحفظ');
      }
    });
  };

  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: 'var(--rule-soft)', background: 'var(--option-bg)' }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-[14px] font-semibold">{SOCIAL_LABELS[channel]}</div>
        <label className="text-[12.5px] flex items-center gap-2">
          <span style={{ color: 'var(--muted)' }}>تاريخ اللقطة</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            dir="ltr"
            className="rounded border px-2 py-1 text-[12.5px]"
            style={{ borderColor: 'var(--rule)', background: 'var(--bg)' }}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.map((f) => (
          <label key={f.key} className="text-[12.5px] block">
            <div className="mb-1" style={{ color: 'var(--muted)' }}>{f.label}</div>
            <input
              type="text"
              inputMode="numeric"
              value={values[f.key] ?? ''}
              onChange={(e) =>
                setValues((s) => ({ ...s, [f.key]: e.target.value }))
              }
              dir="ltr"
              placeholder="—"
              className="w-full rounded border px-3 py-2 text-[14px] num"
              style={{ borderColor: 'var(--rule)', background: 'var(--bg)' }}
            />
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
          {savedAt
            ? `آخر تحديث: ${new Date(savedAt).toLocaleString('ar-EG')}`
            : 'لم يُحفظ بعد'}
          {error && (
            <span className="ms-3" style={{ color: 'var(--danger)' }}>
              {error}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-60"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
          }}
        >
          {pending ? 'جارٍ الحفظ…' : 'حفظ اللقطة'}
        </button>
      </div>
    </div>
  );
}
