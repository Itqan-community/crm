import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createManualSubmission } from '@/lib/admin-actions';

// ---------------------------------------------------------------------------
// Test helpers — model a Supabase chain we can poke at.
// ---------------------------------------------------------------------------

interface ChainCall {
  method: string;
  args: unknown[];
}

interface ChainSpy {
  calls: ChainCall[];
  insertPayloads: unknown[];
}

type ChainResolution = {
  // Returned from `await supabase.from(...).insert(...).select(...).single()`
  single?: { data: unknown; error: unknown };
  // Returned from `await supabase.from(...).select(...).maybeSingle()`
  maybeSingle?: { data: unknown; error: unknown };
  // Returned from `await supabase.from(...).select(...).eq(...).eq(...)` (terminal await on the chain)
  awaited?: { data: unknown; error: unknown };
  // Returned from `await supabase.from(...).insert(...)` (insert without select).
  // `data` is optional because the production code only reads `error` here.
  insertResult?: { data?: unknown; error: unknown };
};

function makeChain(resolutions: ChainResolution = {}) {
  const spy: ChainSpy = { calls: [], insertPayloads: [] };
  const chain: Record<string, unknown> = {};
  const track =
    (method: string) =>
    (...args: unknown[]) => {
      spy.calls.push({ method, args });
      if (method === 'insert') spy.insertPayloads.push(args[0]);
      return chain;
    };
  for (const m of ['select', 'eq', 'order', 'limit', 'delete', 'update']) {
    chain[m] = track(m);
  }
  // `insert` may be terminal (await directly) OR chained with .select(...).single().
  // We always record the payload, then return the chain so .select+.single work.
  chain.insert = (...args: unknown[]) => {
    spy.calls.push({ method: 'insert', args });
    spy.insertPayloads.push(args[0]);
    // Return a thenable-or-chainable object: callers either chain .select().single()
    // or await the result directly. We support both via a Proxy-ish object.
    return {
      // Chained insert path: insert(...).select(cols).single()
      select: (...selectArgs: unknown[]) => {
        spy.calls.push({ method: 'select', args: selectArgs });
        return {
          single: () =>
            Promise.resolve(resolutions.single ?? { data: null, error: null }),
        };
      },
      // Terminal insert path: await supabase.from(x).insert(y)
      then: (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
        Promise.resolve(resolutions.insertResult ?? { error: null }).then(
          resolve,
          reject,
        ),
    };
  };
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve(resolutions.maybeSingle ?? { data: null, error: null }),
  );
  // Terminal await on the chain (e.g. `await supabase.from(x).select(y).eq(z, w)`).
  chain.then = (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(resolutions.awaited ?? { data: [], error: null }).then(
      resolve,
      reject,
    );
  return { chain, spy };
}

type MockSetup = {
  user?: { id: string } | null;
  teamMember?: { id: string; role: string } | null;
  category?: { id: string; is_active: boolean } | null;
  categoryError?: unknown;
  fields?: Array<Record<string, unknown>>;
  fieldsError?: unknown;
  // submission INSERT result (.insert(...).select(...).single())
  submissionInsert?: { data: unknown; error: unknown };
  // submission_answers INSERT result (terminal await on the insert chain)
  answersInsert?: { data?: unknown; error: unknown };
  // notes INSERT result (terminal await on the insert chain)
  notesInsert?: { data?: unknown; error: unknown };
};

function makeSupabase(setup: MockSetup = {}) {
  const teamMembers = makeChain({
    maybeSingle: { data: setup.teamMember ?? null, error: null },
  });
  const formCategories = makeChain({
    maybeSingle: {
      data: setup.category ?? null,
      error: setup.categoryError ?? null,
    },
  });
  const formFields = makeChain({
    awaited: { data: setup.fields ?? [], error: setup.fieldsError ?? null },
  });
  const submissions = makeChain({
    single: setup.submissionInsert ?? {
      data: { id: 'sub-1', reference_no: 'ITQ-AAAAA-BBB' },
      error: null,
    },
  });
  const submissionAnswers = makeChain({
    insertResult: setup.answersInsert ?? { error: null },
  });
  const notes = makeChain({
    insertResult: setup.notesInsert ?? { error: null },
  });

  const tables: Record<string, ReturnType<typeof makeChain>> = {
    team_members: teamMembers,
    form_categories: formCategories,
    form_fields: formFields,
    submissions,
    submission_answers: submissionAnswers,
    notes,
  };
  const fromSpy = vi.fn((table: string) => {
    const t = tables[table];
    if (!t) throw new Error(`unexpected table: ${table}`);
    return t.chain;
  });

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: setup.user === undefined ? { id: 'user-1' } : setup.user,
        },
      }),
    },
    from: fromSpy,
  };
  return { supabase, tables, fromSpy };
}

