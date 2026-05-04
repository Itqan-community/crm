'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const DIALOG_ID = 'admin-mobile-nav';

type Item = {
  href: string;
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  adminOnly: boolean;
};

// Kept in sync with src/components/admin/Sidebar.tsx — same items, same
// admin gating. The sidebar is `hidden md:flex`, which previously left
// mobile users with zero navigation. This drawer fills that gap.
const ITEMS: Item[] = [
  { href: '/admin',                       label: 'الطلبات',          icon: InboxIcon,  adminOnly: false },
  { href: '/admin/settings',              label: 'الحالات والفريق', icon: UsersIcon,  adminOnly: true  },
  { href: '/admin/settings/form-builder', label: 'بناء النموذج',    icon: WrenchIcon, adminOnly: true  },
];

export function MobileNav({ role }: { role: 'admin' | 'member' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  // Close the drawer on every route change. Without this, tapping a link
  // navigates but leaves the open drawer covering the new page until the
  // user dismisses it manually.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Open lifecycle: focus management + Esc + body lock + Tab trap. We
  // remember the previously focused trigger so we can restore focus when
  // the drawer closes — without this, screen reader / keyboard users get
  // dumped at the top of the document on dismiss.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = (document.activeElement as HTMLElement | null) ?? triggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      // Lightweight focus trap: keep Tab/Shift+Tab inside the dialog so
      // it doesn't fall through to the page behind, which is visually
      // covered but still in the DOM.
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog after it mounts.
    requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      firstFocusable?.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const items = ITEMS.filter((it) => !it.adminOnly || role === 'admin');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="فتح القائمة"
        aria-expanded={open}
        aria-controls={DIALOG_ID}
        aria-haspopup="dialog"
        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border"
        style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
      >
        <HamburgerIcon />
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <aside
            id={DIALOG_ID}
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 bottom-0 end-0 w-[78%] max-w-[320px] flex flex-col safe-top safe-bottom"
            style={{ background: 'var(--bg)', borderInlineStart: '1px solid var(--rule)' }}
            role="dialog"
            aria-modal="true"
            aria-label="قائمة لوحة الإدارة"
          >
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--rule-soft)' }}>
              <div className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>إتقان CRM</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق القائمة"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
                style={{ color: 'var(--muted)' }}
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
              {items.map((it) => {
                const Icon = it.icon;
                const isActive = pathname === it.href || (it.href !== '/admin' && pathname.startsWith(it.href));
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px]"
                    style={{
                      color: isActive ? 'var(--accent-strong)' : 'var(--fg)',
                      background: isActive ? 'var(--option-bg-selected)' : 'transparent',
                      minHeight: 44,
                    }}
                  >
                    <span style={{ color: isActive ? 'var(--accent-strong)' : 'var(--muted)' }}>
                      <Icon size={18} />
                    </span>
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
