'use client';

import type { FormCategoryRow, Lang } from '@/types/database';
import { pick, UI } from '@/lib/i18n';
import { categoryIcon } from './icons';

type Props = {
  category: FormCategoryRow;
  onChange: () => void;
  lang: Lang;
};

export function CategoryChip({ category, onChange, lang }: Props) {
  const CatIcon = categoryIcon(category.icon);
  return (
    <div className="mb-8 flex items-center gap-2.5 flex-wrap">
      <span
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[13px] font-medium"
        style={{ borderColor: 'var(--rule)', background: 'var(--option-bg-selected)', color: 'var(--accent-strong)' }}
      >
        <CatIcon size={14} stroke={1.8} />
        <span>{pick({ ar: category.label_ar, en: category.label_en }, lang)}</span>
      </span>
      <button
        onClick={onChange}
        className="text-[12.5px] underline-offset-4 hover:underline transition"
        style={{ color: 'var(--muted)' }}
      >
        {pick(UI.changeCategory, lang)}
      </button>
    </div>
  );
}
