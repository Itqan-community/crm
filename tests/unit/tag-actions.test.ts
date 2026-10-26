import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  setSubmissionTags,
  upsertTag,
  deleteTag,
  upsertTagGroup,
  deleteTagGroup,
} from '@/lib/admin-actions/tags';

// Each table gets plain vi.fn "steps"; assertions read .mock.calls directly
// — no proxy magic. Chains are built so the real call shapes in the action
// (select().eq() awaited, insert(rows) awaited, delete().eq().in() awaited)
// all resolve to { data, error }-style results.
type Step = ReturnType<typeof vi.fn>;

function makeThenable(value: unknown) {
  return {
    then: (res: (v: unknown) => unknown, rej: (v: unknown) => unknown) =>
      Promise.resolve(value).then(res, rej),
  };
}

interface Ctx {
  supabase: unknown;
  steps: {
    teamSelect: Step; teamEq: Step;
    stSelect: Step; stSelectEq: Step; stInsert: Step;
    stDelete: Step; stDeleteEq: Step; stDeleteIn: Step;
    tagsInsert: Step; tagsUpdate: Step; tagsDelete: Step; tagsEq: Step;
    tgSelect: Step; tgSelectEq: Step;
    tgUpsert: Step; tgDelete: Step; tgDeleteEq: Step;
  };
}

