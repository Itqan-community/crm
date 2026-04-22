'use client';

import type { FormFieldRow, Lang } from '@/types/database';
import { pick } from '@/lib/i18n';
import { OptionRow, ARABIC_LETTERS, LATIN_LETTERS } from './OptionRow';
import { ErrorNote } from './ErrorNote';

type Props = {
  field: FormFieldRow;
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  error?: string | null;
  lang: Lang;
};

export function CheckboxGroup({ field, value, onChange, error, lang }: Props) {
  const arr = Array.isArray(value) ? value : [];
  const letters = lang === 'en' ? LATIN_LETTERS : ARABIC_LETTERS;
  const toggle = (k: string) => {
    if (!field.is_multi) {
      onChange(arr.includes(k) ? [] : [k]);
      return;
    }
    onChange(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  };
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
            selected={arr.includes(key)}
            kind="check"
            lang={lang}
            onClick={() => toggle(key)}
          />
        );
      })}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
