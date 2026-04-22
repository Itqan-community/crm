'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { StatusRow } from '@/types/database';
import { setSubmissionStatus } from '@/lib/admin-actions';
import { ChevronDown } from '@/components/form/icons';

type Props = {
  submissionId: string;
  currentStatusId: string;
  statuses: StatusRow[];
};

export function StatusEditor({ submissionId, currentStatusId, statuses }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const current = statuses.find((s) => s.id === currentStatusId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="h-9 inline-flex items-center gap-2 px-3 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition disabled:opacity-60"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
      >
        {current ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: current.color }} />
            <span>{current.label_ar}</span>
          </>
        ) : (
          <span>—</span>
        )}
        <ChevronDown size={14} className="opacity-60" />
      </button>
      {open && (
        <div
          className="absolute z-30 mt-2 min-w-[200px] rounded-xl border p-1 shadow-lg"
          style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
        >
          {statuses.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setOpen(false);
                startTransition(() => setSubmissionStatus(submissionId, s.id));
              }}
              className="w-full text-start px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--option-bg-selected)] transition flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span>{s.label_ar}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
