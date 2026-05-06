import type { ReactNode } from 'react';

type Props = {
  /** Single hex color (e.g. '#16A34A'). Used for text + border (40 alpha) + bg (14 alpha). */
  color: string;
  /** Extra Tailwind classes. Use to override text-size (default text-[12px]). */
  className?: string;
  title?: string;
  children: ReactNode;
};

// Tinted pill. The same shape repeated across CategoryBadge, SourceBadge,
// the bulk-import row-status badge, and the bulk-import counter pill —
// so we extract it here. Tailwind needs the literal `+ '40'` / `+ '14'`
// suffixes at runtime, not in CSS, so styling stays inline.
export function Tag({ color, className = '', title, children }: Props) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium border ${className}`}
      style={{
        color,
        borderColor: color + '40',
        background: color + '14',
      }}
    >
      {children}
    </span>
  );
}
