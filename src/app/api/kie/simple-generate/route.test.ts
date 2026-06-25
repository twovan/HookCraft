import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

type SupabaseUpdate = {
  table: string;
  values: Record<string, unknown>;
};

const mocks = vi.hoisted(() => {
  const getAuthUser = vi.fn();
  const generateMusic = vi.fn();
  const KieSunoProvider = vi.fn(function () {
    return { generateMusic };
  });
  const hasEnoughCredits = vi.fn();
  const consumeCredits = vi.fn();
  const CreditService = vi.fn(function () {
    return { hasEnoughCredits, consumeCredits };
  });
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const updates: SupabaseUpdate[] = [];

  function createEqChain(result: { error: Error | null } = { error: null }) {
    let calls = 0;
    const chain = {
      eq: vi.fn(() => {
        calls += 1;
        return calls >= 2 ? Promise.resolve(result) : chain;
      }),
    };
    return chain;
  }

  const updateResults: Array<{ error: Error | null }> = [];
  const from = vi.fn((table: string) => ({
    insert: vi.fn((values: Record<string, unknown>) => {
      inserts.push({ table, values });
      return Promise.resolve({ error: null });
    }),
    update: vi.fn((values: Record<string, unknown>) => {
      updates.push({ table, values });
      return createEqChain(updateResults.shift() || { error: null });
    }),
    delete: vi.fn(() => createEqChain()),
  }));

  return {
    getAuthUser,
    generateMusic,
    KieSunoProvider,
    hasEnoughCredits,
    consumeCredits,
    CreditService,
    from,
    inserts,
    updates,
    updateResults,
  };
});

vi.mock('@/lib/supabase/auth-helpers', () => ({
  getAuthUser: mocks.getAuthUser,
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}));

vi.mock('@/lib/generation/KieSunoProvider', () => ({
  KieSunoProvider: mocks.KieSunoProvider,
  getKieUserFacingErrorMessage: (message?: string | null) => message || null,
  isKieProviderCreditsInsufficient: () => false,
}));

vi.mock('@/lib/credits/CreditService', () => ({
  CreditService: mocks.CreditService,
}));

vi.mock('@/lib/credits/consumeError', () => ({
  getConsumeCreditsErrorMessage: () => 'Credits 扣减失败，请重试',
}));

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/kie/simple-generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/kie/simple-generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserts.length = 0;
    mocks.updates.length = 0;
    mocks.updateResults.length = 0;
    mocks.getAuthUser.mockResolvedValue({ id: 'user-1' });
    mocks.hasEnoughCredits.mockResolvedValue(true);
    mocks.consumeCredits.mockResolvedValue({ success: true, consumed: 20, remaining: 80 });
    mocks.generateMusic.mockResolvedValue({ taskId: 'kie-task-1' });
  });

  it('rejects an empty prompt before creating a KIE task', async () => {
    const res = await POST(createRequest({ prompt: '   ' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('请输入生成描述');
    expect(mocks.KieSunoProvider).not.toHaveBeenCalled();
    expect(mocks.generateMusic).not.toHaveBeenCalled();
  });

  it('marks task and batch failed when consuming credits throws after provider success', async () => {
    mocks.consumeCredits.mockRejectedValue(new Error('credits write failed'));

    const res = await POST(createRequest({ prompt: 'ambient pop hook', instrumental: true }));
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe('Credits 扣减失败，请重试');
    expect(mocks.generateMusic).toHaveBeenCalledOnce();
    expect(mocks.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'generation_tasks',
          values: expect.objectContaining({
            status: 'failed',
            error_code: 'CREDITS_NOT_ENOUGH',
            credits_consumed: 0,
          }),
        }),
        expect.objectContaining({
          table: 'generation_batches',
          values: expect.objectContaining({
            status: 'failed',
          }),
        }),
      ])
    );
  });

  it('returns task metadata and stores provider task id after successful generation', async () => {
    const res = await POST(createRequest({ prompt: 'ambient pop hook', instrumental: false }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.taskId).toBe('kie-task-1');
    expect(body.localTaskId).toMatch(/^kie-simple-task-/);
    expect(body.batchId).toMatch(/^kie-simple-batch-/);
    expect(body.creationUrl).toBe(`/account/creations?expand=${encodeURIComponent(body.batchId)}`);
    expect(body.statusUrl).toBe(
      `/api/kie/upload-cover/status?taskId=kie-task-1&localTaskId=${encodeURIComponent(body.localTaskId)}`
    );
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        table: 'generation_tasks',
        values: expect.objectContaining({
          raw_audio_path: 'kie:kie-task-1',
          credits_consumed: 20,
        }),
      })
    );
  });
});
