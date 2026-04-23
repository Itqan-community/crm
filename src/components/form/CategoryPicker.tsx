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

  // Split body into paragraphs on blank lines so the Arabic 3-paragraph
  // copy renders as separate <p> blocks while English (single string)
  // still works without changes.
  const bodyParagraphs = pick(UI.heroBody, lang).split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6 md:mb-10">
        <h1
          className="text-[clamp(22px,4vw,44px)] leading-[1.25] fade-up"
          style={{ color: 'var(--fg)', fontWeight: 800, animationDelay: '0ms' }}
        >
          {pick(UI.heroTitle, lang)}
        </h1>
        <div className="mt-3 md:mt-4 max-w-[56ch] space-y-3 md:space-y-4">
          {bodyParagraphs.map((para, i) => (
            <p
              key={i}
              className="text-[clamp(13px,1.6vw,17px)] leading-[1.75] md:leading-[1.9] fade-up"
              style={{
                color: 'var(--muted)',
                animationDelay: `${80 + i * 80}ms`,
                textAlign: 'justify',
                textJustify: 'inter-word',
              }}
            >
              {para}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {categories.map((c, i) => {
          const CatIcon = categoryIcon(c.icon);
          // Cards start once the last hero paragraph has finished fading in,
          // then stagger across themselves.
          const cardBase = 80 + bodyParagraphs.length * 80 + 40;
          const delay = cardBase + i * 70;
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={'group fade-up ' + textAlign + ' p-5 rounded-xl border-2 transition-all h-full flex flex-col'}
              style={{
                background: 'var(--option-bg)',
                borderColor: 'var(--option-border)',
                color: 'var(--fg)',
                animationDelay: `${delay}ms`,
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
