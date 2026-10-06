import { createSupabaseServerClient } from './supabase/server';
import type {
  FormCategoryRow,
  StatusRow,
  SubmissionRow,
  TagGroupRow,
  TagRow,
  TeamMemberRow,
} from '@/types/database';

export type SubmissionTag = Pick<
  TagRow,
  'id' | 'key' | 'label_ar' | 'label_en' | 'kind' | 'color'
>;

export type SubmissionListRow = SubmissionRow & {
  category: { key: string; label_ar: string; label_en: string } | null;
  status: { key: string; label_ar: string; label_en: string; color: string } | null;
  assignee: { id: string; email: string; full_name: string | null } | null;
  tags: SubmissionTag[];
};

export type SubmissionFilters = {
  q?: string;
  category?: string;
  status?: string;
  assignee?: string; // 'unassigned' | uuid | undefined
  include_archived?: string; // '1' to bypass the default archived-hidden filter
  tags?: string; // comma-separated tag ids — submission must carry ANY of them
};

const COLS = `id, reference_no, category_id, language, status_id, assignee_id,
  submitter_name, submitter_email, newsletter_optin, source,
  created_at, updated_at,
  category:form_categories(key, label_ar, label_en),
  status:statuses(key, label_ar, label_en, color),
  assignee:team_members(id, email, full_name),
  tags:submission_tags(tag:tags(id, key, label_ar, label_en, kind, color, position, group:tag_groups(position)))`;

// Same select without the tags embed — used as the deploy-order fallback
// when migration 0016 hasn't been applied yet.
const COLS_NO_TAGS = `id, reference_no, category_id, language, status_id, assignee_id,
  submitter_name, submitter_email, newsletter_optin, source,
  created_at, updated_at,
  category:form_categories(key, label_ar, label_en),
  status:statuses(key, label_ar, label_en, color),
  assignee:team_members(id, email, full_name)`;

// General tags are the primary identity axis (مطور/مصمم/متطوع), so they
// read first; other groups follow by their own position. Group order
// arrives through the embed (`group:tag_groups(position)`); tags whose
// group is missing sort last, then by Arabic label.
// Group order arrives through the embed (`group:tag_groups(position)`);
// both the helper field and the raw embed are stripped from the output.
function sortTags(tags: Array<SubmissionTag & { groupPos?: number | null; group?: unknown }>): SubmissionTag[] {
  return [...tags]
    .sort(
      (a, b) =>
        (a.groupPos ?? 9_999) - (b.groupPos ?? 9_999) ||
        a.label_ar.localeCompare(b.label_ar, 'ar'),
    )
    .map(({ groupPos: _groupPos, group: _group, ...tag }) => tag);
}

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

  // Tag filter: resolve matching submission ids first, then constrain the
  // main query (PostgREST has no sub-select). ANY-of semantics. A string
  // that cleans down to nothing (e.g. " , ") means no filter at all.
  let tagIds: string[] | null = null;
  if (filters.tags) {
    const parsed = filters.tags.split(',').map((t) => t.trim()).filter(Boolean);
    tagIds = parsed.length > 0 ? parsed : null;
  }
  let taggedSubmissionIds: string[] | null = null;
  if (tagIds) {
    const { data: links, error: linkErr } = await supabase
      .from('submission_tags')
      .select('submission_id')
      .in('tag_id', tagIds);
    if (linkErr) throw new Error(linkErr.message);
    taggedSubmissionIds = [...new Set((links ?? []).map((l) => l.submission_id))];
    if (taggedSubmissionIds.length === 0) return [];
  }

  const buildQuery = (withTags: boolean) => {
    let q = supabase
      .from('submissions')
      .select(withTags ? COLS : COLS_NO_TAGS)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters.category) q = q.eq('category_id', filters.category);
    if (filters.status) q = q.eq('status_id', filters.status);
    else if (archivedId) q = q.neq('status_id', archivedId);
    if (filters.assignee === 'unassigned') q = q.is('assignee_id', null);
    else if (filters.assignee) q = q.eq('assignee_id', filters.assignee);
    if (taggedSubmissionIds) q = q.in('id', taggedSubmissionIds);

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
    return q;
  };

  // PostgREST returns the embed as [{ tag: {...} } | null]; flatten it.
  type RawTag = {
    tag?: (SubmissionTag & { group?: { position?: number } | null }) | null;
  };
  type RawRow = Omit<SubmissionListRow, 'tags'> & { tags?: RawTag[] | null };
  const flatten = (rows: RawRow[]): SubmissionListRow[] =>
    rows.map(({ tags, ...rest }) => ({
      ...rest,
      tags: sortTags(
        (tags ?? [])
          .filter((t): t is { tag: SubmissionTag & { group?: { position?: number } | null } } => !!t?.tag)
          .map((t) => ({ ...t.tag, groupPos: t.tag.group?.position })),
      ),
    }));

  const { data, error } = await buildQuery(true);
  if (error?.code === 'PGRST200') {
    // The tags tables (migration 0016) aren't applied yet, so the embed
    // can't resolve in PostgREST's schema cache. Retry once without it so
    // the list still renders — the same deploy-order safety the detail
    // page has for 0011's `source` column.
    const fallback = await buildQuery(false);
    if (fallback.error) throw new Error(fallback.error.message);
    return ((fallback.data ?? []) as unknown as RawRow[]).map((row) => ({
      ...row,
      tags: [] as SubmissionTag[],
    }));
  }
  if (error) throw new Error(error.message);
  return flatten((data ?? []) as unknown as RawRow[]);
}

// Pre-migration safety: if 0016/0017 haven't been applied the tables are
// missing. Rendering an empty list beats breaking the whole page — the
// submissions page loads this in its Promise.all.
export async function loadTagGroups(includeInactive = false): Promise<TagGroupRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from('tag_groups').select('*').order('position');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) {
    console.error('[loadTagGroups] query failed', error.message);
    return [];
  }
  return (data ?? []) as TagGroupRow[];
}

export async function loadTags(includeInactive = false): Promise<TagRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from('tags').select('*').order('kind').order('position');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) {
    console.error('[loadTags] query failed', error.message);
    return [];
  }
  return (data ?? []) as TagRow[];
}

export async function loadSubmissionTags(submissionId: string): Promise<SubmissionTag[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('submission_tags')
    .select('tag:tags(id, key, label_ar, label_en, kind, color, position, group:tag_groups(position))')
    .eq('submission_id', submissionId);
  if (error) {
    console.error('[loadSubmissionTags] query failed', error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as Array<{
    tag: (SubmissionTag & { group?: { position?: number } | null }) | null;
  }>;
  return sortTags(rows.filter((r) => r.tag).map((r) => ({ ...r.tag!, groupPos: r.tag!.group?.position })));
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
