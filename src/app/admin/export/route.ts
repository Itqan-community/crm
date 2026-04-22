import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadSubmissions } from '@/lib/admin-queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });

  const sp = req.nextUrl.searchParams;
  const submissions = await loadSubmissions({
    q: sp.get('q') ?? undefined,
    category: sp.get('category') ?? undefined,
    status: sp.get('status') ?? undefined,
    assignee: sp.get('assignee') ?? undefined,
  });

  // Pull all answers for selected submissions in one query.
  const ids = submissions.map((s) => s.id);
  const { data: answers } = await supabase
    .from('submission_answers')
    .select('submission_id, field_key_snap, field_label_snap, value_text, value_json')
    .in('submission_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  // Collect every distinct field key across selection (in deterministic order)
  const keyOrder: string[] = [];
  const keyLabels: Record<string, string> = {};
  for (const a of answers || []) {
    if (!keyLabels[a.field_key_snap]) {
      keyLabels[a.field_key_snap] = (a.field_label_snap as { ar: string }).ar;
      keyOrder.push(a.field_key_snap);
    }
  }

  const ansBySubmission = new Map<string, Map<string, string>>();
  for (const a of answers || []) {
    if (!ansBySubmission.has(a.submission_id)) ansBySubmission.set(a.submission_id, new Map());
    const v = a.value_text != null
      ? a.value_text
      : Array.isArray(a.value_json)
        ? (a.value_json as unknown[]).join(' | ')
        : '';
    ansBySubmission.get(a.submission_id)!.set(a.field_key_snap, v);
  }

  const headers = [
    'reference_no', 'created_at', 'category', 'status', 'assignee',
    'submitter_name', 'submitter_email', 'newsletter_optin', 'language',
    ...keyOrder.map((k) => keyLabels[k]),
  ];
  const rows: string[][] = [headers];
  for (const s of submissions) {
    const ans = ansBySubmission.get(s.id) ?? new Map<string, string>();
    rows.push([
      s.reference_no,
      s.created_at,
      s.category?.label_ar ?? '',
      s.status?.label_ar ?? '',
      s.assignee?.full_name || s.assignee?.email || '',
      s.submitter_name,
      s.submitter_email,
      s.newsletter_optin ? 'نعم' : 'لا',
      s.language,
      ...keyOrder.map((k) => ans.get(k) ?? ''),
    ]);
  }

  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  // Prepend BOM so Excel reads UTF-8 Arabic correctly
  const body = '\uFEFF' + csv;
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="itqan-submissions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function escapeCsv(s: string | number | boolean): string {
  const v = String(s ?? '');
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
