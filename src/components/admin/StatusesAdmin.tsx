'use client';

import { useState, useTransition } from 'react';
import type { StatusRow } from '@/types/database';
import { upsertStatus, deleteStatus } from '@/lib/admin-actions';
import { StatusBadge } from './StatusBadge';
import { DialogShell, DialogActions, DialogField, DialogInput } from './DialogPrimitives';

export function StatusesAdmin({ statuses }: { statuses: StatusRow[] }) {
  const [editing, setEditing] = useState<Partial<StatusRow> | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold">الحالات</h2>
        <button
          onClick={() => setEditing({ key: '', label_ar: '', label_en: '', color: '#1B4332', position: (statuses.at(-1)?.position ?? 0) + 10, is_default: false, is_terminal: false })}
          className="text-[13px] px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--rule)' }}
        >
          + إضافة حالة
        </button>
      </div>

      <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
        {statuses.map((s) => (
          <li key={s.id} className="py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <StatusBadge label={s.label_ar} color={s.color} />
              <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
                {s.label_en} · <span className="font-mono">{s.key}</span>
                {s.is_default && ' · افتراضي'}
                {s.is_terminal && ' · نهائي'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditing(s)} className="text-[12.5px] px-2 py-1 rounded hover:bg-[var(--option-bg-selected)]">تعديل</button>
              <button
                onClick={() => {
                  if (!confirm(`حذف الحالة "${s.label_ar}"؟`)) return;
                  setError(null);
                  startTransition(async () => {
                    try { await deleteStatus(s.id); } catch (e: any) {
                      setError(e?.message === 'status_in_use' ? 'لا يمكن حذف حالة مستخدمة في طلبات. انقل الطلبات إلى حالة أخرى أولاً.' : (e?.message ?? 'فشل الحذف'));
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
      </ul>

      {error && <div className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {editing && (
        <StatusEditDialog
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            setError(null);
            startTransition(async () => {
              try { await upsertStatus(data); setEditing(null); } catch (e: any) { setError(e?.message ?? 'فشل الحفظ'); }
            });
          }}
          pending={pending}
        />
      )}
    </section>
  );
}

function StatusEditDialog({
  initial,
  onCancel,
  onSave,
  pending,
}: {
  initial: Partial<StatusRow>;
  onCancel: () => void;
  onSave: (data: any) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    id: initial.id,
    key: initial.key ?? '',
    label_ar: initial.label_ar ?? '',
    label_en: initial.label_en ?? '',
    color: initial.color ?? '#1B4332',
    position: initial.position ?? 0,
    is_default: initial.is_default ?? false,
    is_terminal: initial.is_terminal ?? false,
  });
  return (
    <DialogShell onClose={onCancel}>
      <h3 className="text-[16px] font-semibold mb-4">{form.id ? 'تعديل حالة' : 'حالة جديدة'}</h3>
      <div className="space-y-3 text-[13px]">
        <DialogField label="المفتاح (key)"><DialogInput value={form.key} onChange={(v) => setForm({ ...form, key: v })} dir="ltr" /></DialogField>
        <DialogField label="الاسم بالعربية"><DialogInput value={form.label_ar} onChange={(v) => setForm({ ...form, label_ar: v })} /></DialogField>
        <DialogField label="الاسم بالإنجليزية"><DialogInput value={form.label_en} onChange={(v) => setForm({ ...form, label_en: v })} dir="ltr" /></DialogField>
        <DialogField label="اللون"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full h-10 rounded-lg" /></DialogField>
        <DialogField label="الترتيب"><DialogInput value={String(form.position)} onChange={(v) => setForm({ ...form, position: Number(v) || 0 })} dir="ltr" /></DialogField>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> افتراضي للطلبات الجديدة</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_terminal} onChange={(e) => setForm({ ...form, is_terminal: e.target.checked })} /> حالة نهائية</label>
        </div>
      </div>
      <DialogActions onCancel={onCancel} onSave={() => onSave(form)} pending={pending} />
    </DialogShell>
  );
}
