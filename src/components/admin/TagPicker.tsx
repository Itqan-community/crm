'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { TagGroupRow, TagRow } from '@/types/database';
import { setSubmissionTags } from '@/lib/admin-actions';
import { ChevronDown } from '@/components/form/icons';
import { Tag } from './Tag';

type Props = {
  submissionId: string;
  currentTagIds: string[];
  tags: TagRow[];
  groups: TagGroupRow[];
};

// Multi-select chips dropdown grouped by tag group (dynamic axes like
// "تصنيفات عامة" / "أوقات التطوع" / anything the admins add). Selection
// state is derived from the server-rendered props (like StatusEditor) —
// each toggle fires one diff action and the revalidate brings back the
// fresh set, so there is no local state to drift out of sync.
export function TagPicker({ submissionId, currentTagIds, tags, groups }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const selected = new Set(currentTagIds);

  const orderedGroups = groups.map((g) => ({
    label: g.label_ar,
    tags: tags.filter((t) => t.kind === g.key),
  }));
  const knownKinds = new Set(groups.map((g) => g.key));
  const orphans = tags.filter((t) => !knownKinds.has(t.kind));
  if (orphans.length > 0) {
    orderedGroups.push({ label: 'أخرى', tags: orphans });
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = (tagId: string) => {
    const next = new Set(selected);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    startTransition(() => setSubmissionTags(submissionId, [...next]));
  };

  const selectedTags = tags.filter((t) => selected.has(t.id));

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="min-h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition disabled:opacity-60"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
      >
        {selectedTags.length > 0 ? (
          selectedTags.slice(0, 3).map((t) => (
            <Tag key={t.id} color={t.color}>{t.label_ar}</Tag>
          ))
        ) : (
          <span style={{ color: 'var(--muted)' }}>تصنيفات</span>
        )}
        {selectedTags.length > 3 && (
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
            +{selectedTags.length - 3}
          </span>
        )}
        <ChevronDown size={14} className="opacity-60" />
      </button>
      {open && (
        <div
          className="absolute z-30 mt-2 min-w-[240px] max-h-[320px] overflow-y-auto rounded-xl border p-2 shadow-lg"
          style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
        >
          {orderedGroups.map((group) => (
            <div key={group.label} className="mb-1">
              <div
                className="px-2 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                {group.label}
              </div>
              {group.tags.map((t) => {
                const isOn = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-pressed={isOn}
                    className="w-full text-start px-2 py-1.5 rounded-lg text-[13px] hover:bg-[var(--option-bg-selected)] transition flex items-center justify-between gap-2"
                  >
                    <Tag color={t.color}>{t.label_ar}</Tag>
                    <span
                      aria-hidden="true"
                      className="text-[12px] w-4 text-center"
                      style={{ color: isOn ? 'var(--accent-strong)' : 'transparent' }}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {tags.length === 0 && (
            <div className="px-2 py-3 text-[12.5px]" style={{ color: 'var(--muted)' }}>
              لا توجد تصنيفات بعد — أضفها من صفحة التصنيفات.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
