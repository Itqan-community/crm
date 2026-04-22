import type { ReactNode } from 'react';

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="mt-3 text-[13.5px]" style={{ color: 'var(--danger)' }}>
      {children}
    </div>
  );
}
