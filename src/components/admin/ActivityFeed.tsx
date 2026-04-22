type Activity = {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
  actor: { id: string; full_name: string | null; email: string } | null;
};

const LABELS: Record<string, string> = {
  created: 'تم إنشاء الطلب',
  status_changed: 'تغيير الحالة',
  assigned: 'تعيين مسؤول',
  note_added: 'إضافة ملاحظة',
  newsletter_subscribed: 'تم الاشتراك في النشرة',
  newsletter_failed: 'تعذّر الاشتراك في النشرة',
  email_failed: 'تعذّر إرسال بريد التأكيد',
  slack_failed: 'تعذّر إشعار Slack',
};

export function ActivityFeed({
  activity,
  statusesById,
  teamById,
}: {
  activity: Activity[];
  statusesById: Record<string, { label_ar: string }>;
  teamById: Record<string, { label: string }>;
}) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
      <h3 className="text-[14px] font-semibold mb-3">سجل النشاط</h3>
      <ol className="space-y-3">
        {activity.length === 0 && (
          <li className="text-[13px] text-center py-4" style={{ color: 'var(--muted)' }}>
            لا يوجد نشاط بعد.
          </li>
        )}
        {activity.map((a) => (
          <li key={a.id} className="flex gap-3">
            <div className="w-2 h-2 rounded-full mt-2" style={{ background: 'var(--accent)' }} />
            <div className="flex-1">
              <div className="text-[13px]">
                <span className="font-medium">{LABELS[a.action] || a.action}</span>
                <span style={{ color: 'var(--muted)' }}>
                  {' '}— {a.actor ? a.actor.full_name || a.actor.email : 'النظام'}
                </span>
              </div>
              <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
                {describeMeta(a.action, a.meta, statusesById, teamById)}
                {' · '}
                {new Date(a.created_at).toLocaleString('ar')}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function describeMeta(
  action: string,
  meta: Record<string, unknown>,
  statusesById: Record<string, { label_ar: string }>,
  teamById: Record<string, { label: string }>,
): string {
  if (action === 'status_changed') {
    const from = String(meta.from || '');
    const to = String(meta.to || '');
    return `${statusesById[from]?.label_ar || '—'} → ${statusesById[to]?.label_ar || '—'}`;
  }
  if (action === 'assigned') {
    const from = meta.from ? teamById[String(meta.from)]?.label || '—' : 'بلا';
    const to = meta.to ? teamById[String(meta.to)]?.label || '—' : 'بلا';
    return `${from} → ${to}`;
  }
  if (action === 'created' && meta.reference_no) {
    return `الرقم المرجعي: ${meta.reference_no}`;
  }
  return '';
}