function makeCtx(opts: {
  role?: 'admin' | 'member';
  currentSubmissionTags?: Array<{ tag_id: string }>;
  // undefined = default group exists; explicit null = group missing
  existingGroup?: { key: string } | null;
} = {}): Ctx {
  const member = { id: 'user-1', role: opts.role ?? 'member' };
  const current = opts.currentSubmissionTags ?? [];

  const teamSelect = vi.fn(() => ({ eq: teamEq }));
  const teamEq = vi.fn(() => ({
    maybeSingle: () => Promise.resolve({ data: member, error: null }),
  }));

  const stSelect = vi.fn(() => ({ eq: stSelectEq }));
  const stSelectEq = vi.fn(() => makeThenable({ data: current, error: null }));
  const stInsert = vi.fn(() => makeThenable({ error: null }));
  const stDelete = vi.fn(() => ({ eq: stDeleteEq }));
  const stDeleteEq = vi.fn(() => ({ in: stDeleteIn }));
  const stDeleteIn = vi.fn(() => makeThenable({ error: null }));

  const tagsInsert = vi.fn(() => makeThenable({ error: null }));
  const tagsUpdate = vi.fn(() => ({ eq: tagsEq }));
  const tagsEq = vi.fn(() => makeThenable({ error: null }));
  const tagsDelete = vi.fn(() => ({ eq: tagsEq }));

  // tag_groups: select().eq().maybeSingle() for the group check, upsert,
  // and delete().eq() for group removal.
  const tgSelect = vi.fn(() => ({ eq: tgSelectEq }));
  const tgSelectEq = vi.fn(() => ({
    maybeSingle: () =>
      Promise.resolve({
        data: opts.existingGroup === undefined ? { key: 'general' } : opts.existingGroup,
        error: null,
      }),
  }));
  const tgUpsert = vi.fn(() => makeThenable({ error: null }));
  const tgDelete = vi.fn(() => ({ eq: tgDeleteEq }));
  const tgDeleteEq = vi.fn(() => makeThenable({ error: null }));

  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn((table: string) => {
      if (table === 'submission_tags') {
        return { select: stSelect, insert: stInsert, delete: stDelete };
      }
      if (table === 'tags') {
        return { insert: tagsInsert, update: tagsUpdate, delete: tagsDelete };
      }
      if (table === 'tag_groups') {
        return { select: tgSelect, upsert: tgUpsert, delete: tgDelete };
      }
      if (table === 'team_members') return { select: teamSelect };
      throw new Error(`unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    steps: {
      teamSelect, teamEq,
      stSelect, stSelectEq, stInsert, stDelete, stDeleteEq, stDeleteIn,
      tagsInsert, tagsUpdate, tagsDelete, tagsEq,
      tgSelect, tgSelectEq, tgUpsert, tgDelete, tgDeleteEq,
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('setSubmissionTags — diff-based replace-set', () => {
  it('inserts only newly-selected tags and deletes only removed ones', async () => {
    const ctx = makeCtx({
      role: 'member',
      currentSubmissionTags: [{ tag_id: 'keep' }, { tag_id: 'drop' }],
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await setSubmissionTags('sub-1', ['keep', 'add']);

    expect(ctx.steps.stInsert).toHaveBeenCalledTimes(1);
    expect(ctx.steps.stInsert.mock.calls[0][0]).toEqual([
      { submission_id: 'sub-1', tag_id: 'add', assigned_by: 'user-1' },
    ]);
    expect(ctx.steps.stDeleteEq).toHaveBeenCalledWith('submission_id', 'sub-1');
    expect(ctx.steps.stDeleteIn).toHaveBeenCalledWith('tag_id', ['drop']);
  });

  it('de-duplicates incoming tag ids before diffing', async () => {
    const ctx = makeCtx({ currentSubmissionTags: [] });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await setSubmissionTags('sub-1', ['a', 'a', 'b']);

    expect(ctx.steps.stInsert.mock.calls[0][0]).toEqual([
      { submission_id: 'sub-1', tag_id: 'a', assigned_by: 'user-1' },
      { submission_id: 'sub-1', tag_id: 'b', assigned_by: 'user-1' },
    ]);
    expect(ctx.steps.stDelete).not.toHaveBeenCalled();
  });

  it('no-op when the selection already matches (no writes)', async () => {
    const ctx = makeCtx({ currentSubmissionTags: [{ tag_id: 'a' }] });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await setSubmissionTags('sub-1', ['a']);

    expect(ctx.steps.stInsert).not.toHaveBeenCalled();
    expect(ctx.steps.stDelete).not.toHaveBeenCalled();
  });
});

describe('upsertTag — validation', () => {
  const baseInput = {
    key: 'ok_key', label_ar: 'عام', label_en: 'General', kind: 'general',
    color: '#1B4332', position: 10, is_active: true,
  };

  // Keys the action normalises to lowercase, so these stay valid — only
  // post-normalisation violations reject.
  it.each([
    ['x'],            // too short
    ['has space'],    // spaces
    ['arabic_مفتاح'], // non-ascii
  ])('rejects bad key %j', async (key) => {
    const ctx = makeCtx({ role: 'admin' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(upsertTag({ ...baseInput, key })).rejects.toThrow('invalid_tag_key');
    expect(ctx.steps.tagsInsert).not.toHaveBeenCalled();
  });

  it('normalises a valid key to lowercase and inserts with its group', async () => {
    const ctx = makeCtx({ role: 'admin' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await upsertTag({ ...baseInput, key: 'My_Tag' });

    expect(ctx.steps.tagsInsert).toHaveBeenCalledTimes(1);
    expect(ctx.steps.tagsInsert.mock.calls[0][0]).toMatchObject({ key: 'my_tag', kind: 'general' });
  });

  it('rejects a tag whose group does not exist (unknown_group)', async () => {
    const ctx = makeCtx({ role: 'admin', existingGroup: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(upsertTag({ ...baseInput, kind: 'no_such_group' })).rejects.toThrow('unknown_group');
    expect(ctx.steps.tagsInsert).not.toHaveBeenCalled();
  });

  it('rejects empty labels', async () => {
    const ctx = makeCtx({ role: 'admin' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(upsertTag({ ...baseInput, label_ar: '' })).rejects.toThrow('label_ar_required');
  });

  it('rejects non-admin members (requireAdminAction)', async () => {
    const ctx = makeCtx({ role: 'member' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(upsertTag(baseInput)).rejects.toThrow('admin_required');
    expect(ctx.steps.tagsInsert).not.toHaveBeenCalled();
  });
});

describe('tag groups', () => {
  const groupInput = {
    key: 'expertise', label_ar: 'مستوى الخبرة', label_en: 'Expertise',
    position: 20, is_active: true,
  };

  it('upsertTagGroup upserts on key for admins', async () => {
    const ctx = makeCtx({ role: 'admin' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await upsertTagGroup(groupInput);

    expect(ctx.steps.tgUpsert).toHaveBeenCalledTimes(1);
    expect(ctx.steps.tgUpsert.mock.calls[0][0]).toMatchObject({ key: 'expertise' });
    expect(ctx.steps.tgUpsert.mock.calls[0][1]).toEqual({ onConflict: 'key' });
  });

  it('upsertTagGroup rejects bad keys and missing labels', async () => {
    const ctx = makeCtx({ role: 'admin' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(upsertTagGroup({ ...groupInput, key: 'BAD KEY' })).rejects.toThrow('invalid_tag_key');
    await expect(upsertTagGroup({ ...groupInput, label_ar: ' ' })).rejects.toThrow('label_ar_required');
    expect(ctx.steps.tgUpsert).not.toHaveBeenCalled();
  });

  it('upsertTagGroup rejects non-admins', async () => {
    const ctx = makeCtx({ role: 'member' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(upsertTagGroup(groupInput)).rejects.toThrow('admin_required');
  });

  it('deleteTagGroup maps FK restrict (23503) to group_in_use', async () => {
    const ctx = makeCtx({ role: 'admin' });
    ctx.steps.tgDeleteEq.mockImplementation(() => makeThenable({ error: { code: '23503', message: 'fk' } }));
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(deleteTagGroup('availability')).rejects.toThrow('group_in_use');
  });

  it('deleteTagGroup deletes by key for admins when empty', async () => {
    const ctx = makeCtx({ role: 'admin' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await deleteTagGroup('expertise');

    expect(ctx.steps.tgDelete).toHaveBeenCalledTimes(1);
    expect(ctx.steps.tgDeleteEq).toHaveBeenCalledWith('key', 'expertise');
  });
});

describe('deleteTag', () => {
  it('deletes by id for admins', async () => {
    const ctx = makeCtx({ role: 'admin' });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await deleteTag('tag-1');

    expect(ctx.steps.tagsDelete).toHaveBeenCalledTimes(1);
    expect(ctx.steps.tagsEq).toHaveBeenCalledWith('id', 'tag-1');
  });
});
