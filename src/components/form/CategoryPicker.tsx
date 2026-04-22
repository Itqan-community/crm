'use client';

import type { FormCategoryRow, Lang } from '@/types/database';
import { pick, UI } from '@/lib/i18n';
import { categoryIcon, ArrowRight, ArrowLeft } from './icons';

type Props = {
  categories: FormCategoryRow[];
  onPick: (id: string) => void;
  lang: Lang;
};

export function CategoryPicker({ categories, onPick, lang }: Props) {
  const textAlign = lang === 'en' ? 'text-left' : 'text-right';
  const Forward = lang === 'en' ? ArrowRight : ArrowLeft;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-10">
        <div className="text-[12.5px] tracking-[0.2em] mb-4 uppercase" style={{ color: 'var(--accent-strong)' }}>
          {pick(UI.eyebrow, lang)}
        </div>
        <h1 className="text-[clamp(28px,4vw,44px)] font-semibold leading-[1.25]" style={{ color: 'var(--fg)' }}>
          {pick(UI.heroTitle, lang)}
        </h1>
        <p className="mt-4 text-[clamp(15px,1.6vw,17px)] leading-[1.9] max-w-[56ch]" style={{ color: 'var(--muted)' }}>
          {pick(UI.heroBody, lang)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {categories.map((c) => {
          const CatIcon = categoryIcon(c.icon);
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={'group ' + textAlign + ' p-5 rounded-xl border-2 transition-all h-full flex flex-col'}
              style={{
                background: 'var(--option-bg)',
                borderColor: 'var(--option-border)',
                color: 'var(--fg)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--option-bg-selected)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--option-border)';
                e.currentTarget.style.background = 'var(--option-bg)';
              }}
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 border transition-colors"
                style={{
                  color: 'var(--accent-strong)',
                  borderColor: 'var(--rule-soft)',
                  background: 'var(--option-bg-selected)',
                }}
              >
                <CatIcon size={22} stroke={1.6} />
              </div>
              <div className="text-[16px] md:text-[17px] font-semibold leading-snug mb-2" style={{ color: 'var(--fg)' }}>
                {pick({ ar: c.label_ar, en: c.label_en }, lang)}
              </div>
              <div className="text-[12.5px] leading-[1.75] flex-1" style={{ color: 'var(--muted)' }}>
                {pick({ ar: c.hint_ar ?? '', en: c.hint_en ?? '' }, lang)}
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--accent-strong)' }}>
                {pick(UI.startCta, lang)}
                <Forward size={14} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
