'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export type AdminView = 'table' | 'kanban';

export function ViewToggle({ current }: { current: AdminView }) {
  const router = useRouter();
  const sp = useSearchParams();

  const change = (view: AdminView) => {
    const next = new URLSearchParams(sp.toString());
    if (view === 'table') next.delete('view');
    else next.set('view', view);
    router.push('/admin' + (next.toString() ? '?' + next.toString() : ''));
  };

  return (
    <div
      className="inline-flex rounded-lg border p-0.5"
      style={{ borderColor: 'var(--rule)' }}
      role="tablist"
      aria-label="طريقة العرض"
    >
      <ViewButton active={current === 'table'} onClick={() => change('table')} label="جدول">
        <TableIcon />
      </ViewButton>
      <ViewButton active={current === 'kanban'} onClick={() => change('kanban')} label="بطاقات">
        <KanbanIcon />
      </ViewButton>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition"
      style={{
        background: active ? 'var(--option-bg-selected)' : 'transparent',
        color: active ? 'var(--accent-strong)' : 'var(--muted)',
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M3 16h18" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="13" rx="1.5" />
    </svg>
  );
}
