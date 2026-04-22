'use client';

import { useState, useTransition } from 'react';
import type { StatusRow } from '@/types/database';
import { setSubmissionStatus } from '@/lib/admin-actions';
import { StatusBadge } from './StatusBadge';

type Props = {
  submissionId: string;
  currentStatusId: string;
  statuses: StatusRow[];
};

export function StatusEditor({ submissionId, currentStatusId, statuses }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = statuses.find((s) => s.id === currentStatusId);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition disabled:opacity-60"
        style={{ borderColor: 'var(--rule)' }}
      >
        {current ? <StatusBadge label={current.label_ar} color={current.color} /> : '—'}
        <span style={{ color: 'var(--muted)' }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute z-30 mt-2 min-w-[200px] rounded-xl border p-1 shadow-lg"
          style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
        >
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setOpen(false);
                startTransition(() => setSubmissionStatus(submissionId, s.id));
              }}
              className="w-full text-start px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--option-bg-selected)] transition"
            >
              <StatusBadge label={s.label_ar} color={s.color} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
