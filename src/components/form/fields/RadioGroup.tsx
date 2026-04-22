'use client';

import type { FormFieldRow, Lang } from '@/types/database';
import { pick } from '@/lib/i18n';
import { OptionRow, ARABIC_LETTERS, LATIN_LETTERS } from './OptionRow';
import { ErrorNote } from './ErrorNote';

type Props = {
  field: FormFieldRow;
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string | null;
  lang: Lang;
};

export function RadioGroup({ field, value, onChange, error, lang }: Props) {
  const letters = lang === 'en' ? LATIN_LETTERS : ARABIC_LETTERS;
  return (
    <div className="w-full space-y-2.5">
      {field.options.map((opt, i) => {
        const txt = pick(opt, lang);
        const key = opt.ar || opt.en;
        return (
          <OptionRow
            key={key}
            label={txt}
            letter={letters[i] || String(i + 1)}
            selected={value === key}
            kind="radio"
            lang={lang}
            onClick={() => onChange(key)}
          />
        );
      })}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
