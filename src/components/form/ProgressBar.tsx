// `lang` controls the screen-reader label so an Arabic user hears "تقدّم
// النموذج" while an English user hears "Form progress"; the percentage
// itself is announced via aria-valuenow regardless of locale.
export function ProgressBar({ value, lang = 'ar' }: { value: number; lang?: 'ar' | 'en' }) {
  // Floor the *visual* width at 2% so the bar is never invisible — but
  // announce the *true* progress to assistive tech. Reporting "2%" before
  // the user has done anything would be misleading.
  const visualPct = Math.max(2, Math.min(100, value));
  const ariaPct = Math.max(0, Math.min(100, value));
  const label = lang === 'en' ? 'Form progress' : 'تقدّم النموذج';
  return (
    <div
      role="progressbar"
      aria-valuenow={ariaPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="w-full h-[3px]"
      style={{ background: 'var(--rule-soft)' }}
    >
      <div
        className="h-full transition-[width] duration-500"
        style={{ width: `${visualPct}%`, background: 'var(--accent)' }}
      />
    </div>
  );
}
