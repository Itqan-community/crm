'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'email' | 'code' | 'success';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email:    'صيغة البريد غير صحيحة.',
  invalid_token:    'الرمز يجب أن يتكون من ٦ أرقام.',
  verify_failed:    'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.',
  not_authorized:   'هذا البريد غير مصرّح له بدخول اللوحة. تواصل مع الأدمن لإضافته.',
  rate_limited:     'تم تجاوز الحد المسموح من الرسائل. حاول بعد قليل.',
  send_failed:      'تعذّر إرسال الرمز. حاول مرة أخرى.',
  network:          'تعذّر الاتصال. تحقّق من الإنترنت وحاول مرة أخرى.',
};

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(initialError ? translateError(initialError) : null);
  const [pending, startTransition] = useTransition();

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      let res: Response;
      try {
        res = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
      } catch {
        setError(translateError('network'));
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(translateError(body.error || 'send_failed'));
        return;
      }
      setStep('code');
    });
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      let res: Response;
      try {
        res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), token: code.trim() }),
        });
      } catch {
        setError(translateError('network'));
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(translateError(body.error || 'verify_failed'));
        return;
      }
      setStep('success');
      router.push(next || '/admin');
      router.refresh();
    });
  };

  if (step === 'success') {
    return (
      <div className="rounded-xl p-5 border" style={{ borderColor: 'var(--rule)' }}>
        <div className="text-[14px]" style={{ color: 'var(--fg)' }}>تم تسجيل الدخول. جارٍ تحويلك…</div>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        <div className="text-[13.5px] leading-7 mb-2" style={{ color: 'var(--muted)' }}>
          أرسلنا رمزاً مكوّناً من ٦ أرقام إلى <strong style={{ color: 'var(--fg)' }} dir="ltr">{email}</strong>.
          ألصقه أدناه:
        </div>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          pattern="\d{6}"
          required
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          dir="ltr"
          className="w-full px-4 py-3 rounded-lg border-2 outline-none text-[20px] font-mono tracking-[0.5em] text-center bg-transparent transition-colors"
          style={{ color: 'var(--fg)', borderColor: error ? 'var(--danger)' : 'var(--rule)' }}
          onFocus={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--rule)')}
        />
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="w-full px-5 py-3 rounded-lg text-[14.5px] font-semibold transition disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {pending ? 'جارٍ التحقق…' : 'تأكيد الدخول'}
        </button>
        {error && <div className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</div>}
        <button
          type="button"
          onClick={() => { setStep('email'); setCode(''); setError(null); }}
          className="text-[13px] hover:underline"
          style={{ color: 'var(--muted)' }}
        >
          ← تغيير البريد
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      <input
        type="email"
        autoComplete="email"
        required
        placeholder="name@itqan.dev"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dir="ltr"
        className="w-full px-4 py-3 rounded-lg border-2 outline-none text-[15px] bg-transparent transition-colors"
        style={{ color: 'var(--fg)', borderColor: error ? 'var(--danger)' : 'var(--rule)' }}
        onFocus={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = error ? 'var(--danger)' : 'var(--rule)')}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full px-5 py-3 rounded-lg text-[14.5px] font-semibold transition disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
      >
        {pending ? 'جارٍ الإرسال…' : 'إرسال رمز الدخول'}
      </button>
      {error && <div className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{error}</div>}
    </form>
  );
}

function translateError(code: string): string {
  return ERROR_MESSAGES[code] || code;
}
