'use client';

import { useEffect, useRef } from 'react';
import type { FormFieldRow, Lang } from '@/types/database';
import { pick } from '@/lib/i18n';
import { ErrorNote } from './ErrorNote';

type Props = {
  field: FormFieldRow;
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  lang: Lang;
};

export function TextArea({ field, value, onChange, error, autoFocus, lang }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div className="w-full">
      <textarea
        ref={ref}
        rows={5}
        value={value || ''}
        placeholder={pick({ ar: field.placeholder_ar ?? '', en: field.placeholder_en ?? '' }, lang)}
        onChange={(e) => onChange(e.target.value)}
        dir={lang === 'en' ? 'ltr' : 'rtl'}
        className="w-full bg-transparent outline-none text-[clamp(17px,2vw,20px)] leading-[1.85] pb-3 border-b-2 resize-none transition-colors"
        style={{
          color: 'var(--fg)',
          borderColor: error ? 'var(--danger)' : 'var(--rule)',
          caretColor: 'var(--accent)',
        }}
        onFocus={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--rule)')}
      />
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
