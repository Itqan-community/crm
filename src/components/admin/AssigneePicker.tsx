'use client';

import { useState, useTransition } from 'react';
import type { TeamMemberRow } from '@/types/database';
import { setSubmissionAssignee } from '@/lib/admin-actions';

type Props = {
  submissionId: string;
  currentAssigneeId: string | null;
  team: TeamMemberRow[];
};

export function AssigneePicker({ submissionId, currentAssigneeId, team }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = team.find((t) => t.id === currentAssigneeId);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="px-3 py-1.5 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition disabled:opacity-60"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
      >
        {current ? (current.full_name || current.email) : <span style={{ color: 'var(--muted)' }}>تعيين مسؤول</span>}
        <span className="ms-2" style={{ color: 'var(--muted)' }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute z-30 mt-2 min-w-[220px] rounded-xl border p-1 shadow-lg"
          style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
        >
          <button
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
              onClick={() => {
                setOpen(false);
                startTransition(() => setSubmissionAssignee(submissionId, t.id));
              }}
              className="w-full text-start px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--option-bg-selected)] transition"
            >
              <div className="font-medium">{t.full_name || t.email}</div>
              {t.full_name && (
                <div className="text-[11.5px]" style={{ color: 'var(--muted)' }} dir="ltr">{t.email}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
