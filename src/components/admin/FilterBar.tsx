'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { FormCategoryRow, StatusRow, TagGroupRow, TagRow, TeamMemberRow } from '@/types/database';
import { SOURCE_CHANNELS } from '@/lib/source-channels';

type Props = {
  categories: FormCategoryRow[];
  statuses: StatusRow[];
  team: TeamMemberRow[];
  tags?: TagRow[];
  groups?: TagGroupRow[];
};

export function FilterBar({ categories, statuses, team, tags = [], groups = [] }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Push to the list page's real path — /admin itself redirects to
    // /admin/submissions and the redirect drops the query string, which
    // would silently reset every filter on each change.
    startTransition(() => router.push('/admin/submissions?' + next.toString()));
  };

  const exportHref = '/admin/export?' + sp.toString();
  const tagGroups = groups.map((g) => ({
    label: g.label_ar,
    options: tags.filter((t) => t.kind === g.key).map((t) => ({ value: t.id, label: t.label_ar })),
  })).filter((g) => g.options.length > 0);
  const knownKinds = new Set(groups.map((g) => g.key));
  const orphanTags = tags.filter((t) => !knownKinds.has(t.kind));
  if (orphanTags.length > 0) {
    tagGroups.push({
      label: 'أخرى',
      options: orphanTags.map((t) => ({ value: t.id, label: t.label_ar })),
    });
  }

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
      <Select label="التصنيف" value={sp.get('tags') ?? ''} onChange={(v) => update('tags', v)}
              placeholder={{ value: '', label: 'كل التصنيفات' }}
              groups={tagGroups} />
      <Select label="المسؤول" value={sp.get('assignee') ?? ''} onChange={(v) => update('assignee', v)}
              options={[
                { value: '', label: 'الجميع' },
                { value: 'unassigned', label: 'بدون مسؤول' },
                ...team.map((t) => ({ value: t.id, label: t.full_name || t.email })),
              ]} />
      <Select label="المصدر" value={sp.get('source') ?? ''} onChange={(v) => update('source', v)}
              options={[
                { value: '', label: 'كل المصادر' },
                ...SOURCE_CHANNELS.map((c) => ({ value: c.key, label: `${c.icon}  ${c.label_ar}` })),
              ]} />
      <label
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-[13.5px] cursor-pointer select-none"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
      >
        <input
          type="checkbox"
          checked={sp.get('include_archived') === '1'}
          onChange={(e) => update('include_archived', e.target.checked ? '1' : '')}
        />
        إظهار المؤرشفة
      </label>
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
  label,
  value,
  onChange,
  options,
  groups,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
  groups?: { label: string; options: { value: string; label: string }[] }[];
  placeholder?: { value: string; label: string };
}) {
  // The visible filter label is part of the surrounding chrome, not a
  // <label htmlFor=…> — wire it via aria-label so screen readers still
  // announce what the control filters by.
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="px-3 py-2 rounded-lg border text-[13.5px] outline-none bg-transparent"
      style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
    >
      {placeholder && <option value={placeholder.value}>{placeholder.label}</option>}
      {options?.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      {groups?.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
