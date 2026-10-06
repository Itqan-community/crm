import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadSubmissions } from '@/lib/admin-queries';
import type { SubmissionListRow } from '@/lib/admin-queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = [
  reference: string,
  createdAt: string,
  name: string,
  email: string,
  category: string,
  status: string,
  tags: string,
  assignee: string,
];

const HEADERS = [
  'الرقم المرجعي', 'التاريخ', 'الاسم', 'البريد', 'الفئة', 'الحالة', 'التصنيفات', 'المسؤول',
];

function buildRows(submissions: SubmissionListRow[]): Row[] {
  return submissions.map((s) => [
    s.reference_no,
    s.created_at,
    s.submitter_name,
    s.submitter_email,
    s.category?.label_ar ?? '',
    s.status?.label_ar ?? '',
    s.tags.map((t) => t.label_ar).join('، '),
    s.assignee?.full_name || s.assignee?.email || '',
  ]);
}

const dateStamp = () => new Date().toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  // Same auth shape as /admin/export, plus the team-membership check the
  // sibling route skips — exports carry personal data.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('unauthorized', { status: 401 });
  const { data: tm } = await supabase
    .from('team_members')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!tm) return new NextResponse('forbidden', { status: 403 });

  const sp = req.nextUrl.searchParams;
  const submissions = await loadSubmissions({
    q: sp.get('q') ?? undefined,
    tags: sp.get('tags') ?? undefined,
    include_archived: sp.get('include_archived') ?? undefined,
  });
  const rows = buildRows(submissions);
  const format = sp.get('format') === 'xlsx' ? 'xlsx' : 'csv';

  if (format === 'xlsx') {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    const ws = wb.addWorksheet('التصنيفات', {
      // Sheet names and views RTL so Arabic reads right-to-left in Excel.
      views: [{ rightToLeft: true }],
    });
    ws.addRow(HEADERS);
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((col) => {
      col.width = 22;
    });
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="itqan-tags-${dateStamp()}.xlsx"`,
      },
    });
  }

  const csv = [HEADERS, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
  // Prepend BOM so Excel reads UTF-8 Arabic correctly
  const body = '\uFEFF' + csv;
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="itqan-tags-${dateStamp()}.csv"`,
    },
  });
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
