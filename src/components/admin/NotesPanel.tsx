'use client';

import { useState, useTransition } from 'react';
import { addNote, deleteNote } from '@/lib/admin-actions';

type Note = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { id: string; full_name: string | null; email: string } | null;
};

type Props = {
  submissionId: string;
  notes: Note[];
  currentUserId: string;
};

export function NotesPanel({ submissionId, notes, currentUserId }: Props) {
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <h3 className="text-[14px] font-semibold mb-3">ملاحظات داخلية</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          startTransition(async () => {
            await addNote(submissionId, body);
            setBody('');
          });
        }}
        className="space-y-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="اكتب ملاحظة لزملائك في الفريق…"
          className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-[13.5px] resize-none transition-colors"
          style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="px-4 py-1.5 rounded-lg text-[13px] font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            إضافة
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {notes.length === 0 && (
          <div className="text-[13px] text-center py-6" style={{ color: 'var(--muted)' }}>
            لا توجد ملاحظات بعد.
          </div>
        )}
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--rule-soft)', background: 'var(--option-bg)' }}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[12.5px] font-medium">{n.author?.full_name || n.author?.email || '—'}</div>
              <div className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>
                <span>{new Date(n.created_at).toLocaleString('ar')}</span>
                {n.author_id === currentUserId && (
                  <button
                    onClick={() => startTransition(() => deleteNote(n.id, submissionId))}
                    className="hover:underline"
                    style={{ color: 'var(--danger)' }}
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
            <div className="text-[13.5px] leading-7 whitespace-pre-wrap">{n.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
