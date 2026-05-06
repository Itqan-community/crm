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
  maybeSingle?: { data: unknown; error?: unknown };
}): QueryChain {
  const calls: QueryCall[] = [];
  const chain: Record<string, unknown> = {};
  const track = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };
  for (const m of ['select', 'order', 'limit', 'eq', 'neq', 'is', 'or']) {
    chain[m] = track(m);
  }
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve(opts.maybeSingle ?? { data: null, error: null }),
  );
  // Make the chain itself thenable so `await q` resolves to the awaited result.
  const awaited = opts.awaited ?? { data: [], error: null };
  chain.then = (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(awaited).then(resolve, reject);
  return { chain, calls };
}

function makeSupabase(opts: {
  archivedStatusId?: string | null;
  submissionsResult?: { data: unknown; error: unknown };
}) {
  const submissionsQuery = makeQuery({
    awaited: opts.submissionsResult ?? { data: [], error: null },
  });
  const statusesQuery = makeQuery({
    maybeSingle: {
      data:
        opts.archivedStatusId === null
          ? null
          : { id: opts.archivedStatusId ?? 'archived-uuid' },
      error: null,
    },
  });
  const fromSpy = vi.fn((table: string) => {
    if (table === 'submissions') return submissionsQuery.chain;
    if (table === 'statuses') return statusesQuery.chain;
    throw new Error(`unexpected table: ${table}`);
  });
  return { from: fromSpy, submissionsQuery, statusesQuery };
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

// ---------------------------------------------------------------------------
// Pre-migration fallback: when migration 0011 hasn't been applied to the
// Supabase project yet, the SELECT for `source` returns 42703. We retry
// without that column and stamp every row with the public-form default,
// so /admin keeps rendering during the deploy gap.
// ---------------------------------------------------------------------------

describe('loadSubmissions — source-column fallback', () => {
  function makeFallbackSupabase(opts: {
    firstResult: { data: unknown; error: unknown };
    secondResult: { data: unknown; error: unknown };
  }) {
    const submissionsCalls: { method: string; args: unknown[] }[] = [];
    let attempt = 0;

    const buildSubmissionsChain = () => {
      const c: Record<string, unknown> = {};
      const track = (method: string) => (...args: unknown[]) => {
        submissionsCalls.push({ method, args });
        return c;
      };
      for (const m of ['select', 'order', 'limit', 'eq', 'neq', 'is', 'or']) {
        c[m] = track(m);
      }
      const result = attempt === 0 ? opts.firstResult : opts.secondResult;
      attempt += 1;
      c.then = (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return c;
    };

    const statusesQuery = makeQuery({
      maybeSingle: { data: { id: 'archived-uuid' }, error: null },
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'submissions') return buildSubmissionsChain();
      if (table === 'statuses') return statusesQuery.chain;
      throw new Error(`unexpected table: ${table}`);
    });
    return { from: fromSpy, submissionsCalls, getAttempts: () => attempt };
  }

  it('retries without `source` and defaults the channel to "form" on 42703', async () => {
    const ctx = makeFallbackSupabase({
      firstResult: {
        data: null,
        error: { code: '42703', message: 'column "source" does not exist' },
      },
      secondResult: {
        data: [
          { id: 'a', reference_no: 'ITQ-1', submitter_name: 'A', submitter_email: 'a@x.x' },
          { id: 'b', reference_no: 'ITQ-2', submitter_name: 'B', submitter_email: 'b@x.x' },
        ],
        error: null,
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    const rows = await loadSubmissions({});

    expect(ctx.getAttempts()).toBe(2);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.source).toEqual({ channel: 'form', referral: null });
    }
  });

  it('does NOT retry on a non-42703 error — rls denials still surface', async () => {
    const ctx = makeFallbackSupabase({
      firstResult: { data: null, error: { code: '42501', message: 'rls denied' } },
      secondResult: { data: [], error: null }, // never read
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    await expect(loadSubmissions({})).rejects.toThrow('rls denied');
    expect(ctx.getAttempts()).toBe(1);
  });

  it('uses a single SELECT (no fallback) once the migration is applied', async () => {
    const ctx = makeFallbackSupabase({
      firstResult: {
        data: [
          {
            id: 'a',
            reference_no: 'ITQ-1',
            submitter_name: 'A',
            submitter_email: 'a@x.x',
            source: { channel: 'phone', referral: null },
          },
        ],
        error: null,
      },
      secondResult: { data: [], error: null }, // never read
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: ctx.from } as never);

    const rows = await loadSubmissions({});
    expect(ctx.getAttempts()).toBe(1);
    expect(rows[0].source).toEqual({ channel: 'phone', referral: null });
  });
});
