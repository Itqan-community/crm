'use client';

import type { ReactNode } from 'react';

export function DialogShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-5 border my-8"
        style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogActions({
  onCancel,
  onSave,
  pending,
  saveLabel = 'حفظ',
  cancelLabel = 'إلغاء',
}: {
  onCancel: () => void;
  onSave: () => void;
  pending?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 rounded-lg border text-[13px]"
        style={{ borderColor: 'var(--rule)' }}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="px-3 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
      >
        {saveLabel}
      </button>
    </div>
  );
}

export function DialogField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
      {children}
    </div>
  );
}

export function DialogInput({
  value,
  onChange,
  dir,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir={dir}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-[13.5px]"
      style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
    />
  );
}

export function DialogSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]"
      style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
