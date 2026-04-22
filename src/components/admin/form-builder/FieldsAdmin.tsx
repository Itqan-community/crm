'use client';

import { useState, useTransition } from 'react';
import type { FormFieldRow, Bilingual } from '@/types/database';
import { upsertField, deleteField } from '@/lib/admin-actions';
import { DialogActions, DialogField, DialogInput } from '../DialogPrimitives';

const KINDS: { value: FormFieldRow['kind']; label: string }[] = [
  { value: 'text', label: 'نص قصير' },
  { value: 'email', label: 'بريد إلكتروني' },
  { value: 'phone', label: 'رقم هاتف' },
  { value: 'url', label: 'رابط' },
  { value: 'textarea', label: 'نص طويل' },
  { value: 'radio', label: 'اختيار واحد (Radio)' },
  { value: 'checkbox', label: 'اختيار متعدد (Checkbox)' },
];

const ROLES: { value: string; label: string }[] = [
  { value: '', label: 'لا شيء' },
  { value: 'name', label: 'الاسم' },
  { value: 'email', label: 'البريد' },
  { value: 'phone', label: 'الهاتف' },
  { value: 'location', label: 'الموقع' },
  { value: 'newsletter', label: 'النشرة' },
];

export function FieldsAdmin({ categoryId, fields }: { categoryId: string; fields: FormFieldRow[] }) {
  const [editing, setEditing] = useState<Partial<FormFieldRow> | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold">الحقول</h2>
        <button
          onClick={() => setEditing({
            category_id: categoryId,
            key: '',
            kind: 'text',
            label_ar: '',
            label_en: '',
            help_ar: '',
            help_en: '',
            placeholder_ar: '',
            placeholder_en: '',
            is_required: false,
            is_multi: true,
            options: [],
            semantic_role: null,
            position: (fields.at(-1)?.position ?? 0) + 10,
            is_active: true,
          })}
          className="text-[13px] px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--rule)' }}
        >
          + إضافة حقل
        </button>
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
        {fields.map((f) => (
          <li key={f.id} className="py-3 flex items-center justify-between gap-2">
            <div>
              <div className="font-medium text-[14px]">{f.label_ar}</div>
              <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                <span className="font-mono">{f.key}</span> · {KINDS.find((k) => k.value === f.kind)?.label}
                {f.is_required && ' · مطلوب'}
                {!f.is_active && ' · معطّل'}
                {f.semantic_role && ` · دور: ${f.semantic_role}`}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditing(f)} className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]">تعديل</button>
              <button
                onClick={() => {
                  if (!confirm(`حذف الحقل "${f.label_ar}"؟ (إن استُخدم في طلبات سابقة سيُعطّل بدلاً من حذفه)`)) return;
                  setError(null);
                  startTransition(async () => {
                    try { await deleteField(f.id, categoryId); } catch (e: any) { setError(e?.message ?? 'فشل الحذف'); }
                  });
                }}
                className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]"
                style={{ color: 'var(--danger)' }}
              >
                حذف/تعطيل
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <div className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {editing && (
        <FieldEditDialog
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            setError(null);
            startTransition(async () => {
              try { await upsertField({ ...data, category_id: categoryId }); setEditing(null); } catch (e: any) { setError(e?.message ?? 'فشل الحفظ'); }
            });
          }}
          pending={pending}
        />
      )}
    </section>
  );
}

function FieldEditDialog({ initial, onCancel, onSave, pending }: {
  initial: Partial<FormFieldRow>;
  onCancel: () => void;
  onSave: (data: any) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    id: initial.id,
    key: initial.key ?? '',
    kind: initial.kind ?? 'text',
    label_ar: initial.label_ar ?? '',
    label_en: initial.label_en ?? '',
    help_ar: initial.help_ar ?? '',
    help_en: initial.help_en ?? '',
    placeholder_ar: initial.placeholder_ar ?? '',
    placeholder_en: initial.placeholder_en ?? '',
    is_required: initial.is_required ?? false,
    is_multi: initial.is_multi ?? true,
    options: (initial.options ?? []) as Bilingual[],
    semantic_role: (initial.semantic_role ?? null) as string | null,
    position: initial.position ?? 0,
    is_active: initial.is_active ?? true,
  });

  const isOptionKind = form.kind === 'radio' || form.kind === 'checkbox';

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4 overflow-y-auto" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl p-5 border my-8" style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}>
        <h3 className="text-[16px] font-semibold mb-4">{form.id ? 'تعديل حقل' : 'حقل جديد'}</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
          <DialogField label="المفتاح (key)"><DialogInput value={form.key} onChange={(v) => setForm({ ...form, key: v })} dir="ltr" /></DialogField>
          <DialogField label="النوع">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FormFieldRow['kind'] })}
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]"
              style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </DialogField>
          <DialogField label="الاسم بالعربية"><DialogInput value={form.label_ar} onChange={(v) => setForm({ ...form, label_ar: v })} /></DialogField>
          <DialogField label="الاسم بالإنجليزية"><DialogInput value={form.label_en} onChange={(v) => setForm({ ...form, label_en: v })} dir="ltr" /></DialogField>
          <DialogField label="نص مساعد (ع)"><DialogInput value={form.help_ar} onChange={(v) => setForm({ ...form, help_ar: v })} /></DialogField>
          <DialogField label="نص مساعد (en)"><DialogInput value={form.help_en} onChange={(v) => setForm({ ...form, help_en: v })} dir="ltr" /></DialogField>
          <DialogField label="placeholder (ع)"><DialogInput value={form.placeholder_ar} onChange={(v) => setForm({ ...form, placeholder_ar: v })} /></DialogField>
          <DialogField label="placeholder (en)"><DialogInput value={form.placeholder_en} onChange={(v) => setForm({ ...form, placeholder_en: v })} dir="ltr" /></DialogField>
          <DialogField label="الترتيب"><DialogInput value={String(form.position)} onChange={(v) => setForm({ ...form, position: Number(v) || 0 })} dir="ltr" /></DialogField>
          <DialogField label="دور الحقل (semantic_role)">
            <select value={form.semantic_role ?? ''} onChange={(e) => setForm({ ...form, semantic_role: (e.target.value || null) as typeof form.semantic_role })}
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]"
              style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </DialogField>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px]">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} /> مطلوب</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> ظاهر في النموذج</label>
          {form.kind === 'checkbox' && (
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_multi} onChange={(e) => setForm({ ...form, is_multi: e.target.checked })} /> اختيار متعدد</label>
          )}
        </div>

        {isOptionKind && (
          <div className="mt-4">
            <div className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>الخيارات (عربي / إنجليزي):</div>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <DialogInput value={opt.ar} onChange={(v) => {
                    const next = form.options.slice(); next[i] = { ...next[i], ar: v }; setForm({ ...form, options: next });
                  }} />
                  <DialogInput value={opt.en} onChange={(v) => {
                    const next = form.options.slice(); next[i] = { ...next[i], en: v }; setForm({ ...form, options: next });
                  }} dir="ltr" />
                  <button type="button" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })} className="text-[13px] px-2" style={{ color: 'var(--danger)' }}>حذف</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, options: [...form.options, { ar: '', en: '' }] })}
                className="text-[13px] px-3 py-1 rounded border" style={{ borderColor: 'var(--rule)' }}
              >+ إضافة خيار</button>
            </div>
          </div>
        )}

        <DialogActions onCancel={onCancel} onSave={() => onSave(form)} pending={pending} />
      </div>
    </div>
  );
}
