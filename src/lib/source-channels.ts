import type { SourceChannelKey } from '@/types/database';

export type SourceChannel = {
  key: SourceChannelKey;
  label_ar: string;
  label_en: string;
  // Single-glyph icon used in compact contexts (Kanban card badge).
  icon: string;
  // Color used for the badge tint.
  color: string;
};

// Hardcoded seed for the FE-only phase. Will move to an admin-editable table
// when the backend phase lands.
export const SOURCE_CHANNELS: SourceChannel[] = [
  { key: 'form',     label_ar: 'النموذج العام',  label_en: 'Public form',  icon: '🌐', color: '#2563EB' },
  { key: 'phone',    label_ar: 'مكالمة هاتفية',  label_en: 'Phone call',   icon: '📞', color: '#059669' },
  { key: 'whatsapp', label_ar: 'واتساب / DM',    label_en: 'WhatsApp / DM', icon: '💬', color: '#16A34A' },
  { key: 'email',    label_ar: 'بريد إلكتروني',  label_en: 'Email',        icon: '✉️', color: '#7C3AED' },
  { key: 'event',    label_ar: 'فعالية حضورية',  label_en: 'Event',        icon: '🎪', color: '#D97706' },
  { key: 'referral', label_ar: 'إحالة / شراكة',  label_en: 'Referral',     icon: '🤝', color: '#DB2777' },
  { key: 'other',    label_ar: 'أخرى',           label_en: 'Other',        icon: '•',  color: '#6B6B68' },
];

const BY_KEY: Record<SourceChannelKey, SourceChannel> = SOURCE_CHANNELS.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<SourceChannelKey, SourceChannel>,
);

export function getChannel(key: SourceChannelKey): SourceChannel {
  return BY_KEY[key] ?? BY_KEY.other;
}
