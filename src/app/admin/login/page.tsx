import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  return <LoginPageInner sp={searchParams} />;
}

async function LoginPageInner({ sp }: { sp: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await sp;
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg overflow-hidden" style={{ boxShadow: '0 0 0 1px var(--rule)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/itqan_logo_square.png" alt="Itqan" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>إتقان</div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>لوحة تحكم الفريق</div>
          </div>
        </div>
        <h1 className="text-[28px] font-semibold mb-3" style={{ color: 'var(--fg)' }}>تسجيل الدخول</h1>
        <p className="text-[14px] mb-6 leading-7" style={{ color: 'var(--muted)' }}>
          أدخل بريدك المسجّل ضمن فريق إتقان، وسنرسل لك رابط دخول سحري إلى بريدك.
        </p>
        <LoginForm next={next} initialError={error} />
      </div>
    </div>
  );
}
