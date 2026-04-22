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
  type?: string;
};

export function TextInput({ field, value, onChange, error, autoFocus, lang, type = 'text' }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div className="w-full">
      <input
        ref={ref}
        type={type}
        value={value || ''}
        placeholder={pick({ ar: field.placeholder_ar ?? '', en: field.placeholder_en ?? '' }, lang)}
        onChange={(e) => onChange(e.target.value)}
        dir={lang === 'en' ? 'ltr' : 'rtl'}
        className="w-full bg-transparent outline-none text-[clamp(20px,2.4vw,26px)] font-medium pb-3 border-b-2 transition-colors"
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
