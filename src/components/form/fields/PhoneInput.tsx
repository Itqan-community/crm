'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormFieldRow, Lang } from '@/types/database';
import { pick } from '@/lib/i18n';
import { normalizePhoneInput } from '@/lib/validation';
import { IconPhone } from '../icons';
import { ErrorNote } from './ErrorNote';

type Props = {
  field: FormFieldRow;
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  lang: Lang;
};

export function PhoneInput({ field, value, onChange, error, autoFocus, lang }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const borderColor = error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--rule)';

  return (
    <div className="w-full">
      <div className="flex items-center border-b-2 transition-colors" style={{ borderColor }}>
        <span className="shrink-0 pe-3" style={{ color: 'var(--muted)' }}>
          <IconPhone size={22} />
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value || ''}
          placeholder={pick({ ar: field.placeholder_ar ?? '', en: field.placeholder_en ?? '' }, lang) || '+966 55 882 2428'}
          onChange={(e) => onChange(normalizePhoneInput(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          dir="ltr"
          className="w-full bg-transparent outline-none text-[clamp(20px,2.4vw,26px)] font-medium pb-3 tracking-wide"
          style={{ color: 'var(--fg)', caretColor: 'var(--accent)', textAlign: 'left' }}
        />
      </div>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
