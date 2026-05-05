import type { SubmissionSource } from '@/types/database';
import { getChannel } from '@/lib/source-channels';

type Variant = 'full' | 'compact';

type Props = {
  source: SubmissionSource;
  variant?: Variant;
  // Optional override (e.g., the kanban card uses 'ar' since the rest of the UI is Arabic).
  lang?: 'ar' | 'en';
};

// Renders the channel for a submission. `compact` is the icon-only pill used
// on Kanban cards; `full` is the icon + label pill used in the table and on
// the detail page.
export function SourceBadge({ source, variant = 'full', lang = 'ar' }: Props) {
  const ch = getChannel(source.channel);
  const label = lang === 'en' ? ch.label_en : ch.label_ar;
  const tooltip = source.referral ? `${label} · ${source.referral}` : label;

  if (variant === 'compact') {
    return (
      <span
        title={tooltip}
        aria-label={tooltip}
        className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] border"
        style={{
          color: ch.color,
          borderColor: ch.color + '40',
          background: ch.color + '14',
        }}
      >
        <span aria-hidden="true">{ch.icon}</span>
      </span>
    );
  }

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium border"
      style={{
        color: ch.color,
        borderColor: ch.color + '40',
        background: ch.color + '14',
      }}
    >
      <span aria-hidden="true" className="text-[11px]">{ch.icon}</span>
      <span>{label}</span>
    </span>
  );
}
