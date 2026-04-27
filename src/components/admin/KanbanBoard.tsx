'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from '@dnd-kit/core';
import type { StatusRow } from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';
import { setSubmissionStatus } from '@/lib/admin-actions';
import { CategoryBadge } from './CategoryBadge';
import { LocalTime } from './LocalTime';

type Props = {
  submissions: SubmissionListRow[];
  statuses: StatusRow[];
};

const dropAnimation: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

export function KanbanBoard({ submissions, statuses }: Props) {
  // Optimistic local copy — we mutate it on drop and reconcile from the
  // server via revalidatePath inside the action.
  const [items, setItems] = useState(submissions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sync when the server sends fresher data (e.g. after revalidation).
  if (submissions !== _lastServerRef.current) {
    _lastServerRef.current = submissions;
    // Only adopt server data if no card is mid-drag.
    if (!activeId) {
      // Apply on next microtask to avoid setState-in-render warnings.
      queueMicrotask(() => setItems(submissions));
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStatus = new Map<string, SubmissionListRow[]>();
  for (const s of statuses) byStatus.set(s.id, []);
  for (const r of items) {
    if (!byStatus.has(r.status_id)) byStatus.set(r.status_id, []);
    byStatus.get(r.status_id)!.push(r);
  }

  const activeCard = activeId ? items.find((i) => i.id === activeId) : null;
  const activeStatusColor = activeCard
    ? statuses.find((s) => s.id === activeCard.status_id)?.color ?? '#6B6B68'
    : '#6B6B68';

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const cardId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const card = items.find((i) => i.id === cardId);
    if (!card) return;
    const newStatus = statuses.find((s) => s.id === overId);
    if (!newStatus || newStatus.id === card.status_id) return;

    // Optimistic update: re-tag the card with the new status_id immediately.
    const newStatusRef = { id: newStatus.id, key: newStatus.key, label_ar: newStatus.label_ar, label_en: newStatus.label_en, color: newStatus.color };
    setItems((prev) => prev.map((r) => (r.id === cardId ? { ...r, status_id: newStatus.id, status: newStatusRef } : r)));

    startTransition(async () => {
      try {
        await setSubmissionStatus(cardId, newStatus.id);
      } catch {
        // Revert on failure.
        setItems((prev) => prev.map((r) => (r.id === cardId ? { ...r, status_id: card.status_id, status: card.status } : r)));
      }
    });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="overflow-x-auto -mx-2 pb-2">
        <div className="flex gap-3 min-w-fit px-2">
          {statuses.map((s) => (
            <Column key={s.id} status={s} cards={byStatus.get(s.id) ?? []} activeId={activeId} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeCard ? <CardView row={activeCard} statusColor={activeStatusColor} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Module-level ref to detect new server props between renders without a useEffect.
const _lastServerRef: { current: SubmissionListRow[] | null } = { current: null };

function Column({ status, cards, activeId }: { status: StatusRow; cards: SubmissionListRow[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div className="w-[280px] shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: status.color }} />
          <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--fg)' }}>{status.label_ar}</h3>
        </div>
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="rounded-xl p-2 space-y-2 min-h-[140px] transition-colors"
        style={{
          background: isOver ? 'var(--option-bg-selected)' : 'var(--option-bg-selected)',
          border: isOver ? '1.5px dashed var(--accent)' : '1px solid var(--rule-soft)',
        }}
      >
        {cards.length === 0 && (
          <div className="text-[12px] text-center py-6" style={{ color: 'var(--muted)' }}>
            {isOver ? 'أفلت هنا لتغيير الحالة' : 'لا طلبات'}
          </div>
        )}
        {cards.map((c) => (
          <DraggableCard key={c.id} row={c} statusColor={status.color} hidden={activeId === c.id} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ row, statusColor, hidden }: { row: SubmissionListRow; statusColor: string; hidden: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: hidden || isDragging ? 0 : 1,
    transition: transform ? undefined : 'opacity 150ms',
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <CardView row={row} statusColor={statusColor} />
    </div>
  );
}

function CardView({ row, statusColor, dragging = false }: { row: SubmissionListRow; statusColor: string; dragging?: boolean }) {
  return (
    <Link
      href={`/admin/submissions/${row.id}`}
      onClick={(e) => { if (dragging) e.preventDefault(); }}
      draggable={false}
      className="block rounded-lg p-3 border transition select-none"
      style={{
        background: 'var(--bg)',
        borderColor: dragging ? 'var(--accent)' : 'var(--rule)',
        cursor: dragging ? 'grabbing' : 'grab',
        boxShadow: dragging ? '0 18px 36px -12px rgba(0,0,0,0.25), 0 6px 12px rgba(0,0,0,0.08)' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-medium text-[13.5px] leading-snug truncate flex-1" style={{ color: 'var(--fg)' }}>
          {row.submitter_name}
        </div>
        <span
          className="text-[10.5px] font-mono shrink-0 px-1.5 py-0.5 rounded"
          style={{ color: statusColor, background: 'var(--option-bg-selected)' }}
        >
          {row.reference_no}
        </span>
      </div>
      <div className="text-[11.5px] truncate mb-1" style={{ color: 'var(--muted)' }} dir="ltr">
        {row.submitter_email}
      </div>
      <div className="flex items-center justify-between gap-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
        {row.category ? (
          <CategoryBadge label={row.category.label_ar} categoryKey={row.category.key} />
        ) : (
          <span>—</span>
        )}
        <div className="flex items-center gap-1.5">
          {row.assignee && (
            <Avatar name={row.assignee.full_name || row.assignee.email} />
          )}
          <LocalTime iso={row.created_at} mode="date" />
        </div>
      </div>
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?';
  return (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
      style={{ background: 'var(--option-bg-selected)', color: 'var(--accent-strong)' }}
      title={name}
    >
      {initials}
    </span>
  );
}
