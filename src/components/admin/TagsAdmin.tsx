'use client';

import { useState, useTransition } from 'react';
import type { TagGroupRow, TagRow } from '@/types/database';
import { upsertTag, deleteTag, upsertTagGroup, deleteTagGroup } from '@/lib/admin-actions';
import { Tag } from './Tag';
import { DialogShell, DialogActions, DialogField, DialogInput, DialogSelect } from './DialogPrimitives';

type Props = {
  tags: TagRow[];
  groups: TagGroupRow[];
};

export function TagsAdmin({ tags, groups }: Props) {
  const [editingTag, setEditingTag] = useState<Partial<TagRow> | null>(null);
  const [editingGroup, setEditingGroup] = useState<Partial<TagGroupRow> | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nextTagPosition = (groupKey: string) => {
    const same = tags.filter((t) => t.kind === groupKey);
    return (same.at(-1)?.position ?? 0) + 10;
  };

  const groupLabel = (key: string) =>
    groups.find((g) => g.key === key)?.label_ar ?? key;

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold">إدارة التصنيفات</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--muted)' }}>
            المجموعة هي بُعد التصنيف (عام، وقت تطوع، خبرة…)، وداخل كل مجموعة تضيف الوسوم.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditingGroup({ key: '', label_ar: '', label_en: '', position: (groups.at(-1)?.position ?? 0) + 10, is_active: true })}
            className="text-[13px] px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--rule)' }}
          >
            + مجموعة
          </button>
          <button
            onClick={() => setEditingTag({ key: '', label_ar: '', label_en: '', kind: groups[0]?.key ?? 'general', color: '#1B4332', position: nextTagPosition(groups[0]?.key ?? 'general'), is_active: true })}
            className="text-[13px] px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--rule)' }}
          >
            + تصنيف
          </button>
        </div>
      </div>

      {/* --- groups list --- */}
      <div className="mb-4">
        <div className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
          المجموعات
        </div>
        <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
          {groups.map((g) => (
            <li key={g.key} className="py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-[13.5px] font-medium">{g.label_ar}</span>
                <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                  {g.label_en} · <span className="font-mono">{g.key}</span>
                  {tags.some((t) => t.kind === g.key) && ` · ${tags.filter((t) => t.kind === g.key).length} وسم`}
                  {!g.is_active && ' · معطّلة'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditingGroup(g)} className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]">تعديل</button>
                <button
                  onClick={() => {
                    if (!confirm(`حذف المجموعة "${g.label_ar}"؟ لا يمكن الحذف ما دامت توجد وسوم داخلها.`)) return;
                    setError(null);
                    startTransition(async () => {
                      try { await deleteTagGroup(g.key); } catch (e: any) {
                        setError(translateError(e?.message));
                      }
                    });
                  }}
                  className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]"
                  style={{ color: 'var(--danger)' }}
                >
                  حذف
                </button>
              </div>
            </li>
          ))}
          {groups.length === 0 && (
            <li className="py-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>لا مجموعات بعد.</li>
          )}
        </ul>
      </div>

      {/* --- tags list, grouped --- */}
      {groups.map((g) => (
        <div key={g.key} className="mb-4 last:mb-0">
          <div className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
            {g.label_ar}
          </div>
          <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
            {tags.filter((t) => t.kind === g.key).map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Tag color={t.color}>{t.label_ar}</Tag>
                  <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                    {t.label_en} · <span className="font-mono">{t.key}</span>
                    {!t.is_active && ' · معطّل'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditingTag(t)} className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]">تعديل</button>
                  <button
                    onClick={() => {
                      if (!confirm(`حذف التصنيف "${t.label_ar}"؟ سيُزال من كل الطلبات المصنّفة به.`)) return;
                      setError(null);
                      startTransition(async () => {
                        try { await deleteTag(t.id); } catch (e: any) {
                          setError(translateError(e?.message));
                        }
                      });
                    }}
                    className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]"
                    style={{ color: 'var(--danger)' }}
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
            {tags.filter((t) => t.kind === g.key).length === 0 && (
              <li className="py-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>لا تصنيفات في هذه المجموعة بعد.</li>
            )}
          </ul>
        </div>
      ))}

      {error && <div className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {editingTag && (
        <TagEditDialog
          initial={editingTag}
          groups={groups}
          onCancel={() => setEditingTag(null)}
          onSave={(data) => {
            setError(null);
            startTransition(async () => {
              try { await upsertTag(data); setEditingTag(null); } catch (e: any) { setError(translateError(e?.message)); }
            });
          }}
          pending={pending}
        />
      )}

      {editingGroup && (
        <GroupEditDialog
          initial={editingGroup}
          onCancel={() => setEditingGroup(null)}
          onSave={(data) => {
            setError(null);
            startTransition(async () => {
              try { await upsertTagGroup(data); setEditingGroup(null); } catch (e: any) { setError(translateError(e?.message)); }
            });
          }}
          pending={pending}
        />
      )}
    </section>
  );
}

