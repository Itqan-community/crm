import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { archiveSubmissions } from '@/lib/admin-actions';

type MaybeSingleResult = { data: unknown; error: unknown };
type FinalResult = { error: unknown };

interface ChainSpy {
  calls: { method: string; args: unknown[] }[];
  selectArgs: unknown[][];
  updatePayloads: Record<string, unknown>[];
  inArgs: unknown[][];
  deleteCalled: boolean;
}

function makeChain(opts: {
  maybeSingle?: MaybeSingleResult;
  awaited?: FinalResult;
}): { chain: Record<string, unknown>; spy: ChainSpy } {
  const spy: ChainSpy = {
    calls: [],
    selectArgs: [],
    updatePayloads: [],
    inArgs: [],
    deleteCalled: false,
  };
  const chain: Record<string, unknown> = {};
  const track =
    (method: string) =>
    (...args: unknown[]) => {
      spy.calls.push({ method, args });
      if (method === 'select') spy.selectArgs.push(args);
      if (method === 'update') spy.updatePayloads.push(args[0] as Record<string, unknown>);
      if (method === 'in') spy.inArgs.push(args);
      if (method === 'delete') spy.deleteCalled = true;
      return chain;
    };
  chain.select = track('select');
  chain.update = track('update');
  chain.delete = track('delete');
  chain.insert = track('insert');
  chain.eq = track('eq');
  chain.in = (...args: unknown[]) => {
    spy.calls.push({ method: 'in', args });
    spy.inArgs.push(args);
    return Promise.resolve(opts.awaited ?? { error: null });
  };
  chain.maybeSingle = vi.fn(() => Promise.resolve(opts.maybeSingle ?? { data: null, error: null }));
  return { chain, spy };
}

function makeSupabase(opts: {
  user?: { id: string } | null;
  teamMember?: { id: string; role: string } | null;
  archivedStatus?: { id: string } | null;
  statusLookupError?: unknown;
  updateError?: unknown;
}) {
  const teamMembers = makeChain({
    maybeSingle: { data: opts.teamMember ?? null, error: null },
  });
  const statuses = makeChain({
    maybeSingle: { data: opts.archivedStatus ?? null, error: opts.statusLookupError ?? null },
  });
  const submissions = makeChain({ awaited: { error: opts.updateError ?? null } });

  const fromSpy = vi.fn((table: string) => {
    if (table === 'team_members') return teamMembers.chain;
    if (table === 'statuses') return statuses.chain;
    if (table === 'submissions') return submissions.chain;
    throw new Error(`unexpected table: ${table}`);
  });

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user === undefined ? { id: 'user-1' } : opts.user },
      }),
    },
    from: fromSpy,
  };

  return { supabase, teamMembers, statuses, submissions, fromSpy };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('archiveSubmissions', () => {
  it('is a no-op when given an empty array (no DB calls, no revalidate)', async () => {
    const ctx = makeSupabase({});
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await archiveSubmissions([]);

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(ctx.fromSpy).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('throws "unauthenticated" when no user is signed in', async () => {
    const ctx = makeSupabase({ user: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(archiveSubmissions(['s-1'])).rejects.toThrow('unauthenticated');
    expect(ctx.submissions.spy.updatePayloads).toHaveLength(0);
    expect(ctx.submissions.spy.deleteCalled).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('throws "forbidden" when signed-in user is not on the team', async () => {
    const ctx = makeSupabase({ user: { id: 'u-1' }, teamMember: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(archiveSubmissions(['s-1'])).rejects.toThrow('forbidden');
    expect(ctx.submissions.spy.updatePayloads).toHaveLength(0);
    expect(ctx.submissions.spy.deleteCalled).toBe(false);
  });

  it('throws "archived_status_missing" when the archived status row is absent', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      archivedStatus: null,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(archiveSubmissions(['s-1'])).rejects.toThrow('archived_status_missing');
    expect(ctx.submissions.spy.updatePayloads).toHaveLength(0);
    expect(ctx.submissions.spy.deleteCalled).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('propagates an error from the status lookup query', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      statusLookupError: { message: 'rls denied' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(archiveSubmissions(['s-1'])).rejects.toThrow('rls denied');
    expect(ctx.submissions.spy.updatePayloads).toHaveLength(0);
  });

  it('propagates an error from the bulk update', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      archivedStatus: { id: 'archived-id' },
      updateError: { message: 'update failed' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(archiveSubmissions(['s-1', 's-2'])).rejects.toThrow('update failed');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updates submissions with status_id only and uses .in() for bulk', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      archivedStatus: { id: 'archived-id' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await archiveSubmissions(['s-1', 's-2', 's-3']);

    // Exactly one update payload, exactly one .in() call
    expect(ctx.submissions.spy.updatePayloads).toEqual([{ status_id: 'archived-id' }]);
    expect(ctx.submissions.spy.inArgs).toEqual([['id', ['s-1', 's-2', 's-3']]]);
    // No fields besides status_id are touched
    const payload = ctx.submissions.spy.updatePayloads[0];
    expect(Object.keys(payload)).toEqual(['status_id']);
  });

  it('NEVER touches notes, submission_answers, or activity_log', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      archivedStatus: { id: 'archived-id' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await archiveSubmissions(['s-1']);

    const tablesTouched = ctx.fromSpy.mock.calls.map((c) => c[0]);
    expect(tablesTouched).not.toContain('notes');
    expect(tablesTouched).not.toContain('submission_answers');
    expect(tablesTouched).not.toContain('activity_log');
    // Sanity: only the three expected tables are touched
    expect(new Set(tablesTouched)).toEqual(new Set(['team_members', 'statuses', 'submissions']));
  });

  it('NEVER calls .delete() on any table', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      archivedStatus: { id: 'archived-id' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await archiveSubmissions(['s-1']);

    expect(ctx.submissions.spy.deleteCalled).toBe(false);
    expect(ctx.statuses.spy.deleteCalled).toBe(false);
    expect(ctx.teamMembers.spy.deleteCalled).toBe(false);
  });

  it('looks up the archived status by key, not by hardcoded id', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      archivedStatus: { id: 'whatever-uuid' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await archiveSubmissions(['s-1']);

    const eqCalls = ctx.statuses.spy.calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toEqual([{ method: 'eq', args: ['key', 'archived'] }]);
  });

  it('revalidates only /admin (not /admin/submissions/[id]) on success', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'member' },
      archivedStatus: { id: 'archived-id' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await archiveSubmissions(['s-1']);

    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('also works when called by an admin (not just a member)', async () => {
    const ctx = makeSupabase({
      user: { id: 'u-1' },
      teamMember: { id: 'u-1', role: 'admin' },
      archivedStatus: { id: 'archived-id' },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(archiveSubmissions(['s-1'])).resolves.toBeUndefined();
    expect(ctx.submissions.spy.updatePayloads).toEqual([{ status_id: 'archived-id' }]);
  });
});
