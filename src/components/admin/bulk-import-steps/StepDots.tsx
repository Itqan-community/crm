'use client';

export type WizardStep = 'upload' | 'map' | 'preview' | 'done';

const ORDER: WizardStep[] = ['upload', 'map', 'preview', 'done'];

// Simple progress indicator for the wizard header.
export function StepDots({ step }: { step: WizardStep }) {
  const idx = ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {ORDER.map((s, i) => (
        <span
          key={s}
          className="w-2 h-2 rounded-full"
          style={{ background: i <= idx ? 'var(--accent)' : 'var(--rule)' }}
        />
      ))}
    </div>
  );
}
