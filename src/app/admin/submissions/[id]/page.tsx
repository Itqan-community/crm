import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadStatuses, loadTeam } from '@/lib/admin-queries';
import { StatusEditor } from '@/components/admin/StatusEditor';
import { AssigneePicker } from '@/components/admin/AssigneePicker';
import { NotesPanel } from '@/components/admin/NotesPanel';
import { ActivityFeed } from '@/components/admin/ActivityFeed';

export const dynamic = 'force-dynamic';

export default async function SubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: sub }, { data: answers }, { data: notes }, { data: activity }, statuses, team] = await Promise.all([
    supabase
      .from('submissions')
      .select(
        `id, reference_no, language, created_at, updated_at, status_id, assignee_id, newsletter_optin,
         submitter_name, submitter_email,
         category:form_categories(id, key, label_ar, label_en),
         status:statuses(id, key, label_ar, label_en, color),
         assignee:team_members(id, email, full_name)`,
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('submission_answers')
      .select('id, field_id, field_key_snap, field_label_snap, value_text, value_json, created_at')
      .eq('submission_id', id),
    supabase
      .from('notes')
      .select('id, body, created_at, author_id, author:team_members(id, full_name, email)')
      .eq('submission_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('activity_log')
      .select('id, action, meta, created_at, actor:team_members(id, full_name, email)')
      .eq('submission_id', id)
      .order('created_at', { ascending: false }),
    loadStatuses(),
    loadTeam(),
  ]);

  if (!sub) notFound();

  const statusesById = Object.fromEntries(statuses.map((s) => [s.id, { label_ar: s.label_ar }]));
  const teamById = Object.fromEntries(team.map((t) => [t.id, { label: t.full_name || t.email }]));

  // Order answers by their original field position when possible
  const fieldIdsForOrdering = answers
    ?.map((a) => a.field_id)
    .filter((x): x is string => !!x) ?? [];
  const { data: orderedFields } = fieldIdsForOrdering.length
    ? await supabase
        .from('form_fields')
        .select('id, position')
        .in('id', fieldIdsForOrdering)
    : { data: [] as { id: string; position: number }[] };
  const positionByField = new Map((orderedFields ?? []).map((f) => [f.id, f.position]));
  const sortedAnswers = (answers ?? []).slice().sort((a, b) => {
    const pa = positionByField.get(a.field_id ?? '') ?? 9_999;
    const pb = positionByField.get(b.field_id ?? '') ?? 9_999;
    return pa - pb;
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-2">
        <Link href="/admin" className="text-[13px] hover:underline" style={{ color: 'var(--muted)' }}>
          ← الرجوع إلى الطلبات
        </Link>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-semibold mb-1">{sub.submitter_name}</h1>
          <div className="text-[13px]" style={{ color: 'var(--muted)' }}>
            <span className="font-mono" dir="ltr">{sub.reference_no}</span>
            {' · '}
            {(sub as any).category?.label_ar}
            {' · '}
            {new Date(sub.created_at).toLocaleString('ar')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusEditor submissionId={sub.id} currentStatusId={sub.status_id} statuses={statuses} />
          <AssigneePicker submissionId={sub.id} currentAssigneeId={sub.assignee_id} team={team} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
            <h3 className="text-[14px] font-semibold mb-4">معلومات التواصل</h3>
            <dl className="grid sm:grid-cols-2 gap-3 text-[13.5px]">
              <FieldRow label="الاسم" value={sub.submitter_name} />
              <FieldRow label="البريد" value={sub.submitter_email} dir="ltr" />
              <FieldRow label="اللغة" value={sub.language === 'ar' ? 'العربية' : 'English'} />
              <FieldRow label="نشرة إتقان" value={sub.newsletter_optin ? 'مشترك' : 'لا'} />
            </dl>
          </section>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--rule)' }}>
            <h3 className="text-[14px] font-semibold mb-4">إجابات النموذج</h3>
            <dl className="space-y-4 text-[13.5px]">
              {sortedAnswers.map((a) => {
                const label = (a.field_label_snap as { ar: string }).ar;
                const value = a.value_text != null
                  ? a.value_text
                  : Array.isArray(a.value_json)
                    ? (a.value_json as string[]).join('، ')
                    : '';
                return (
                  <div key={a.id}>
                    <dt className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>{label}</dt>
                    <dd className="leading-7 whitespace-pre-wrap">{value || <span style={{ color: 'var(--muted)' }}>—</span>}</dd>
                  </div>
                );
              })}
            </dl>
          </section>
        </div>
        <div className="space-y-5">
          <NotesPanel
            submissionId={sub.id}
            currentUserId={user.id}
            notes={(notes ?? []).map((n: any) => ({
              id: n.id, body: n.body, created_at: n.created_at, author_id: n.author_id,
              author: n.author ?? null,
            }))}
          />
          <ActivityFeed
            activity={(activity ?? []).map((a: any) => ({
              id: a.id, action: a.action, meta: a.meta, created_at: a.created_at,
              actor: a.actor ?? null,
            }))}
            statusesById={statusesById}
            teamById={teamById}
          />
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div>
      <dt className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd dir={dir}>{value}</dd>
    </div>
  );
}
