import Link from 'next/link';

const items = [
  { href: '/admin',                         label: 'الطلبات',          adminOnly: false },
  { href: '/admin/settings',                label: 'الحالات والفريق', adminOnly: true },
  { href: '/admin/settings/form-builder',   label: 'بناء النموذج',     adminOnly: true },
];

export function Sidebar({ role }: { role: 'admin' | 'member' }) {
  return (
    <aside className="w-60 border-l shrink-0 hidden md:block" style={{ borderColor: 'var(--rule-soft)' }}>
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg overflow-hidden" style={{ boxShadow: '0 0 0 1px var(--rule)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/itqan_logo_square.png" alt="Itqan" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>إتقان CRM</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>لوحة الفريق</div>
        </div>
      </div>
      <nav className="px-3 py-2 space-y-1">
        {items
          .filter((it) => !it.adminOnly || role === 'admin')
          .map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="block px-3 py-2 rounded-lg text-[13.5px] hover:bg-[var(--option-bg-selected)] transition"
              style={{ color: 'var(--fg)' }}
            >
              {it.label}
            </Link>
          ))}
      </nav>
    </aside>
  );
}
