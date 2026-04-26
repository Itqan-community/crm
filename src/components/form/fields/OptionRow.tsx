'use client';

import type { Lang } from '@/types/database';

type Props = {
  label: string;
  letter: string;
  selected: boolean;
  onClick: () => void;
  kind: 'radio' | 'check';
  lang: Lang;
};

export function OptionRow({ label, letter, selected, onClick, kind, lang }: Props) {
  const textAlign = lang === 'en' ? 'text-left' : 'text-right';
  return (
    <button
      type="button"
      onClick={onClick}
      // option-row picks up the CSS-only hover/active feedback in
      // globals.css. The previous JS handlers swapped border colour but
      // never fired on touch — taps got no acknowledgement.
      data-selected={selected || undefined}
      className={'option-row group w-full ' + textAlign + ' px-5 py-4 rounded-xl border-2 transition-all flex items-center gap-4'}
      style={{
        background: selected ? 'var(--option-bg-selected)' : 'var(--option-bg)',
        borderColor: selected ? 'var(--accent)' : 'var(--option-border)',
        color: 'var(--fg)',
      }}
    >
      <span
        className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-[13px] font-medium border transition-colors"
        style={{
          background: selected ? 'var(--accent)' : 'transparent',
          color: selected ? 'var(--accent-fg)' : 'var(--muted)',
          borderColor: selected ? 'var(--accent)' : 'var(--rule)',
        }}
      >
        {kind === 'check' && selected ? '✓' : letter}
      </span>
      <span className="text-[15.5px] md:text-[16.5px] leading-[1.6] flex-1">{label}</span>
    </button>
  );
}

export const ARABIC_LETTERS = ['أ','ب','ج','د','هـ','و','ز','ح','ط','ي','ك','ل','م','ن','س','ع','ف','ص','ق','ر','ش','ت','ث','خ','ذ'];
export const LATIN_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
