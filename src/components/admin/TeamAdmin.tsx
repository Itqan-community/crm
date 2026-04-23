'use client';

import { useState, useTransition } from 'react';
import { addAllowedEmail, removeAllowedEmail } from '@/lib/admin-actions';
import type { TeamMemberRow, AllowedEmailRow } from '@/types/database';

export function TeamAdmin({ team, allowed }: { team: TeamMemberRow[]; allowed: AllowedEmailRow[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Index team members by email so we can show their display names alongside
  // the allow-list entries (which only know an email and an optional name).
  const teamByEmail = new Map(team.map((t) => [t.email.toLowerCase(), t]));

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <h2 className="text-[16px] font-semibold mb-4">الفريق والصلاحيات</h2>

      <div>
        <div className="text-[13px] mb-2" style={{ color: 'var(--muted)' }}>قائمة البريد المسموح:</div>
        <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
          {allowed.length === 0 && (
            <li className="text-[13px] py-2" style={{ color: 'var(--muted)' }}>لا يوجد بعد.</li>
          )}
          {allowed.map((a) => {
            const member = teamByEmail.get(a.email.toLowerCase());
            const displayName = a.full_name || member?.full_name || null;
            const hasSignedIn = Boolean(member);
            return (
              <li key={a.email} className="py-2.5 flex items-center justify-between gap-3 text-[13.5px]">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={displayName || a.email} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{displayName || <span style={{ color: 'var(--muted)' }}>بلا اسم</span>}</div>
                    <div className="text-[12px] truncate" style={{ color: 'var(--muted)' }} dir="ltr">{a.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[11.5px] px-2 py-0.5 rounded-full border"
                    style={{ borderColor: 'var(--rule)', color: 'var(--muted)' }}
                  >
                    {a.role === 'admin' ? 'أدمن' : 'عضو'}
                  </span>
                  <span
                    className="text-[11.5px] px-2 py-0.5 rounded-full"
                    style={{
                      background: hasSignedIn ? 'var(--option-bg-selected)' : 'transparent',
                      color: hasSignedIn ? 'var(--accent-strong)' : 'var(--muted)',
                      border: hasSignedIn ? 'none' : '1px dashed var(--rule)',
                    }}
                  >
                    {hasSignedIn ? 'سجّل دخول' : 'لم يدخل بعد'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`إزالة ${a.email} من قائمة المسموح؟`)) return;
                      startTransition(() => removeAllowedEmail(a.email));
                    }}
                    className="text-[12.5px] hover:underline"
                    style={{ color: 'var(--danger)' }}
                  >
                    إزالة
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 grid sm:grid-cols-[1.2fr_1.5fr_auto_auto] gap-2">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={setName} placeholder="عبدالرحمن" />
          </div>
          <div>
            <Label>البريد</Label>
            <Input value={email} onChange={setEmail} placeholder="name@itqan.dev" dir="ltr" />
          </div>
          <div>
            <Label>الصلاحية</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              className="h-[38px] px-3 rounded-lg border bg-transparent text-[13.5px]"
              style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
            >
              <option value="member">عضو</option>
              <option value="admin">مدير</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await addAllowedEmail(email, role, name);
                    setEmail('');
                    setName('');
                  } catch (e: unknown) {
                    const code = e instanceof Error ? e.message : '';
                    setError(code === 'invalid_email' ? 'صيغة بريد غير صحيحة' : (code || 'فشل الإضافة'));
                  }
                });
              }}
              disabled={pending}
              className="h-[38px] px-4 rounded-lg text-[13px] font-semibold disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              إضافة
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-[12.5px]" style={{ color: 'var(--danger)' }}>{error}</div>}
      </div>
    </section>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?';
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0"
      style={{ background: 'var(--option-bg-selected)', color: 'var(--accent-strong)' }}
    >
      {initials}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>{children}</div>;
}

function Input({ value, onChange, placeholder, dir }: { value: string; onChange: (v: string) => void; placeholder?: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className="w-full h-[38px] px-3 rounded-lg border bg-transparent outline-none text-[13.5px]"
      style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
    />
  );
}
