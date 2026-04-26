'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Item = {
  href: string;
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  adminOnly: boolean;
};

const ITEMS: Item[] = [
  { href: '/admin',                       label: 'الطلبات',          icon: InboxIcon,    adminOnly: false },
  { href: '/admin/settings',              label: 'الحالات والفريق', icon: UsersIcon,    adminOnly: true  },
  { href: '/admin/settings/form-builder', label: 'بناء النموذج',    icon: WrenchIcon,   adminOnly: true  },
];

const STORAGE_KEY = 'itqan_sidebar_collapsed';

export function Sidebar({ role }: { role: 'admin' | 'member' }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {}
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const items = ITEMS.filter((it) => !it.adminOnly || role === 'admin');
  const isCollapsed = hydrated && collapsed;

  return (
    <aside
      className="border-l shrink-0 hidden md:flex md:flex-col transition-[width] duration-200"
      style={{
        width: isCollapsed ? 64 : 240,
        borderColor: 'var(--rule-soft)',
      }}
    >
      <Link
        href="/admin"
        className="p-4 flex items-center gap-3 hover:bg-[var(--option-bg-selected)] transition"
        title="الذهاب للوحة الرئيسية"
      >
        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 relative" style={{ boxShadow: '0 0 0 1px var(--rule)' }}>
          <Image
            src="/itqan_logo_square.png"
            alt="Itqan"
            width={36}
            height={36}
            priority
            className="w-full h-full object-cover"
          />
        </div>
        {!isCollapsed && (
          <div className="leading-tight min-w-0">
            <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--fg)' }}>إتقان CRM</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>لوحة الفريق</div>
          </div>
        )}
      </Link>

      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = pathname === it.href || (it.href !== '/admin' && pathname.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              title={isCollapsed ? it.label : undefined}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition"
              style={{
                color: isActive ? 'var(--accent-strong)' : 'var(--fg)',
                background: isActive ? 'var(--option-bg-selected)' : 'transparent',
                justifyContent: isCollapsed ? 'center' : undefined,
              }}
            >
              <span className="shrink-0" style={{ color: isActive ? 'var(--accent-strong)' : 'var(--muted)' }}>
                <Icon size={18} />
              </span>
              {!isCollapsed && <span className="truncate">{it.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t" style={{ borderColor: 'var(--rule-soft)' }}>
        <button
          type="button"
          onClick={toggle}
          title={isCollapsed ? 'توسيع' : 'تصغير'}
          aria-label={isCollapsed ? 'توسيع الشريط الجانبي' : 'تصغير الشريط الجانبي'}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] transition hover:bg-[var(--option-bg-selected)]"
          style={{ color: 'var(--muted)', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
        >
          <CollapseIcon flipped={isCollapsed} />
          {!isCollapsed && <span>تصغير</span>}
        </button>
      </div>
    </aside>
  );
}

function CollapseIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: flipped ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
      <path d="M9 6l-6 6 6 6" />
      <path d="M21 6l-6 6 6 6" />
    </svg>
  );
}

function InboxIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function UsersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function WrenchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-2.6 2.4-2.4z" />
    </svg>
  );
}
