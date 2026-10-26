import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadSubmissions } from '@/lib/admin-queries';

interface QueryCall {
  method: string;
  args: unknown[];
}

interface QueryChain {
  chain: Record<string, unknown>;
  calls: QueryCall[];
}

function makeQuery(opts: {
  awaited?: { data: unknown; error: unknown };
  awaitedQueue?: Array<{ data: unknown; error: unknown }>;
  maybeSingle?: { data: unknown; error?: unknown };
}): QueryChain {
  const calls: QueryCall[] = [];
  const chain: Record<string, unknown> = {};
  const track = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  for (const m of ['select', 'order', 'limit', 'eq', 'neq', 'is', 'or', 'in']) {
    chain[m] = track(m);
  }
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve(opts.maybeSingle ?? { data: null, error: null }),
  );
  // Make the chain itself thenable so `await q` resolves to the awaited
  // result. A queue serves successive results (retry/fallback paths).
  const queue = [...(opts.awaitedQueue ?? [])];
  const defaultAwaited = opts.awaited ?? { data: [], error: null };
  chain.then = (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(queue.length > 0 ? queue.shift()! : defaultAwaited).then(resolve, reject);
  return { chain, calls };
}

function makeSupabase(opts: {
  archivedStatusId?: string | null;
  submissionsResult?: { data: unknown; error: unknown };
  submissionsQueue?: Array<{ data: unknown; error: unknown }>;
  submissionTagsResult?: { data: unknown; error?: unknown };
}) {
  const submissionsQuery = makeQuery(
    opts.submissionsQueue
      ? { awaitedQueue: opts.submissionsQueue }
      : { awaited: opts.submissionsResult ?? { data: [], error: null } },
  );
  const statusesQuery = makeQuery({
    maybeSingle: {
      data:
        opts.archivedStatusId === null
          ? null
          : { id: opts.archivedStatusId ?? 'archived-uuid' },
      error: null,
    },
  });
  const submissionTagsQuery = makeQuery({
    awaited: opts.submissionTagsResult
      ? { error: null, ...opts.submissionTagsResult }
      : { data: [], error: null },
  });
  const fromSpy = vi.fn((table: string) => {
    if (table === 'submissions') return submissionsQuery.chain;
    if (table === 'statuses') return statusesQuery.chain;
    if (table === 'submission_tags') return submissionTagsQuery.chain;
    throw new Error(`unexpected table: ${table}`);
  });
  return { from: fromSpy, submissionsQuery, statusesQuery, submissionTagsQuery };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('loadSubmissions — archived hiding', () => {
  it('excludes archived by default (no status filter, no include_archived)', async () => {
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({});

    // Status lookup happened
    const statusEqs = ctx.statusesQuery.calls.filter((c) => c.method === 'eq');
    expect(statusEqs).toEqual([{ method: 'eq', args: ['key', 'archived'] }]);

    // submissions query has a .neq on status_id with the archived id
    const neqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toEqual([{ method: 'neq', args: ['status_id', 'archived-uuid'] }]);
  });

  it('does NOT exclude archived when include_archived=1', async () => {
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ include_archived: '1' });

    const neqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toEqual([]);
    // Status lookup must be skipped entirely (saves a roundtrip)
    expect(ctx.statusesQuery.calls).toEqual([]);
  });

  it('does NOT exclude archived when an explicit status filter is set', async () => {
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ status: 'some-status-id' });

    // The user's explicit status filter goes through
    const eqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['status_id', 'some-status-id'] });
    // No neq exclusion is added on top
    const neqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toEqual([]);
    // Status lookup is skipped
    expect(ctx.statusesQuery.calls).toEqual([]);
  });

  it('lets user filter explicitly BY archived status (status filter wins)', async () => {
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    // User picks "status = archived-uuid" from the dropdown
    await loadSubmissions({ status: 'archived-uuid' });

    const eqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['status_id', 'archived-uuid'] });
    // No neq override that would silently empty the result
    const neqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toEqual([]);
  });

  it('does NOT crash if the archived status row is missing (defensive)', async () => {
    const ctx = makeSupabase({ archivedStatusId: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await expect(loadSubmissions({})).resolves.toEqual([]);
    // No neq applied since we couldn't find an id to exclude
    const neqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toEqual([]);
  });
});

