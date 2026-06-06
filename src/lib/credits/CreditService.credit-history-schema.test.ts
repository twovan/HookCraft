import { describe, expect, it, vi } from 'vitest';
import { CreditService } from './CreditService';

function createSupabaseWithMissingHistoryUsageColumns() {
  const creditsSingle = vi.fn().mockResolvedValue({
    data: {
      user_id: 'user-1',
      tier: 'pro',
      used: 50,
      total: 100,
      period_start: '2025-01-01T00:00:00Z',
      period_end: '2025-02-01T00:00:00Z',
      version: 3,
    },
    error: null,
  });
  const creditsUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const creditsUpdate = vi.fn().mockReturnValue({ eq: creditsUpdateEq });

  const txNeq = vi.fn().mockResolvedValue({
    data: [{ monthly_cost: 30, purchased_cost: 20 }],
    error: null,
  });
  const txLt = vi.fn().mockReturnValue({ neq: txNeq });
  const txGte = vi.fn().mockReturnValue({ lt: txLt });
  const txEq = vi.fn().mockReturnValue({ gte: txGte });
  const txSelect = vi.fn().mockReturnValue({ eq: txEq });

  const historyInsert = vi.fn()
    .mockResolvedValueOnce({
      data: null,
      error: {
        code: 'PGRST204',
        message: "Could not find the 'monthly_used' column of 'credit_history' in the schema cache",
      },
    })
    .mockResolvedValueOnce({ data: null, error: null });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'credits') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: creditsSingle }),
        }),
        update: creditsUpdate,
      };
    }
    if (table === 'credit_transactions') {
      return { select: txSelect };
    }
    if (table === 'credit_history') {
      return { insert: historyInsert };
    }
    return {};
  });

  return { supabase: { from } as any, historyInsert, creditsUpdate };
}

describe('CreditService credit_history schema compatibility', () => {
  it('falls back to legacy credit_history insert when usage columns are missing online', async () => {
    const { supabase, historyInsert, creditsUpdate } = createSupabaseWithMissingHistoryUsageColumns();
    const service = new CreditService(supabase);

    await service.resetMonthlyCredits('user-1');

    expect(historyInsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      user_id: 'user-1',
      used: 50,
      monthly_used: 30,
      purchased_used: 20,
    }));
    expect(historyInsert).toHaveBeenNthCalledWith(2, {
      user_id: 'user-1',
      month: '2025-01',
      used: 50,
      total: 100,
    });
    expect(creditsUpdate).toHaveBeenCalledWith(expect.objectContaining({ used: 0 }));
  });
});
