import type { FormFieldRow, Lang } from '@/types/database';
import { pick, UI } from '@/lib/i18n';

export function Label({ field, lang }: { field: FormFieldRow; lang: Lang }) {
  const label = pick({ ar: field.label_ar, en: field.label_en }, lang);
  const help = field.help_ar || field.help_en
    ? pick({ ar: field.help_ar ?? '', en: field.help_en ?? '' }, lang)
    : '';
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="text-[clamp(22px,3.2vw,32px)] font-semibold leading-[1.35]" style={{ color: 'var(--fg)' }}>
          {label}
        </h2>
        {field.is_required && (
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
            · {pick(UI.requiredBadge, lang)}
          </span>
        )}
      </div>
      {help && (
        <p className="mt-2 text-[14.5px] leading-[1.85]" style={{ color: 'var(--muted)' }}>
          {help}
        </p>
      )}
    </div>
  );
}