describe('loadSubmissions — other filters still work alongside', () => {
  it('applies category filter together with default archived hiding', async () => {
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ category: 'cat-1' });

    const eqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['category_id', 'cat-1'] });
    const neqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toEqual([{ method: 'neq', args: ['status_id', 'archived-uuid'] }]);
  });

  it('applies assignee=unassigned (.is null) together with archived hiding', async () => {
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ assignee: 'unassigned' });

    const isCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'is');
    expect(isCalls).toEqual([{ method: 'is', args: ['assignee_id', null] }]);
  });

  it('applies search (q) with .or, archived hiding still active', async () => {
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ q: 'shams' });

    const orCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'or');
    expect(orCalls).toHaveLength(1);
    const orArg = orCalls[0].args[0] as string;
    expect(orArg).toContain('submitter_name.ilike.');
    expect(orArg).toContain('submitter_email.ilike.');
    expect(orArg).toContain('reference_no.ilike.');
    // Archived exclusion still in place
    const neqCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toEqual([{ method: 'neq', args: ['status_id', 'archived-uuid'] }]);
  });

  it('escapes ilike meta-characters AND the escape character itself in `q`', async () => {
    // Regression test for CodeQL js/incomplete-sanitization. The previous
    // pattern only escaped % and _; a backslash in the search input would
    // pass through unchanged and could re-enable the wildcards we just
    // escaped (e.g. user types `\%` → pattern becomes `\\%` which ilike
    // interprets as "literal backslash + match anything"). Verify all
    // three meta characters are now escaped.
    const ctx = makeSupabase({ archivedStatusId: 'archived-uuid' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ q: '50% off \\ test_user' });

    const orCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'or');
    const orArg = orCalls[0].args[0] as string;
    // Every ilike pattern in the OR string should contain the escaped forms.
    expect(orArg).toContain('50\\% off');
    expect(orArg).toContain('\\\\'); // the user's `\` got escaped to `\\`
    expect(orArg).toContain('test\\_user');
    // And NOT the unescaped meta characters in their search-string positions
    // (they only appear as the surrounding %... wildcards we add ourselves).
    expect(orArg).not.toMatch(/50%\s/); // the `%` in the input was escaped
  });

  it('always applies order(created_at desc) and limit(200)', async () => {
    const ctx = makeSupabase({});
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({});

    const orderCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'order');
    expect(orderCalls).toEqual([{ method: 'order', args: ['created_at', { ascending: false }] }]);
    const limitCalls = ctx.submissionsQuery.calls.filter((c) => c.method === 'limit');
    expect(limitCalls).toEqual([{ method: 'limit', args: [200] }]);
  });
});

describe('loadSubmissions — tag filter', () => {
  it('resolves matching submission ids from submission_tags, then constrains by .in(id)', async () => {
    const ctx = makeSupabase({
      archivedStatusId: 'archived-uuid',
      submissionTagsResult: {
        data: [
          { submission_id: 'sub-1' },
          { submission_id: 'sub-1' }, // duplicate across two selected tags
          { submission_id: 'sub-2' },
        ],
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ tags: 'tag-a,tag-b' });

    const tagIn = ctx.submissionTagsQuery.calls.filter((c) => c.method === 'in');
    expect(tagIn).toEqual([{ method: 'in', args: ['tag_id', ['tag-a', 'tag-b']] }]);
    const subIn = ctx.submissionsQuery.calls.filter((c) => c.method === 'in');
    // duplicates collapsed
    expect(subIn).toEqual([{ method: 'in', args: ['id', ['sub-1', 'sub-2']] }]);
  });

  it('returns [] without querying submissions when no submission carries the tag', async () => {
    const ctx = makeSupabase({ submissionTagsResult: { data: [] } });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await expect(loadSubmissions({ tags: 'tag-none' })).resolves.toEqual([]);
    expect(ctx.submissionsQuery.calls).toEqual([]);
  });

  it('ignores a blank/whitespace tags string (no submission_tags roundtrip)', async () => {
    const ctx = makeSupabase({ archivedStatusId: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await loadSubmissions({ tags: ' , ' });
    expect(ctx.submissionTagsQuery.calls).toEqual([]);
  });

  it('propagates submission_tags query errors', async () => {
    const ctx = makeSupabase({
      submissionTagsResult: { data: null, error: { message: 'rls denied' } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await expect(loadSubmissions({ tags: 'tag-a' })).rejects.toThrow('rls denied');
  });

  it('flattens the embedded tags relation into a sorted array per row', async () => {
    const row = {
      id: 'sub-1',
      tags: [
        { tag: { id: 't-2', key: 'evening', label_ar: 'مساءً', label_en: 'Evenings', kind: 'availability', color: '#DB2777', group: { position: 10 } } },
        { tag: { id: 't-1', key: 'dev', label_ar: 'مطور', label_en: 'Developer', kind: 'general', color: '#2563EB', group: { position: 0 } } },
        { tag: null },
      ],
    };
    const ctx = makeSupabase({ submissionsResult: { data: [row], error: null } });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    const rows = await loadSubmissions({});
    expect(rows[0].tags).toHaveLength(2);
    // group position drives order: general (0) before availability (10)
    expect(rows[0].tags[0].id).toBe('t-1');
    expect(rows[0].tags[1].id).toBe('t-2');
    // the group position itself is not part of the flattened output
    expect(rows[0].tags[0]).not.toHaveProperty('group');
  });

  it('falls back to a tags-less select when the embed cannot resolve (PGRST200, migration not applied)', async () => {
    const ctx = makeSupabase({
      archivedStatusId: null,
      submissionsQueue: [
        { data: null, error: { code: 'PGRST200', message: "Could not find a relationship between 'submissions' and 'submission_tags' in the schema cache" } },
        { data: [{ id: 'sub-1', submitter_name: 'قبل الهجرة' }], error: null },
      ],
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    const rows = await loadSubmissions({});
    expect(rows).toHaveLength(1);
    expect(rows[0].submitter_name).toBe('قبل الهجرة');
    expect(rows[0].tags).toEqual([]);
    // Two selects were built: with the embed, then without it.
    expect(ctx.submissionsQuery.calls.filter((c) => c.method === 'select')).toHaveLength(2);
  });
});

describe('loadSubmissions — error propagation', () => {
  it('throws when the submissions query returns an error', async () => {
    const ctx = makeSupabase({
      archivedStatusId: 'archived-uuid',
      submissionsResult: { data: null, error: { message: 'rls denied' } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await expect(loadSubmissions({})).rejects.toThrow('rls denied');
  });
});
