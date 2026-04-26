import type { ReactNode } from 'react';

export function ErrorNote({ id, children }: { id?: string; children: ReactNode }) {
  if (!children) return null;
  return (
    // role="alert" lets screen readers announce the error the moment it
    // appears, even though we already wired aria-describedby on the input.
    // The id lets the input link itself via aria-describedby={`${field.id}-err`}.
    <div
      id={id}
      role="alert"
      className="mt-3 text-[14px] font-medium"
      style={{ color: 'var(--danger)' }}
    >
      {children}
    </div>
  );
}
