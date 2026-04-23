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
// Category icons — Font Awesome Pro 7 (light), filled with currentColor.
// FA viewBox is 0 0 640 640, so they need their own wrapper. We accept the
// shared IconProps for size/className parity with the line icons; `stroke`
// has no effect on filled glyphs.
function FaCategoryIcon({ size = 22, className = '', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 640 640"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconBook = (p: IconProps) => (
  <FaCategoryIcon {...p}>
    <path d="M304 164L282.6 155.1C239.7 137.2 193.7 128 147.2 128L112 128C103.2 128 96 135.2 96 144L96 496C96 504.8 103.2 512 112 512L147.2 512C201 512 254.2 522.4 304 542.7L304 164zM336 542.7C385.8 522.4 439 512 492.8 512L528 512C536.8 512 544 504.8 544 496L544 144C544 135.2 536.8 128 528 128L492.8 128C446.3 128 400.3 137.2 357.4 155.1L336 164L336 542.7zM294.9 125.5L320 136L345.1 125.5C391.9 106 442.1 96 492.8 96L528 96C554.5 96 576 117.5 576 144L576 496C576 522.5 554.5 544 528 544L492.8 544C442.1 544 391.9 554 345.1 573.5L332.3 578.8C324.4 582.1 315.6 582.1 307.7 578.8L294.9 573.5C248.1 554 197.9 544 147.2 544L112 544C85.5 544 64 522.5 64 496L64 144C64 117.5 85.5 96 112 96L147.2 96C197.9 96 248.1 106 294.9 125.5z" />
  </FaCategoryIcon>
);

export const IconApp = (p: IconProps) => (
  <FaCategoryIcon {...p}>
    <path d="M208 96C190.3 96 176 110.3 176 128L176 512C176 529.7 190.3 544 208 544L432 544C449.7 544 464 529.7 464 512L464 128C464 110.3 449.7 96 432 96L208 96zM144 128C144 92.7 172.7 64 208 64L432 64C467.3 64 496 92.7 496 128L496 512C496 547.3 467.3 576 432 576L208 576C172.7 576 144 547.3 144 512L144 128zM288 464L352 464C360.8 464 368 471.2 368 480C368 488.8 360.8 496 352 496L288 496C279.2 496 272 488.8 272 480C272 471.2 279.2 464 288 464z" />
  </FaCategoryIcon>
);

export const IconCode = (p: IconProps) => (
  <FaCategoryIcon {...p}>
    <path d="M415.2 85.1C418 76.7 413.5 67.7 405.1 64.9C396.7 62.1 387.7 66.6 384.9 75L224.9 555C222.1 563.4 226.6 572.4 235 575.2C243.4 578 252.4 573.5 255.2 565.1L415.2 85.1zM171.3 196.7C165.1 190.5 154.9 190.5 148.7 196.7L36.7 308.7C30.5 314.9 30.5 325.1 36.7 331.3L148.7 443.3C154.9 449.5 165.1 449.5 171.3 443.3C177.5 437.1 177.5 426.9 171.3 420.7L70.6 320L171.3 219.3C177.5 213.1 177.5 202.9 171.3 196.7zM468.7 196.7C462.5 202.9 462.5 213.1 468.7 219.3L569.4 320L468.7 420.7C462.5 426.9 462.5 437.1 468.7 443.3C474.9 449.5 485.1 449.5 491.3 443.3L603.3 331.3C609.5 325.1 609.5 314.9 603.3 308.7L491.3 196.7C485.1 190.5 474.9 190.5 468.7 196.7z" />
  </FaCategoryIcon>
);

export const IconBriefcase = (p: IconProps) => (
  <FaCategoryIcon {...p}>
    <path d="M256 112L256 160L384 160L384 112C384 103.2 376.8 96 368 96L272 96C263.2 96 256 103.2 256 112zM224 160L224 112C224 85.5 245.5 64 272 64L368 64C394.5 64 416 85.5 416 112L416 160L512 160C547.3 160 576 188.7 576 224L576 480C576 515.3 547.3 544 512 544L128 544C92.7 544 64 515.3 64 480L64 224C64 188.7 92.7 160 128 160L224 160zM400 192L128 192C110.3 192 96 206.3 96 224L96 320L544 320L544 224C544 206.3 529.7 192 512 192L400 192zM544 352L400 352L400 400C400 417.7 385.7 432 368 432L272 432C254.3 432 240 417.7 240 400L240 352L96 352L96 480C96 497.7 110.3 512 128 512L512 512C529.7 512 544 497.7 544 480L544 352zM272 352L272 400L368 400L368 352L272 352z" />
  </FaCategoryIcon>
);

export const IconMessage = (p: IconProps) => (
  <FaCategoryIcon {...p}>
    <path d="M243.2 597.6C243.2 597.6 243.2 597.6 243.2 597.6L236.8 602.4C232 606 226.1 608 220 608C204.5 608 192 595.5 192 580L192 512L160 512C107 512 64 469 64 416L64 192C64 139 107 96 160 96L480 96C533 96 576 139 576 192L576 416C576 469 533 512 480 512L360 512C358.3 512 356.6 512.6 355.2 513.6L243.2 597.6zM224 532L224 572L336 488C342.9 482.8 351.3 480 360 480L480 480C515.3 480 544 451.3 544 416L544 192C544 156.7 515.3 128 480 128L160 128C124.7 128 96 156.7 96 192L96 416C96 451.3 124.7 480 160 480L200 480C213.3 480 224 490.7 224 504L224 532z" />
  </FaCategoryIcon>
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
