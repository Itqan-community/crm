'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { FormCategoryRow, StatusRow, TeamMemberRow } from '@/types/database';

type Props = {
  categories: FormCategoryRow[];
  statuses: StatusRow[];
  team: TeamMemberRow[];
};

export function FilterBar({ categories, statuses, team }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push('/admin?' + next.toString()));
  };

  const exportHref = '/admin/export?' + sp.toString();

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <input
        type="search"
        placeholder="بحث: اسم، بريد، رقم مرجعي…"
        defaultValue={sp.get('q') ?? ''}
        onChange={(e) => update('q', e.target.value)}
        className="px-3 py-2 rounded-lg border text-[13.5px] w-72 outline-none bg-transparent"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
      />
      <Select label="الفئة" value={sp.get('category') ?? ''} onChange={(v) => update('category', v)}
              options={[{ value: '', label: 'كل الفئات' }, ...categories.map((c) => ({ value: c.id, label: c.label_ar }))]} />
      <Select label="الحالة" value={sp.get('status') ?? ''} onChange={(v) => update('status', v)}
              options={[{ value: '', label: 'كل الحالات' }, ...statuses.map((s) => ({ value: s.id, label: s.label_ar }))]} />
      <Select label="المسؤول" value={sp.get('assignee') ?? ''} onChange={(v) => update('assignee', v)}
              options={[
                { value: '', label: 'الجميع' },
                { value: 'unassigned', label: 'بدون مسؤول' },
                ...team.map((t) => ({ value: t.id, label: t.full_name || t.email })),
              ]} />
      <a
        href={exportHref}
        className="ms-auto px-3 py-2 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
      >
        تصدير CSV
      </a>
      {pending && <span className="text-[12px]" style={{ color: 'var(--muted)' }}>…</span>}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg border text-[13.5px] outline-none bg-transparent"
      style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
