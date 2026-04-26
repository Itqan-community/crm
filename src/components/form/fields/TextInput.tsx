'use client';

import { useEffect, useRef } from 'react';
import type { FormFieldRow, Lang, SemanticRole } from '@/types/database';
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

// Map semantic role + input type to the right autocomplete token. iOS and
// Android use these to surface "AutoFill from Contacts", saved emails,
// etc. — without them the user has to retype everything by hand. We map
// only roles where a sensible token exists; everything else is left
// undefined so the browser doesn't show the wrong suggestion.
function autoCompleteFor(role: SemanticRole | null, type: string): string | undefined {
  if (role === 'name')     return 'name';
  if (role === 'email')    return 'email';
  if (role === 'location') return 'address-level2';
  if (type === 'email')    return 'email';
  if (type === 'url')      return 'url';
  return undefined;
}

// inputMode hints to mobile keyboards which layout to surface on focus
// (e.g. an @-symbol-friendly keyboard for emails). type=email/url already
// pull this in by default, but explicit hints don't hurt and keep us
// consistent across browsers.
function inputModeFor(type: string): React.HTMLAttributes<HTMLInputElement>['inputMode'] {
  if (type === 'email') return 'email';
  if (type === 'url')   return 'url';
  return undefined;
}

export function TextInput({ field, value, onChange, error, autoFocus, lang, type = 'text' }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const errorId = error ? `${field.id}-err` : undefined;

  return (
    <div className="w-full">
      <input
        ref={ref}
        type={type}
        value={value || ''}
        placeholder={pick({ ar: field.placeholder_ar ?? '', en: field.placeholder_en ?? '' }, lang)}
        onChange={(e) => onChange(e.target.value)}
        dir={lang === 'en' ? 'ltr' : 'rtl'}
        autoComplete={autoCompleteFor(field.semantic_role, type)}
        inputMode={inputModeFor(type)}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className="w-full bg-transparent outline-none text-[clamp(20px,2.4vw,26px)] font-medium pb-3 border-b-2 transition-colors"
        style={{
          color: 'var(--fg)',
          borderColor: error ? 'var(--danger)' : 'var(--rule)',
          caretColor: 'var(--accent)',
        }}
        onFocus={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--rule)')}
      />
      <ErrorNote id={errorId}>{error}</ErrorNote>
    </div>
  );
}
