'use client';

import type { Lang } from '@/types/database';
import { Globe } from './icons';

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <button
      onClick={() => onChange(lang === 'ar' ? 'en' : 'ar')}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] font-medium transition"
      style={{ borderColor: 'var(--rule)', color: 'var(--fg)', background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
      aria-label="Toggle language"
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Globe size={15} />
      <span style={{ fontFeatureSettings: '"tnum"' }}>{lang === 'ar' ? 'EN' : 'العربية'}</span>
    </button>
  );
}
