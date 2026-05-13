import { createSupabaseServerClient } from './supabase/server';
import type {
  FormCategoryRow,
  StatusRow,
  SubmissionRow,
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

const COLS = `id, reference_no, category_id, language, status_id, assignee_id,
  submitter_name, submitter_email, newsletter_optin, source,
  created_at, updated_at,
  category:form_categories(key, label_ar, label_en),
  status:statuses(key, label_ar, label_en, color),
  assignee:team_members(id, email, full_name)`;

export async function loadSubmissions(filters: SubmissionFilters): Promise<SubmissionListRow[]> {
  const supabase = await createSupabaseServerClient();

  // Resolve the archived-status id so we can exclude it by default.
  let archivedId: string | null = null;
  if (!filters.status && filters.include_archived !== '1') {
    const { data: archived } = await supabase
      .from('statuses')
      .select('id')
      .eq('key', 'archived')
      .maybeSingle();
    archivedId = archived?.id ?? null;
  }

  let q = supabase
    .from('submissions')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters.category) q = q.eq('category_id', filters.category);
  if (filters.status) q = q.eq('status_id', filters.status);
  else if (archivedId) q = q.neq('status_id', archivedId);
  if (filters.assignee === 'unassigned') q = q.is('assignee_id', null);
  else if (filters.assignee) q = q.eq('assignee_id', filters.assignee);

  if (filters.q) {
    // Escape PostgREST ilike meta-characters AND the escape character
    // itself. Without escaping `\`, a user-supplied string containing a
    // backslash (or following a `%` we just escaped) flips meaning of
    // subsequent characters — flagged by CodeQL `js/incomplete-sanitization`.
    const pattern = `%${filters.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
    q = q.or(
      `submitter_name.ilike.${pattern},submitter_email.ilike.${pattern},reference_no.ilike.${pattern}`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SubmissionListRow[];
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