function translateError(code: string | undefined): string {
  switch (code) {
    case 'tag_key_exists': return 'هذا المفتاح مستخدم لتصنيف آخر — اختر مفتاحاً مختلفاً.';
    case 'group_key_exists': return 'هذا المفتاح مستخدم لمجموعة أخرى — اختر مفتاحاً مختلفاً.';
    case 'group_in_use': return 'لا يمكن حذف مجموعة تحتوي وسوماً — انقل أو احذف وسومها أولاً.';
    case 'unknown_group': return 'المجموعة المختارة غير موجودة — حدّث الصفحة وأعد المحاولة.';
    case 'invalid_tag_key': return 'المفتاح يجب أن يكون أحرفاً إنجليزية صغيرة وأرقاماً وشرطات سفلية (2-40 حرفاً).';
    case 'label_ar_required': return 'الاسم بالعربية مطلوب.';
    case 'label_en_required': return 'الاسم بالإنجليزية مطلوب.';
    case 'invalid_color': return 'اللون غير صالح.';
    default: return code ?? 'فشل الحفظ';
  }
}

function TagEditDialog({
  initial,
  groups,
  onCancel,
  onSave,
  pending,
}: {
  initial: Partial<TagRow>;
  groups: TagGroupRow[];
  onCancel: () => void;
  onSave: (data: {
    id?: string;
    key: string;
    label_ar: string;
    label_en: string;
    kind: string;
    color: string;
    position: number;
    is_active: boolean;
  }) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    id: initial.id,
    key: initial.key ?? '',
    label_ar: initial.label_ar ?? '',
    label_en: initial.label_en ?? '',
    kind: initial.kind ?? groups[0]?.key ?? 'general',
    color: initial.color ?? '#1B4332',
    position: initial.position ?? 0,
    is_active: initial.is_active ?? true,
  });
  return (
    <DialogShell onClose={onCancel}>
      <h3 className="text-[16px] font-semibold mb-4">{form.id ? 'تعديل تصنيف' : 'تصنيف جديد'}</h3>
      <div className="space-y-3 text-[13px]">
        <DialogField label="المفتاح (key) — أحرف إنجليزية صغيرة وأرقام و_">
          <DialogInput value={form.key} onChange={(v) => setForm({ ...form, key: v })} dir="ltr" />
        </DialogField>
        <DialogField label="الاسم بالعربية"><DialogInput value={form.label_ar} onChange={(v) => setForm({ ...form, label_ar: v })} /></DialogField>
        <DialogField label="الاسم بالإنجليزية"><DialogInput value={form.label_en} onChange={(v) => setForm({ ...form, label_en: v })} dir="ltr" /></DialogField>
        <DialogField label="المجموعة">
          <DialogSelect
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v, position: 0 })}
            options={groups.map((g) => ({ value: g.key, label: g.label_ar }))}
          />
        </DialogField>
        <DialogField label="اللون"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 rounded-lg" /></DialogField>
        <DialogField label="الترتيب"><DialogInput value={String(form.position)} onChange={(v) => setForm({ ...form, position: Number(v) || 0 })} dir="ltr" /></DialogField>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          مفعّل (يظهر في الفلاتر وقائمة التصنيف)
        </label>
      </div>
      <DialogActions onCancel={onCancel} onSave={() => onSave(form)} pending={pending} />
    </DialogShell>
  );
}

function GroupEditDialog({
  initial,
  onCancel,
  onSave,
  pending,
}: {
  initial: Partial<TagGroupRow>;
  onCancel: () => void;
  onSave: (data: {
    key: string;
    label_ar: string;
    label_en: string;
    position: number;
    is_active: boolean;
  }) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    key: initial.key ?? '',
    label_ar: initial.label_ar ?? '',
    label_en: initial.label_en ?? '',
    position: initial.position ?? 0,
    is_active: initial.is_active ?? true,
  });
  return (
    <DialogShell onClose={onCancel}>
      <h3 className="text-[16px] font-semibold mb-4">{initial.key ? 'تعديل مجموعة' : 'مجموعة جديدة'}</h3>
      <div className="space-y-3 text-[13px]">
        <DialogField label="المفتاح (key) — أحرف إنجليزية صغيرة وأرقام و_">
          <DialogInput value={form.key} onChange={(v) => setForm({ ...form, key: v })} dir="ltr" />
        </DialogField>
        <DialogField label="الاسم بالعربية"><DialogInput value={form.label_ar} onChange={(v) => setForm({ ...form, label_ar: v })} /></DialogField>
        <DialogField label="الاسم بالإنجليزية"><DialogInput value={form.label_en} onChange={(v) => setForm({ ...form, label_en: v })} dir="ltr" /></DialogField>
        <DialogField label="الترتيب"><DialogInput value={String(form.position)} onChange={(v) => setForm({ ...form, position: Number(v) || 0 })} dir="ltr" /></DialogField>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          مفعّلة (تظهر في الفلاتر والقوائم)
        </label>
      </div>
      <DialogActions onCancel={onCancel} onSave={() => onSave(form)} pending={pending} />
    </DialogShell>
  );
}
