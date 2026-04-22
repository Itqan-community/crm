'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { TeamMemberRow } from '@/types/database';
import { setSubmissionAssignee } from '@/lib/admin-actions';
import { ChevronDown } from '@/components/form/icons';

type Props = {
  submissionId: string;
  currentAssigneeId: string | null;
  team: TeamMemberRow[];
};

export function AssigneePicker({ submissionId, currentAssigneeId, team }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const current = team.find((t) => t.id === currentAssigneeId);

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
            <Avatar name={current.full_name || current.email} />
            <span>{current.full_name || current.email}</span>
          </>
        ) : (
          <span style={{ color: 'var(--muted)' }}>تعيين مسؤول</span>
        )}
        <ChevronDown size={14} className="opacity-60" />
      </button>
      {open && (
        <div
          className="absolute z-30 mt-2 min-w-[240px] rounded-xl border p-1 shadow-lg"
          style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              startTransition(() => setSubmissionAssignee(submissionId, null));
            }}
            className="w-full text-start px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--option-bg-selected)] transition"
            style={{ color: 'var(--muted)' }}
          >
            بلا مسؤول
          </button>
          {team.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setOpen(false);
                startTransition(() => setSubmissionAssignee(submissionId, t.id));
              }}
              className="w-full text-start px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--option-bg-selected)] transition flex items-center gap-2.5"
            >
              <Avatar name={t.full_name || t.email} />
              <div className="min-w-0">
                <div className="font-medium truncate">{t.full_name || t.email}</div>
                {t.full_name && (
                  <div className="text-[11.5px] truncate" style={{ color: 'var(--muted)' }} dir="ltr">{t.email}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
      style={{ background: 'var(--option-bg-selected)', color: 'var(--accent-strong)' }}
    >
      {initials}
    </span>
  );
}