const ACTIVE_CATEGORY = { id: 'cat-1', is_active: true };
const TEAM_MEMBER = { id: 'user-1', role: 'member' };

const VALID_INPUT = {
  category_id: 'cat-1',
  language: 'ar' as const,
  submitter_name: 'فاطمة الزهراء',
  submitter_email: 'fatima@example.com',
  submitter_phone: null,
  source: { channel: 'phone' as const, referral: null },
  custom_answers: {},
  notes: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

describe('createManualSubmission — auth', () => {
  it('throws "unauthenticated" when no user is signed in', async () => {
    const ctx = makeSupabase({ user: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(createManualSubmission(VALID_INPUT)).rejects.toThrow('unauthenticated');
    expect(ctx.tables.submissions.spy.insertPayloads).toHaveLength(0);
  });

  it('throws "forbidden" when signed-in user is not on the team', async () => {
    const ctx = makeSupabase({ user: { id: 'u-1' }, teamMember: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(createManualSubmission(VALID_INPUT)).rejects.toThrow('forbidden');
    expect(ctx.tables.submissions.spy.insertPayloads).toHaveLength(0);
  });

  it('lets a regular team member (role=member) create a submission', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: { id: 'user-1', role: 'member' },
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(createManualSubmission(VALID_INPUT)).resolves.toEqual({
      id: 'sub-1',
      reference_no: 'ITQ-AAAAA-BBB',
    });
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('createManualSubmission — input validation', () => {
  function authedCtx(extra: MockSetup = {}) {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      ...extra,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);
    return ctx;
  }

  it('rejects missing name', async () => {
    authedCtx();
    await expect(
      createManualSubmission({ ...VALID_INPUT, submitter_name: '   ' }),
    ).rejects.toThrow('name_required');
  });

  it('rejects when both email and phone are empty', async () => {
    authedCtx();
    await expect(
      createManualSubmission({
        ...VALID_INPUT,
        submitter_email: '',
        submitter_phone: '',
      }),
    ).rejects.toThrow('contact_required');
  });

  it('rejects malformed email', async () => {
    authedCtx();
    await expect(
      createManualSubmission({ ...VALID_INPUT, submitter_email: 'not-an-email' }),
    ).rejects.toThrow('invalid_email');
  });

  it('rejects unparseable phone', async () => {
    authedCtx();
    await expect(
      createManualSubmission({
        ...VALID_INPUT,
        submitter_email: null,
        submitter_phone: '123', // far too short to parse
      }),
    ).rejects.toThrow('invalid_phone');
  });

  it('rejects an unknown channel string (defense in depth)', async () => {
    authedCtx();
    await expect(
      createManualSubmission({
        ...VALID_INPUT,
        // Bypass the TS literal check — a malicious caller could ship anything
        source: { channel: 'sms' as unknown as 'phone', referral: null },
      }),
    ).rejects.toThrow('invalid_channel');
  });

  it('rejects when the category does not exist or is not active', async () => {
    authedCtx({ category: null });
    await expect(createManualSubmission(VALID_INPUT)).rejects.toThrow(
      'unknown_category',
    );
  });
});

// ---------------------------------------------------------------------------
// Persistence: source, phone, custom answers, notes
// ---------------------------------------------------------------------------

describe('createManualSubmission — source persistence', () => {
  it('writes channel + referral note to the submissions row', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      source: { channel: 'event', referral: 'مؤتمر الذكاء الاصطناعي' },
    });

    const payload = ctx.tables.submissions.spy.insertPayloads[0] as {
      source: { channel: string; referral: string | null };
    };
    expect(payload.source).toEqual({
      channel: 'event',
      referral: 'مؤتمر الذكاء الاصطناعي',
    });
  });

  it('truncates an oversized referral note (defends jsonb against bloat)', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    const oversize = 'x'.repeat(5_000);
    await createManualSubmission({
      ...VALID_INPUT,
      source: { channel: 'phone', referral: oversize },
    });

    const payload = ctx.tables.submissions.spy.insertPayloads[0] as {
      source: { referral: string };
    };
    expect(payload.source.referral!.length).toBeLessThanOrEqual(500);
  });

  it('coerces an empty/whitespace referral note to null', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      source: { channel: 'phone', referral: '   ' },
    });

    const payload = ctx.tables.submissions.spy.insertPayloads[0] as {
      source: { referral: string | null };
    };
    expect(payload.source.referral).toBeNull();
  });

  it('lowercases the email and trims the name before storing', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      submitter_name: '   عبدالرحمن   ',
      submitter_email: 'Foo@Example.COM',
    });

    const payload = ctx.tables.submissions.spy.insertPayloads[0] as {
      submitter_name: string;
      submitter_email: string;
    };
    expect(payload.submitter_name).toBe('عبدالرحمن');
    expect(payload.submitter_email).toBe('foo@example.com');
  });
});

