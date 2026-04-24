import type { FormFieldRow, Lang } from '@/types/database';
import { pick, UI } from '@/lib/i18n';

// `compact` shrinks the heading and spacing — used when several fields
// share one step so stacked labels don't feel like competing hero titles.
export function Label({
  field,
  lang,
  compact = false,
}: {
  field: FormFieldRow;
  lang: Lang;
  compact?: boolean;
}) {
  const label = pick({ ar: field.label_ar, en: field.label_en }, lang);
  const help =
    field.help_ar || field.help_en
      ? pick({ ar: field.help_ar ?? '', en: field.help_en ?? '' }, lang)
      : '';
  const headingClass = compact
    ? 'text-[clamp(17px,2.2vw,22px)] font-semibold leading-[1.35]'
    : 'text-[clamp(22px,3.2vw,32px)] font-semibold leading-[1.35]';
  const helpClass = compact
    ? 'mt-1 text-[13px] leading-[1.7]'
    : 'mt-2 text-[14.5px] leading-[1.85]';
  return (
    <div className={compact ? 'mb-3' : 'mb-5'}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className={headingClass} style={{ color: 'var(--fg)' }}>
          {label}
        </h2>
        {field.is_required && (
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
            · {pick(UI.requiredBadge, lang)}
          </span>
        )}
      </div>
      {help && (
        <p className={helpClass} style={{ color: 'var(--muted)' }}>
          {help}
        </p>
      )}
    </div>
  );
}
