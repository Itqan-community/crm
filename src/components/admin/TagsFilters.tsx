'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { TagGroupRow, TagRow } from '@/types/database';

type Props = {
  tags: TagRow[];
  groups: TagGroupRow[];
};

// URL-param driven filters for /admin/tags. Tag selection is OR semantics:
// a person matches when carrying ANY selected tag — matches how
// loadSubmissions interprets the `tags` param.
export function TagsFilters({ tags, groups }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selected = new Set((sp.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean));

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push('/admin/tags?' + next.toString()));
  };

  const toggleTag = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update('tags', [...next].join(','));
  };

  const activeTags = tags.filter((t) => t.is_active);
  const chipGroups = groups
    .map((g) => ({ label: g.label_ar, items: activeTags.filter((t) => t.kind === g.key) }))
    .filter((g) => g.items.length > 0);
  const knownKinds = new Set(groups.map((g) => g.key));
  const orphanTags = activeTags.filter((t) => !knownKinds.has(t.kind));
  if (orphanTags.length > 0) {
    chipGroups.push({ label: 'أخرى', items: orphanTags });
  }

  const exportQuery = sp.toString();

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="بحث: اسم، بريد، رقم مرجعي…"
          defaultValue={sp.get('q') ?? ''}
          onChange={(e) => update('q', e.target.value)}
          className="px-3 py-2 rounded-lg border text-[13.5px] w-72 outline-none bg-transparent"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
        />
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
        <div className="ms-auto flex items-center gap-2">
          <a
            href={`/admin/tags/export?format=csv${exportQuery ? '&' + exportQuery : ''}`}
            className="px-3 py-2 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          >
            تصدير CSV
          </a>
          <a
            href={`/admin/tags/export?format=xlsx${exportQuery ? '&' + exportQuery : ''}`}
            className="px-3 py-2 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          >
            تصدير Excel
          </a>
          <a
            href={`/admin/tags/print${exportQuery ? '?' + exportQuery : ''}`}
            className="px-3 py-2 rounded-lg border text-[13px] hover:bg-[var(--option-bg-selected)] transition"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          >
            تصدير PDF
          </a>
        </div>
      </div>

      {chipGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {chipGroups.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1.5">
              <span
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                {group.label}:
              </span>
              {group.items.map((t) => {
                const isOn = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    aria-pressed={isOn}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium border transition"
                    style={{
                      color: t.color,
                      borderColor: isOn ? t.color : t.color + '40',
                      background: isOn ? t.color + '14' : 'transparent',
                    }}
                  >
                    {t.label_ar}
                  </button>
                );
              })}
            </div>
          ))}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => update('tags', '')}
              className="text-[12px] underline"
              style={{ color: 'var(--muted)' }}
            >
              مسح التحديد
            </button>
          )}
        </div>
      )}
      {pending && <span className="text-[12px]" style={{ color: 'var(--muted)' }}>…</span>}
    </div>
  );
}