describe('createManualSubmission — phone & custom answers', () => {
  it('persists the phone as an answer against the category phone field, in E.164', async () => {
    const phoneField = {
      id: 'fld-phone',
      key: 'phone',
      label_ar: 'رقم الهاتف',
      label_en: 'Phone',
      semantic_role: 'phone',
    };
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      fields: [phoneField],
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      submitter_email: null,
      submitter_phone: '+966 50 123 4567', // human-friendly with spaces
    });

    const answers = ctx.tables.submission_answers.spy.insertPayloads[0] as Array<{
      field_id: string;
      value_text: string;
    }>;
    expect(answers).toHaveLength(1);
    expect(answers[0].field_id).toBe('fld-phone');
    expect(answers[0].value_text).toMatch(/^\+966/); // E.164, no spaces
  });

  it('skips the phone answer when the category has no phone field', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      fields: [],
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      submitter_email: null,
      submitter_phone: '+966501234567',
    });

    expect(ctx.tables.submission_answers.spy.insertPayloads).toHaveLength(0);
  });

  it('persists non-empty custom answers and skips empty ones', async () => {
    const fields = [
      {
        id: 'fld-org',
        key: 'organization',
        label_ar: 'المنظمة',
        label_en: 'Organization',
        semantic_role: null,
      },
      {
        id: 'fld-empty',
        key: 'empty_one',
        label_ar: 'فارغ',
        label_en: 'Empty',
        semantic_role: null,
      },
      {
        id: 'fld-tags',
        key: 'tags',
        label_ar: 'الوسوم',
        label_en: 'Tags',
        semantic_role: null,
      },
    ];
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      fields,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      custom_answers: {
        'fld-org': 'إتقان',
        'fld-empty': '',
        'fld-tags': ['educational', 'partnership'],
        'fld-unknown': 'should be ignored',
      },
    });

    const answers = ctx.tables.submission_answers.spy.insertPayloads[0] as Array<{
      field_key_snap: string;
      value_text: string | null;
      value_json: unknown;
    }>;
    const byKey = Object.fromEntries(answers.map((a) => [a.field_key_snap, a]));
    expect(Object.keys(byKey).sort()).toEqual(['organization', 'tags']);
    expect(byKey.organization.value_text).toBe('إتقان');
    expect(byKey.organization.value_json).toBeNull();
    expect(byKey.tags.value_text).toBeNull();
    expect(byKey.tags.value_json).toEqual(['educational', 'partnership']);
  });

  it('skips name/email/phone fields from custom_answers (handled separately)', async () => {
    const fields = [
      { id: 'fld-name', key: 'name', label_ar: 'الاسم', label_en: 'Name', semantic_role: 'name' },
      { id: 'fld-email', key: 'email', label_ar: 'البريد', label_en: 'Email', semantic_role: 'email' },
      { id: 'fld-org', key: 'organization', label_ar: 'المنظمة', label_en: 'Org', semantic_role: null },
    ];
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      fields,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      custom_answers: {
        'fld-name': 'مكرر',
        'fld-email': 'duplicate@example.com',
        'fld-org': 'إتقان',
      },
    });

    const answers = ctx.tables.submission_answers.spy.insertPayloads[0] as Array<{
      field_key_snap: string;
    }>;
    expect(answers.map((a) => a.field_key_snap)).toEqual(['organization']);
  });
});

