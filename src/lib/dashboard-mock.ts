import type { DashboardData } from '@/components/admin/dashboard/types';

// Verbatim port of the design handoff's `DATA` object
// (untitled/project/shared.jsx). Realistic mock for FE review;
// swap with live queries (MailerLite / Itqan stats / Supabase) later.
// Week range: 27 Apr – 3 May 2026 vs 20 – 26 Apr 2026.
export const DASHBOARD_DATA: DashboardData = {
  range: { label: '27 أبريل – 3 مايو 2026', compare: 'مقارنة بـ 20 – 26 أبريل' },

  community: {
    newsletter: {
      value: 4628,
      delta: 8.4,
      rate: 42.7,
      prevRate: 39.4,
      opened: 1976,
      sent: 4628,
    },
    engagement: {
      value: 3214,
      delta: 12.6,
      breakdown: [
        { k: 'ردود ومناقشات', v: 1284, c: 'var(--accent)' },
        { k: 'إعجابات', v: 982, c: 'var(--gold)' },
        { k: 'إشارات وذكر', v: 524, c: 'var(--info)' },
        { k: 'مشاركات', v: 424, c: 'var(--warn)' },
      ],
    },
    socialReach: {
      value: 128400,
      delta: -3.2,
      channels: [
        { k: 'X (تويتر)', v: 58200, d: 4.2 },
        { k: 'إنستقرام', v: 31800, d: -8.6 },
        { k: 'لينكدإن', v: 22400, d: 12.0 },
        { k: 'يوتيوب', v: 16000, d: -2.1 },
      ],
    },
    siteVisits: { value: 18742, delta: 5.7, uniq: 12480, returning: 6262 },
  },

  platform: {
    publishers: { value: 142, delta: 4.1, new: 6 },
    beneficiaries: { value: 9384, delta: 9.8, new: 421 },
    consumption: {
      value: 47210,
      delta: 14.2,
      mix: [
        { k: 'قراءة', v: 21430, c: 'var(--accent)' },
        { k: 'تحميل', v: 12840, c: 'var(--gold)' },
        { k: 'استماع', v: 8420, c: 'var(--info)' },
        { k: 'مشاركة', v: 4520, c: 'var(--warn)' },
      ],
    },
    shares: { value: 1862, delta: 6.3 },
  },

  series: {
    newsletter: { now: [612, 540, 648, 712, 824, 690, 602], prev: [580, 520, 610, 690, 790, 650, 580] },
    engagement: { now: [380, 420, 468, 512, 468, 520, 446], prev: [340, 360, 420, 460, 440, 470, 395] },
    socialReach: {
      now: [21000, 18400, 17600, 16800, 18200, 17800, 18600],
      prev: [22400, 19200, 18000, 17200, 18600, 18400, 19000],
    },
    siteVisits: {
      now: [2420, 2680, 2840, 3120, 2960, 2480, 2242],
      prev: [2280, 2540, 2680, 2940, 2810, 2360, 2110],
    },
    publishers: { now: [136, 137, 138, 139, 140, 141, 142], prev: [130, 131, 132, 133, 134, 135, 136] },
    beneficiaries: {
      now: [8650, 8780, 8920, 9080, 9180, 9280, 9384],
      prev: [7980, 8080, 8160, 8260, 8360, 8460, 8546],
    },
    consumption: {
      now: [5840, 6420, 6810, 7240, 7180, 6980, 6740],
      prev: [5120, 5640, 5980, 6360, 6280, 6120, 5910],
    },
    shares: { now: [220, 248, 276, 302, 288, 272, 256], prev: [200, 224, 248, 272, 260, 248, 232] },
  },

  days: ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'],
};
