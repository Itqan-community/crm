import { Tag } from './Tag';

type Props = { label: string; categoryKey: string };

const PALETTE = [
  '#2563EB', // blue
  '#059669', // emerald
  '#D97706', // amber
  '#DB2777', // pink
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#DC2626', // red
  '#65A30D', // lime
];

function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function CategoryBadge({ label, categoryKey }: Props) {
  return <Tag color={colorFor(categoryKey)}>{label}</Tag>;
}
