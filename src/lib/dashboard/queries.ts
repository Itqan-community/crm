// Server-side queries for the admin editing surfaces. Two flavors:
//   - loadSocialEditorRows: latest manual snapshot per social channel
//     (drives /admin/settings/metrics SocialMetricsAdmin form).
//   - loadCurrentWeekForEdit: every metric × every day of the current
//     calendar week, ready to drop into the MetricsTable at the bottom
//     of /admin.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  type SocialChannelKey,
  type SocialSnapshot,
  DISPLAYED_CHANNELS,
} from './types';
import { ALL_METRIC_KEYS, type MetricKey } from './daily';

export type SocialEditorRow = {
  channel: SocialChannelKey;
  latest: SocialSnapshot | null;
};

export async function loadSocialEditorRows(): Promise<SocialEditorRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('dashboard_social_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false });
  // Treat a failed query as a real error rather than "no rows" — an
  // empty editor that an admin can save would silently overwrite valid
  // data they meant to edit.
  if (error) throw new Error(`loadSocialEditorRows failed: ${error.message}`);
  const byChannel = new Map<SocialChannelKey, SocialSnapshot>();
  for (const row of (data ?? []) as SocialSnapshot[]) {
    if (!byChannel.has(row.channel)) byChannel.set(row.channel, row);
  }
  return DISPLAYED_CHANNELS.map((channel) => ({
    channel,
    latest: byChannel.get(channel) ?? null,
  }));
}

// ---- MetricsTable (bottom-of-dashboard editor) -----------------------------

type MetaFieldDef = { key: string; label: string };

export type MetricDef = {
  metricKey: MetricKey;
  label: string;
  description: string;
  valueLabel: string;
  metaFields: MetaFieldDef[];
};

export type WeekDayCell = {
  day: string; // YYYY-MM-DD
  weekdayLabel: string; // أحد..سبت
  isFuture: boolean;
  value: number;
  meta: Record<string, number>;
  // True when the row was last written by the manual-edit path —
  // signals to the UI that this value is pinned and won't be
  // overwritten by future cron/backfill runs.
  isManual: boolean;
  // True when there's a row in dashboard_metric_daily for this
  // (day, metric_key). False means no source has produced a value
  // yet — UI renders the input empty (with a placeholder) so admins
  // can distinguish "captured zero" from "no data captured".
  hasRow: boolean;
};

export type EditableMetric = MetricDef & { rows: WeekDayCell[] };

// What each metric represents in plain Arabic — drives the table
// labels and the descriptions the user reads when reviewing numbers.
// Order matches the dashboard's reading order: community first, then
// platform.
export const METRIC_DEFINITIONS: MetricDef[] = [
  {
    metricKey: 'engagement',
    label: 'تفاعل المجتمع',
    description:
      'الأحداث اليومية في المنتدى. القيمة الأساسية = مواضيع + ردود + إعجابات. ' +
      'المستخدمون الفاعلون والجدد يُعرضان للمتابعة (لا يُجمعان في الإجمالي).',
    valueLabel: 'المجموع',
    metaFields: [
      { key: 'discussions',  label: 'مواضيع جديدة' },
      { key: 'replies',      label: 'ردود' },
      { key: 'likes',        label: 'إعجابات' },
      { key: 'active_users', label: 'مستخدمون فاعلون' },
      { key: 'new_users',    label: 'مستخدمون جدد' },
    ],
  },
  {
    metricKey: 'newsletter',
    label: 'النشرة البريدية',
    description: 'بيانات آخر حملة بريدية أُرسلت في اليوم (من MailerLite).',
    valueLabel: 'عدد المُرسَلين',
    metaFields: [
      { key: 'rate',     label: 'معدل الفتح (٪)' },
      { key: 'opened',   label: 'عدد من فتحوا' },
      { key: 'prevRate', label: 'متوسط فتح آخر 7 أيام (٪)' },
    ],
  },
  {
    metricKey: 'social_reach',
    label: 'الوصول عبر الشبكات',
    description: 'إجمالي مرات العرض/المشاهدة عبر LinkedIn + Facebook + X (يُحتسب من جدول لقطات الشبكات).',
    valueLabel: 'الإجمالي',
    metaFields: [],
  },
  {
    metricKey: 'site_visits',
    label: 'زيارات الموقع',
    description: 'مشاهدات الصفحات من Google Analytics لـ itqan.dev.',
    valueLabel: 'المشاهدات',
    metaFields: [
      { key: 'uniq',      label: 'زوار فريدون' },
      { key: 'returning', label: 'زوار عائدون' },
    ],
  },
  {
    metricKey: 'publishers',
    label: 'الناشرون',
    description: 'العدد التراكمي للناشرين على المنصة كما بنهاية اليوم (CMS — publishers_publisher).',
    valueLabel: 'العدد الكلي',
    metaFields: [],
  },
  {
    metricKey: 'beneficiaries',
    label: 'المستفيدون',
    description: 'العدد التراكمي للمستخدمين على المنصة كما بنهاية اليوم (CMS — users_user).',
    valueLabel: 'العدد الكلي',
    metaFields: [],
  },
  {
    metricKey: 'consumption',
    label: 'استهلاك المواد',
    description: 'العدد التراكمي للأصول المنشورة كما بنهاية اليوم (CMS — content_asset). يُستخدم بديلاً عن مقاييس Mixpanel.',
    valueLabel: 'العدد الكلي',
    metaFields: [],
  },
  {
    metricKey: 'shares',
    label: 'مشاركات المجتمع',
    description: 'إجمالي الإعجابات في المنتدى كما بنهاية اليوم (Flarum — post_likes).',
    valueLabel: 'الإجمالي',
    metaFields: [],
  },
];

