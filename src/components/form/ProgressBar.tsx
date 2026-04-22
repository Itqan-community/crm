export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(2, Math.min(100, value));
  return (
    <div className="w-full h-[3px]" style={{ background: 'var(--rule-soft)' }}>
      <div
        className="h-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: 'var(--accent)' }}
      />
    </div>
  );
}
