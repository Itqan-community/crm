type Props = { label: string; color: string };

export function StatusBadge({ label, color }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border"
      style={{
        color,
        borderColor: color + '40',
        background: color + '12',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