describe('createManualSubmission — notes', () => {
  it('inserts a note when one was provided', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({
      ...VALID_INPUT,
      notes: 'تم اللقاء في معرض LEAP — ينتظر اتصال خلال أسبوع.',
    });

    const payload = ctx.tables.notes.spy.insertPayloads[0] as {
      submission_id: string;
      author_id: string;
      body: string;
    };
    expect(payload.submission_id).toBe('sub-1');
    expect(payload.author_id).toBe('user-1');
    expect(payload.body).toContain('LEAP');
  });

  it('does NOT insert a note when notes is null/empty/whitespace', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission({ ...VALID_INPUT, notes: '   ' });
    expect(ctx.tables.notes.spy.insertPayloads).toHaveLength(0);
  });

  it('does not abort the whole flow if the note insert fails', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      notesInsert: { error: { message: 'rls denied' } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(
      createManualSubmission({ ...VALID_INPUT, notes: 'something useful' }),
    ).resolves.toEqual({ id: 'sub-1', reference_no: 'ITQ-AAAAA-BBB' });
  });
});

// ---------------------------------------------------------------------------
// Failure paths
// ---------------------------------------------------------------------------

describe('createManualSubmission — failure paths', () => {
  it('translates Postgres 42703 into "migration_required"', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      submissionInsert: {
        data: null,
        error: { code: '42703', message: 'column "source" does not exist' },
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(createManualSubmission(VALID_INPUT)).rejects.toThrow(
      'migration_required',
    );
  });

  it('cleans up the orphan submission if answers insert fails', async () => {
    const phoneField = {
      id: 'fld-phone',
      key: 'phone',
      label_ar: 'الهاتف',
      label_en: 'Phone',
      semantic_role: 'phone',
    };
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
      fields: [phoneField],
      answersInsert: { error: { message: 'rls denied' } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await expect(
      createManualSubmission({
        ...VALID_INPUT,
        submitter_email: null,
        submitter_phone: '+966501234567',
      }),
    ).rejects.toThrow('rls denied');

    // The cleanup deletes the submission row
    const submissionMethods = ctx.tables.submissions.spy.calls.map((c) => c.method);
    expect(submissionMethods).toContain('delete');
  });

  it('revalidates /admin only on success', async () => {
    const ctx = makeSupabase({
      user: { id: 'user-1' },
      teamMember: TEAM_MEMBER,
      category: ACTIVE_CATEGORY,
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(ctx.supabase as never);

    await createManualSubmission(VALID_INPUT);

    expect(revalidatePath).toHaveBeenCalledWith('/admin');
  });
});