// Sunday-first weekday labels, matching the chart and the metrics
// table column order. days[0]=أحد lands on the right edge in RTL.
const DAY_LABELS = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

// Returns the PREVIOUS calendar week (Sun..Sat, the seven days
// before this week's Sunday) with every metric's stored value + meta
// for each day. We edit last week — not this week — because the
// past week is fully observed: every day actually happened, so the
// reviewer can fill numbers for all seven cells. This also keeps
// the dashboard's dashed comparison line (which represents the
// previous calendar week) in sync with whatever the admin enters.
// Missing rows default to 0/{} so the table always has a complete
// grid to render.
export async function loadLastWeekForEdit(): Promise<EditableMetric[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  // Sunday of THIS week, then back up one full week.
  const thisSunday = new Date(today);
  thisSunday.setDate(today.getDate() - dow);
  const lastSunday = new Date(thisSunday);
  lastSunday.setDate(thisSunday.getDate() - 7);

  // Build the 7-day Sun→Sat range — all in the past, so no cells
  // need to be disabled.
  const days: Array<{ date: string; label: string; isFuture: boolean }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lastSunday);
    d.setDate(lastSunday.getDate() + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: DAY_LABELS[i],
      isFuture: false,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('dashboard_metric_daily')
    .select('day, metric_key, value, meta, is_manual')
    .gte('day', days[0].date)
    .lte('day', days[6].date);
  // Don't render a zero-filled editor on query failure — the admin
  // could click save and clobber real history.
  if (error) throw new Error(`loadLastWeekForEdit failed: ${error.message}`);

  // Index by "day|metric_key" for O(1) lookups when filling cells.
  const byKey = new Map<
    string,
    { value: number; meta: Record<string, number>; isManual: boolean }
  >();
  for (const row of data ?? []) {
    byKey.set(`${row.day}|${row.metric_key}`, {
      value: Number(row.value),
      meta: (row.meta as Record<string, number>) ?? {},
      isManual: !!row.is_manual,
    });
  }

  return METRIC_DEFINITIONS.filter((def) => ALL_METRIC_KEYS.includes(def.metricKey)).map((def) => ({
    ...def,
    rows: days.map((d) => {
      const stored = byKey.get(`${d.date}|${def.metricKey}`);
      return {
        day: d.date,
        weekdayLabel: d.label,
        isFuture: d.isFuture,
        value: stored?.value ?? 0,
        meta: stored?.meta ?? {},
        isManual: stored?.isManual ?? false,
        hasRow: !!stored,
      };
    }),
  }));
}
