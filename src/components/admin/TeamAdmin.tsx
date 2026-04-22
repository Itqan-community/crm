'use client';

import { useState, useTransition } from 'react';
import { addAllowedEmail, removeAllowedEmail } from '@/lib/admin-actions';
import type { TeamMemberRow, AllowedEmailRow } from '@/types/database';

export function TeamAdmin({ team, allowed }: { team: TeamMemberRow[]; allowed: AllowedEmailRow[] }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <h2 className="text-[16px] font-semibold mb-4">الفريق والصلاحيات</h2>

      <div className="mb-5">
        <div className="text-[13px] mb-2" style={{ color: 'var(--muted)' }}>أعضاء سجّلوا دخولاً:</div>
        <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
          {team.length === 0 && <li className="text-[13px] py-2" style={{ color: 'var(--muted)' }}>لا يوجد بعد.</li>}
          {team.map((t) => (
            <li key={t.id} className="py-2 flex items-center justify-between text-[13.5px]">
              <div>
                <div className="font-medium">{t.full_name || t.email}</div>
                {t.full_name && <div className="text-[12px]" style={{ color: 'var(--muted)' }} dir="ltr">{t.email}</div>}
              </div>
              <span className="text-[12px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--rule)', color: 'var(--muted)' }}>
                {t.role === 'admin' ? 'أدمن' : 'عضو'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-[13px] mb-2" style={{ color: 'var(--muted)' }}>قائمة البريد المسموح:</div>
        <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
          {allowed.map((a) => (
            <li key={a.email} className="py-2 flex items-center justify-between text-[13.5px]">
              <div>
                <span dir="ltr">{a.email}</span>
                <span className="ms-2 text-[12px]" style={{ color: 'var(--muted)' }}>{a.role === 'admin' ? 'أدمن' : 'عضو'}</span>
              </div>
              <button
                onClick={() => {
                  if (!confirm(`إزالة ${a.email} من قائمة المسموح؟`)) return;
                  startTransition(() => removeAllowedEmail(a.email));
                }}
                className="text-[12.5px]"
                style={{ color: 'var(--danger)' }}
              >
                إزالة
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>بريد جديد</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@itqan.dev"
              dir="ltr"
              className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-[13.5px]"
              style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
            />
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')} className="px-3 py-2 rounded-lg border bg-transparent text-[13.5px]" style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}>
            <option value="member">عضو</option>
            <option value="admin">أدمن</option>
          </select>
          <button
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try { await addAllowedEmail(email, role); setEmail(''); } catch (e: any) {
                  setError(e?.message === 'invalid_email' ? 'صيغة بريد غير صحيحة' : (e?.message ?? 'فشل الإضافة'));
                }
              });
            }}
            disabled={pending}
            className="px-3 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            إضافة
          </button>
        </div>
        {error && <div className="mt-2 text-[12.5px]" style={{ color: 'var(--danger)' }}>{error}</div>}
      </div>
    </section>
  );
}
