import { createSupabaseServerClient } from './supabase/server';
import type {
  FormCategoryRow,
  StatusRow,
  SubmissionRow,
  SubmissionSource,
  TeamMemberRow,
} from '@/types/database';

export type SubmissionListRow = SubmissionRow & {
  category: { key: string; label_ar: string; label_en: string } | null;
  status: { key: string; label_ar: string; label_en: string; color: string } | null;
  assignee: { id: string; email: string; full_name: string | null } | null;
};

export type SubmissionFilters = {
  q?: string;
  category?: string;
  status?: string;
  assignee?: string; // 'unassigned' | uuid | undefined
  include_archived?: string; // '1' to bypass the default archived-hidden filter
};

// Default source applied to rows when migration 0011 hasn't been applied
// yet — keeps the page functional in that interim window.
const DEFAULT_SOURCE: SubmissionSource = { channel: 'form', referral: null };

// Postgres "undefined column" error code — surfaced by Supabase via
// `error.code` when the SELECT references a column that doesn't exist.
const PG_UNDEFINED_COLUMN = '42703';

const COLS_BASE = `id, reference_no, category_id, language, status_id, assignee_id,
  submitter_name, submitter_email, newsletter_optin,
  created_at, updated_at,
  category:form_categories(key, label_ar, label_en),
  status:statuses(key, label_ar, label_en, color),
  assignee:team_members(id, email, full_name)`;
const COLS_WITH_SOURCE = COLS_BASE.replace(
  'newsletter_optin,',
  'newsletter_optin, source,',
);

export async function loadSubmissions(filters: SubmissionFilters): Promise<SubmissionListRow[]> {
  const supabase = await createSupabaseServerClient();

  // Resolve the archived-status id once up front so the same value is used
  // by both query attempts (the `with-source` first pass and the
  // pre-migration fallback).
  let archivedId: string | null = null;
  if (!filters.status && filters.include_archived !== '1') {
    const { data: archived } = await supabase
      .from('statuses')
      .select('id')
      .eq('key', 'archived')
      .maybeSingle();
    archivedId = archived?.id ?? null;
  }

  const buildQuery = (cols: string) => {
    let q = supabase
      .from('submissions')
      .select(cols)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters.category) q = q.eq('category_id', filters.category);
    if (filters.status) q = q.eq('status_id', filters.status);
    else if (archivedId) q = q.neq('status_id', archivedId);
    if (filters.assignee === 'unassigned') q = q.is('assignee_id', null);
    else if (filters.assignee) q = q.eq('assignee_id', filters.assignee);

    if (filters.q) {
      const pattern = `%${filters.q.trim().replace(/[%_]/g, '\\$&')}%`;
      q = q.or(
        `submitter_name.ilike.${pattern},submitter_email.ilike.${pattern},reference_no.ilike.${pattern}`,
      );
    }
    return q;
  };

  // Try with `source`. If migration 0011 hasn't run yet, Supabase reports
  // 42703 (undefined_column); fall back to the legacy column set and stamp
  // every row with the public-form default so the rest of the page renders.
  const first = await buildQuery(COLS_WITH_SOURCE);
  if (!first.error) {
    return (first.data ?? []) as unknown as SubmissionListRow[];
  }
  if (first.error.code !== PG_UNDEFINED_COLUMN) {
    throw new Error(first.error.message);
  }

  const fallback = await buildQuery(COLS_BASE);
  if (fallback.error) throw new Error(fallback.error.message);
  const rows = (fallback.data ?? []) as unknown as Omit<SubmissionListRow, 'source'>[];
  return rows.map((r) => ({ ...r, source: DEFAULT_SOURCE }));
}

export async function loadStatuses(): Promise<StatusRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('statuses').select('*').order('position');
  return (data ?? []) as StatusRow[];
}

export async function loadCategories(includeInactive = false): Promise<FormCategoryRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from('form_categories').select('*').order('position');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data } = await q;
  return (data ?? []) as FormCategoryRow[];
}

export async function loadTeam(): Promise<TeamMemberRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('team_members').select('*').order('email');
  return (data ?? []) as TeamMemberRow[];
}

export async function loadAllowedEmails() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('allowed_emails').select('*').order('email');
  return data ?? [];
}
