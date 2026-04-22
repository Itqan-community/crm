'use client';

import type { Lang } from '@/types/database';
import { pick, UI, thanksBody } from '@/lib/i18n';
import { Check } from './icons';

type Props = {
  refNo: string;
  onReset: () => void;
  lang: Lang;
};

export function ThankYou({ refNo, onReset, lang }: Props) {
  const textAlign = lang === 'en' ? 'text-left' : 'text-right';
  const days = pick(UI.threeDays, lang);
  const [pre, dur, post] = thanksBody(days, lang);
  return (
    <div className={'w-full max-w-2xl mx-auto ' + textAlign + ' slide-in-ltr'}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
      >
        <Check size={26} />
      </div>
      <h2 className="text-[clamp(26px,3.4vw,36px)] font-semibold leading-[1.3]" style={{ color: 'var(--fg)' }}>
        {pick(UI.thanksTitle, lang)}
      </h2>
      <p className="mt-4 text-[clamp(15px,1.6vw,17px)] leading-[1.95] max-w-[52ch]" style={{ color: 'var(--muted)' }}>
        {pre}
        <strong style={{ color: 'var(--fg)' }}>{dur}</strong>
        {post}
      </p>

      <div className="mt-8 rounded-xl p-5 border" style={{ borderColor: 'var(--rule)', background: 'var(--option-bg)' }}>
        <div className="text-[12px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>
          {pick(UI.refLabel, lang)}
        </div>
        <div className="text-[20px] font-semibold font-mono" style={{ color: 'var(--accent-strong)' }}>
          {refNo}
        </div>
      </div>

      <div className="mt-6 rounded-xl p-5 border" style={{ borderColor: 'var(--rule)', background: 'var(--option-bg)' }}>
        <div className="text-[12px] tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>
          {pick(UI.supportQ, lang)}
        </div>
        <a href="mailto:connect@itqan.dev" className="text-[17px] font-medium" style={{ color: 'var(--accent-strong)' }}>
          connect@itqan.dev
        </a>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border-2 text-[14.5px] font-medium transition"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
        >
          {pick(UI.sendAnother, lang)}
        </button>
        <a href="https://itqan.dev" className="text-[14px]" style={{ color: 'var(--muted)' }}>
          {pick(UI.backToSite, lang)}
        </a>
      </div>
    </div>
  );
}
