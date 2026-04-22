'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { FormCategoryRow } from '@/types/database';
import { upsertCategory, deleteCategory } from '@/lib/admin-actions';
import { DialogShell, DialogActions, DialogField, DialogInput } from '../DialogPrimitives';

const ICONS = [
  { value: 'book', label: 'كتاب' },
  { value: 'app', label: 'تطبيق' },
  { value: 'code', label: 'كود' },
  { value: 'briefcase', label: 'حقيبة' },
  { value: 'message', label: 'رسالة' },
];

export function CategoriesAdmin({
  categories,
  counts,
}: {
  categories: FormCategoryRow[];
  counts: Record<string, { active: number; total: number }>;
}) {
  const [editing, setEditing] = useState<Partial<FormCategoryRow> | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold">الفئات</h2>
        <button
          onClick={() => setEditing({ key: '', label_ar: '', label_en: '', hint_ar: '', hint_en: '', icon: 'message', position: (categories.at(-1)?.position ?? 0) + 10, is_active: true })}
          className="text-[13px] px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--rule)' }}
        >
          + إضافة فئة
        </button>
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
        {categories.map((c) => {
          const stat = counts[c.id] ?? { active: 0, total: 0 };
          return (
            <li key={c.id} className="py-3 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-[14px]">{c.label_ar}</div>
                <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                  {c.label_en} · <span className="font-mono">{c.key}</span>
                  {' · '} {stat.active} / {stat.total} حقول نشطة
                  {!c.is_active && ' · معطّلة'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/admin/settings/form-builder/${c.id}`} className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]">إدارة الحقول</Link>
                <button onClick={() => setEditing(c)} className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]">تعديل</button>
                <button
                  onClick={() => {
                    if (!confirm(`حذف الفئة "${c.label_ar}"؟`)) return;
                    setError(null);
                    startTransition(async () => {
                      try { await deleteCategory(c.id); } catch (e: any) {
                        setError(e?.message === 'category_in_use' ? 'لا يمكن حذف فئة تحوي طلبات. عطّلها بدلاً من ذلك.' : (e?.message ?? 'فشل الحذف'));
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
          );
        })}
      </ul>
      {error && <div className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {editing && (
        <CategoryEditDialog
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            setError(null);
            startTransition(async () => {
              try { await upsertCategory(data); setEditing(null); } catch (e: any) { setError(e?.message ?? 'فشل الحفظ'); }
            });
          }}
          pending={pending}
        />
      )}
    </section>
  );
}

function CategoryEditDialog({
  initial, onCancel, onSave, pending,
}: {
  initial: Partial<FormCategoryRow>;
  onCancel: () => void;
  onSave: (data: any) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    id: initial.id,
    key: initial.key ?? '',
    label_ar: initial.label_ar ?? '',
    label_en: initial.label_en ?? '',
    hint_ar: initial.hint_ar ?? '',
    hint_en: initial.hint_en ?? '',
    icon: initial.icon ?? 'message',
    position: initial.position ?? 0,
    is_active: initial.is_active ?? true,
  });
  return (
    <DialogShell onClose={onCancel}>
      <h3 className="text-[16px] font-semibold mb-4">{form.id ? 'تعديل فئة' : 'فئة جديدة'}</h3>
      <div className="space-y-3 text-[13px]">
        <DialogField label="المفتاح (key)"><DialogInput value={form.key} onChange={(v) => setForm({ ...form, key: v })} dir="ltr" /></DialogField>
        <DialogField label="الاسم بالعربية"><DialogInput value={form.label_ar} onChange={(v) => setForm({ ...form, label_ar: v })} /></DialogField>
        <DialogField label="الاسم بالإنجليزية"><DialogInput value={form.label_en} onChange={(v) => setForm({ ...form, label_en: v })} dir="ltr" /></DialogField>
        <DialogField label="وصف مختصر بالعربية"><DialogInput value={form.hint_ar} onChange={(v) => setForm({ ...form, hint_ar: v })} /></DialogField>
        <DialogField label="وصف مختصر بالإنجليزية"><DialogInput value={form.hint_en} onChange={(v) => setForm({ ...form, hint_en: v })} dir="ltr" /></DialogField>
        <DialogField label="الأيقونة">
          <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]" style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}>
            {ICONS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </DialogField>
        <DialogField label="الترتيب"><DialogInput value={String(form.position)} onChange={(v) => setForm({ ...form, position: Number(v) || 0 })} dir="ltr" /></DialogField>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> ظاهرة في النموذج</label>
      </div>
      <DialogActions onCancel={onCancel} onSave={() => onSave(form)} pending={pending} />
    </DialogShell>
  );
}
