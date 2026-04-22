import type { ReactNode } from 'react';

type SvgIconProps = {
  size?: number;
  stroke?: number;
  className?: string;
  children: ReactNode;
};

export function SvgIcon({ size = 20, stroke = 1.7, className = '', children }: SvgIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

type IconProps = Omit<SvgIconProps, 'children'>;

export const ArrowRight = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </SvgIcon>
);
export const ArrowLeft = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M19 12H5" />
    <path d="M11 5l-7 7 7 7" />
  </SvgIcon>
);
export const Check = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M20 6L9 17l-5-5" />
  </SvgIcon>
);
export const Enter = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M9 10l-5 5 5 5" />
    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </SvgIcon>
);
export const Globe = (p: IconProps) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.6 2.8 4 5.8 4 9s-1.4 6.2-4 9c-2.6-2.8-4-5.8-4-9s1.4-6.2 4-9z" />
  </SvgIcon>
);
export const IconBook = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
    <path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" />
  </SvgIcon>
);
export const IconApp = (p: IconProps) => (
  <SvgIcon {...p}>
    <rect x="6" y="3" width="12" height="18" rx="2.5" />
    <path d="M11 18h2" />
  </SvgIcon>
);
export const IconCode = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M8 7l-5 5 5 5" />
    <path d="M16 7l5 5-5 5" />
    <path d="M14 4l-4 16" />
  </SvgIcon>
);
export const IconBriefcase = (p: IconProps) => (
  <SvgIcon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M3 13h18" />
  </SvgIcon>
);
export const IconMessage = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.15L3 21l1.85-6.4A8 8 0 1 1 21 12z" />
  </SvgIcon>
);
export const ChevronDown = (p: IconProps) => (
  <SvgIcon {...p}>
    <path d="M6 9l6 6 6-6" />
  </SvgIcon>
);
export const IconPhone = (p: IconProps) => (
  <SvgIcon {...p} stroke={p.stroke ?? 1.8}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.62a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.46-1.46a2 2 0 0 1 2.11-.45c.84.3 1.72.51 2.62.63A2 2 0 0 1 22 16.92z" />
  </SvgIcon>
);

export const CATEGORY_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  book: IconBook,
  app: IconApp,
  code: IconCode,
  briefcase: IconBriefcase,
  message: IconMessage,
};

export function categoryIcon(key: string | null | undefined) {
  if (!key) return IconMessage;
  return CATEGORY_ICONS[key] || IconMessage;
}
