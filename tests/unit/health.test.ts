import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/health/route';

const mockClient = (selectResult: { error: unknown }) => ({
  from: () => ({
    select: () => Promise.resolve(selectResult),
  }),
});

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with status ok when DB is reachable', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockClient({ error: null }) as never,
    );

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.db).toBe('ok');
    expect(typeof json.timestamp).toBe('string');
    expect(typeof json.latency_ms).toBe('number');
  });

  it('returns 503 with status degraded when DB returns error', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue(
      mockClient({ error: { message: 'connection refused' } }) as never,
    );

    const res = await GET();
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.status).toBe('degraded');
    expect(json.db).toBe('error');
  });

  it('returns 503 when client construction throws', async () => {
    vi.mocked(createSupabaseServerClient).mockRejectedValue(new Error('boom'));

    const res = await GET();
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.db).toBe('error');
  });
});
