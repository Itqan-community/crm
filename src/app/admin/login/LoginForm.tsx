'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(initialError || null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const callback = `${siteUrl}/admin/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: callback, shouldCreateUser: true },
    });
    if (err) {
      setError(err.message);
      setStatus('error');
      return;
    }
    setStatus('sent');
  };

  if (status === 'sent') {
    return (
      <div className="rounded-xl p-5 border" style={{ borderColor: 'var(--rule)', background: 'var(--option-bg-selected)' }}>
        <div className="text-[14px] leading-7" style={{ color: 'var(--fg)' }}>
          أرسلنا رابط الدخول إلى <strong>{email}</strong>. افتحه من بريدك للمتابعة.
          إن لم يصلك خلال دقيقة، تأكد أن بريدك مضاف لقائمة الفريق.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="email"
        autoComplete="email"
        required
        placeholder="name@itqan.dev"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dir="ltr"
        className="w-full px-4 py-3 rounded-lg border-2 outline-none text-[15px] bg-transparent transition-colors"
        style={{
          color: 'var(--fg)',
          borderColor: error ? 'var(--danger)' : 'var(--rule)',
        }}
        onFocus={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--rule)')}
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full px-5 py-3 rounded-lg text-[14.5px] font-semibold transition disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
      >
        {status === 'sending' ? 'جاري الإرسال…' : 'إرسال رابط الدخول'}
      </button>
      {error && (
        <div className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</div>
      )}
    </form>
  );
}
