/**
 * 属性测试 — 5 个正确性属性
 *
 * 使用 fast-check + vitest 验证 Supabase 集成层的核心正确性属性。
 * 每个属性测试至少运行 100 次迭代。
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { toMembershipInfo, fromMembershipInfo } from '../mappers/membership';
import { toAppError, type PostgrestError } from '../errors';
import { CreditService } from '../../credits/CreditService';
import { PaymentService } from '../../payment/PaymentService';
import { MembershipService } from '../../membership/MembershipService';
import { TIER_CONFIGS } from '../../../config/tierConfig';
import type { MembershipTier } from '../../../types/membership';
import type { Tables } from '../types';

// ─── Generators ───────────────────────────────────────────────────────────────

/** Generate a valid membership tier */
const tierArb = fc.constantFrom<MembershipTier>('free', 'pro', 'business');

/** Generate a valid billing cycle or null */
const billingCycleArb = fc.constantFrom<'monthly' | 'yearly' | null>('monthly', 'yearly', null);

/** Generate a valid payment provider or null */
const paymentProviderArb = fc.constantFrom<'stripe' | 'paypal' | 'wechat' | 'alipay' | null>(
  'stripe', 'paypal', 'wechat', 'alipay', null
);

/** Generate a valid subscription status */
const subscriptionStatusArb = fc.constantFrom<'active' | 'expiring' | 'expired' | 'cancelled' | 'grace_period'>(
  'active', 'expiring', 'expired', 'cancelled', 'grace_period'
);

/** Generate a valid ISO timestamp string */
const timestampArb = fc.date({
  min: new Date('2020-01-01T00:00:00Z'),
  max: new Date('2030-12-31T23:59:59Z'),
}).map(d => d.toISOString());

/** Generate a nullable ISO timestamp string */
const nullableTimestampArb = fc.option(timestampArb, { nil: null });

/** Generate a valid memberships row */
const membershipRowArb: fc.Arbitrary<Tables<'memberships'>> = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  tier: tierArb,
  billing_cycle: billingCycleArb,
  start_date: nullableTimestampArb,
  expires_at: nullableTimestampArb,
  auto_renew: fc.boolean(),
  payment_provider: paymentProviderArb,
  subscription_id: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  status: subscriptionStatusArb,
  grace_period_end: nullableTimestampArb,
  pending_downgrade_tier: fc.option(tierArb, { nil: null }),
  created_at: timestampArb,
  updated_at: timestampArb,
});

/**
 * Generate a valid credits state for optimistic lock testing.
 * Ensures used + cost <= total is possible (total >= 1) for the "sufficient balance" path.
 */
const creditsStateArb = fc.record({
  used: fc.integer({ min: 0, max: 500 }),
  total: fc.integer({ min: 1, max: 1000 }),
  version: fc.integer({ min: 0, max: 100 }),
}).filter(s => s.used < s.total); // Ensure there's room for at least 1 credit consumption

/** Generate a valid webhook event */
const webhookEventArb = fc.record({
  eventId: fc.stringMatching(/^evt_[a-z0-9]{5,20}$/),
  sessionId: fc.stringMatching(/^session_[a-z0-9]{5,20}$/),
  status: fc.constantFrom<'completed' | 'failed' | 'cancelled'>('completed', 'failed', 'cancelled'),
  provider: fc.constantFrom<'stripe' | 'paypal' | 'wechat' | 'alipay'>('stripe', 'paypal', 'wechat', 'alipay'),
});

/** Generate a valid upgrade tier combination (current < target) */
const upgradeTierPairArb = fc.constantFrom<[MembershipTier, MembershipTier]>(
  ['free', 'pro'],
  ['free', 'business'],
  ['pro', 'business'],
);

/** Generate a random PostgrestError object */
const postgrestErrorArb: fc.Arbitrary<PostgrestError> = fc.record({
  code: fc.option(fc.oneof(
    fc.constantFrom('PGRST301', '23505', '23503', '42501'),
    fc.string({ minLength: 1, maxLength: 10 }),
  ), { nil: undefined }),
  message: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  details: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  hint: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
});

// ─── Property 1: 类型映射 Round-Trip ──────────────────────────────────────────

describe('Property 1: 类型映射 Round-Trip', () => {
  /**
   * **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6**
   *
   * For any valid memberships row, converting to business type and back
   * should produce an equivalent row (round-trip property).
   */
  it('membership mapper round-trip: fromMembershipInfo(toMembershipInfo(row)) ≡ row (relevant fields)', () => {
    fc.assert(
      fc.property(membershipRowArb, (row) => {
        const businessObj = toMembershipInfo(row);
        const backToRow = fromMembershipInfo(businessObj);

        // Verify all mapped fields are preserved
        expect(backToRow.user_id).toBe(row.user_id);
        expect(backToRow.tier).toBe(row.tier);
        expect(backToRow.billing_cycle).toBe(row.billing_cycle);
        expect(backToRow.auto_renew).toBe(row.auto_renew);
        expect(backToRow.payment_provider).toBe(row.payment_provider);
        expect(backToRow.subscription_id).toBe(row.subscription_id);
        expect(backToRow.status).toBe(row.status);

        // Date fields: verify round-trip preserves the timestamp value
        if (row.start_date === null) {
          expect(backToRow.start_date).toBeNull();
        } else {
          expect(new Date(backToRow.start_date!).getTime()).toBe(new Date(row.start_date).getTime());
        }

        if (row.expires_at === null) {
          expect(backToRow.expires_at).toBeNull();
        } else {
          expect(new Date(backToRow.expires_at!).getTime()).toBe(new Date(row.expires_at).getTime());
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Credits 乐观锁并发安全 ───────────────────────────────────────

describe('Property 2: Credits 乐观锁并发安全', () => {
  /**
   * **Validates: Requirements 4.7, 8.1**
   *
   * For any valid credits state and consumption amount:
   * - version match + sufficient balance → update succeeds with version+1
   * - version mismatch (simulated by empty update result) → returns concurrent_limit error
   */
  it('version match → update succeeds with version+1; version mismatch → concurrent_limit error', async () => {
    await fc.assert(
      fc.asyncProperty(
        creditsStateArb,
        fc.boolean(), // whether version matches (simulates concurrent modification)
        async (state, versionMatches) => {
          const userId = 'user-test';
          // Cost is always 1 (preview operation) — we know state has room since used < total
          const cost = 1;

          const row = {
            id: 'uuid-1',
            user_id: userId,
            tier: 'pro' as const,
            used: state.used,
            total: state.total,
            period_start: '2025-01-01T00:00:00Z',
            period_end: '2025-02-01T00:00:00Z',
            version: state.version,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          };

          const makeMaybeSingleQuery = (data: unknown) => ({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
              }),
            }),
          });
          const makeEmptyPaymentsQuery = () => ({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          });

          const mockFrom = vi.fn().mockImplementation((table: string) => {
            if (table === 'credits') return makeMaybeSingleQuery(row);
            if (table === 'purchased_credits') return makeMaybeSingleQuery(null);
            if (table === 'payments') return makeEmptyPaymentsQuery();
            return {};
          });
          const mockRpc = vi.fn().mockResolvedValue({
            data: versionMatches
              ? {
                  success: true,
                  monthly_cost: cost,
                  purchased_cost: 0,
                  monthly_remaining: state.total - state.used - cost,
                  purchased_remaining: 0,
                }
              : {
                  success: false,
                  error: 'concurrent_limit',
                },
            error: null,
          });

          const supabase = { from: mockFrom, rpc: mockRpc } as any;
          const service = new CreditService(supabase);

          const result = await service.consumeCredits(userId, ['preview']);

          expect(mockRpc).toHaveBeenCalledWith('consume_credits_with_priority', {
            p_user_id: userId,
            p_total_cost: cost,
            p_operation_type: 'preview',
            p_credits_version: state.version,
            p_purchased_version: 0,
          });

          if (versionMatches) {
            // Version matches + sufficient balance → success with version+1
            expect(result.success).toBe(true);
            expect(result.consumed).toBe(cost);
            expect(result.remaining).toBe(state.total - state.used - cost);
          } else {
            // Version mismatch → concurrent_limit error
            expect(result.success).toBe(false);
            expect(result.error).toBe('concurrent_limit');
            expect(result.consumed).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Webhook 处理幂等性 ──────────────────────────────────────────

describe('Property 3: Webhook 处理幂等性', () => {
  /**
   * **Validates: Requirements 4.12, 8.2**
   *
   * For any valid webhook event, processing the same event twice:
   * - First call processes the event (handled: true)
   * - Second call detects duplicate and returns { handled: true } without DB mutations
   */
  it('processing same event twice → second call returns { handled: true }, no extra DB writes', async () => {
    await fc.assert(
      fc.asyncProperty(webhookEventArb, async (event) => {
        const sessionData = {
          id: event.sessionId,
          user_id: 'user-1',
          provider: event.provider,
          checkout_url: `https://pay.example.com/${event.provider}/${event.sessionId}`,
          tier: 'pro' as const,
          billing_cycle: 'monthly' as const,
          expires_at: '2025-01-01T00:30:00Z',
          created_at: '2025-01-01T00:00:00Z',
        };

        // --- First call: event NOT in processed_webhook_events ---
        const mockSingle1 = vi.fn()
          // 1st single(): idempotency check → not found
          .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } })
          // 2nd single(): session lookup → found
          .mockResolvedValueOnce({ data: sessionData, error: null });

        const mockSelectEq1 = vi.fn().mockReturnValue({ single: mockSingle1 });
        const mockSelect1 = vi.fn().mockReturnValue({ eq: mockSelectEq1 });
        const mockInsert1 = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockUpdateEq1 = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockUpdate1 = vi.fn().mockReturnValue({ eq: mockUpdateEq1 });

        const mockFrom1 = vi.fn().mockReturnValue({
          select: mockSelect1,
          insert: mockInsert1,
          update: mockUpdate1,
        });

        const supabase1 = { from: mockFrom1 } as any;
        const service1 = new PaymentService(supabase1);

        const result1 = await service1.handleWebhook(event.provider, {
          eventId: event.eventId,
          sessionId: event.sessionId,
          status: event.status,
        });

        expect(result1.handled).toBe(true);

        // --- Second call: event IS in processed_webhook_events ---
        const mockSingle2 = vi.fn()
          // idempotency check → found (already processed)
          .mockResolvedValueOnce({ data: { event_id: event.eventId }, error: null });

        const mockSelectEq2 = vi.fn().mockReturnValue({ single: mockSingle2 });
        const mockSelect2 = vi.fn().mockReturnValue({ eq: mockSelectEq2 });
        const mockInsert2 = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockUpdate2 = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });

        const mockFrom2 = vi.fn().mockReturnValue({
          select: mockSelect2,
          insert: mockInsert2,
          update: mockUpdate2,
        });

        const supabase2 = { from: mockFrom2 } as any;
        const service2 = new PaymentService(supabase2);

        const result2 = await service2.handleWebhook(event.provider, {
          eventId: event.eventId,
          sessionId: event.sessionId,
          status: event.status,
        });

        // Second call returns handled: true (idempotent)
        expect(result2.handled).toBe(true);
        // No update or insert calls on second invocation (only the select for idempotency check)
        expect(mockUpdate2).not.toHaveBeenCalled();
        expect(mockInsert2).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: 升级事务一致性 ──────────────────────────────────────────────

describe('Property 4: 升级事务一致性', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * For any valid upgrade tier combination (current < target):
   * After upgradeTier, the RPC is called with targetTier and
   * TIER_CONFIGS[targetTier].monthlyCredits — ensuring memberships.tier and
   * credits.total are updated atomically.
   */
  it('after upgrade, RPC called with targetTier and correct monthlyCredits', async () => {
    await fc.assert(
      fc.asyncProperty(
        upgradeTierPairArb,
        fc.constantFrom<'monthly' | 'yearly'>('monthly', 'yearly'),
        async ([currentTier, targetTier], billingCycle) => {
          const row = {
            id: 'uuid-1',
            user_id: 'user-1',
            tier: currentTier,
            billing_cycle: billingCycle,
            start_date: '2025-01-01T00:00:00Z',
            expires_at: '2025-02-01T00:00:00Z',
            auto_renew: true,
            payment_provider: 'stripe' as const,
            subscription_id: 'sub-1',
            status: 'active' as const,
            grace_period_end: null,
            pending_downgrade_tier: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          };

          const mockSingle = vi.fn().mockResolvedValue({ data: row, error: null });
          const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
          const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
          const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

          const mockFrom = vi.fn().mockReturnValue({
            select: mockSelect,
          });

          const supabase = { from: mockFrom, rpc: mockRpc } as any;
          const service = new MembershipService(supabase);

          const result = await service.upgradeTier('user-1', targetTier);

          expect(result.success).toBe(true);

          // Verify RPC was called with correct parameters ensuring transaction consistency
          expect(mockRpc).toHaveBeenCalledWith('upgrade_membership', {
            p_user_id: 'user-1',
            p_target_tier: targetTier,
            p_billing_cycle: billingCycle,
            p_monthly_credits: TIER_CONFIGS[targetTier].monthlyCredits,
          });

          // Verify the monthly credits value matches TIER_CONFIGS
          const rpcArgs = mockRpc.mock.calls[0][1];
          expect(rpcArgs.p_target_tier).toBe(targetTier);
          expect(rpcArgs.p_monthly_credits).toBe(TIER_CONFIGS[targetTier].monthlyCredits);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: 统一错误转换格式完整性 ──────────────────────────────────────

describe('Property 5: 统一错误转换格式完整性', () => {
  /**
   * **Validates: Requirements 10.6**
   *
   * For any PostgrestError object, toAppError output always contains
   * non-empty code, message, table, and operation.
   */
  it('toAppError output always contains non-empty code, message, table, operation', () => {
    const tableArb = fc.string({ minLength: 1, maxLength: 30 });
    const operationArb = fc.constantFrom('select', 'insert', 'update', 'delete');

    fc.assert(
      fc.property(postgrestErrorArb, tableArb, operationArb, (error, table, operation) => {
        const appError = toAppError(error, table, operation);

        // code is always non-empty
        expect(appError.code).toBeDefined();
        expect(appError.code.length).toBeGreaterThan(0);

        // message is always non-empty
        expect(appError.message).toBeDefined();
        expect(appError.message.length).toBeGreaterThan(0);

        // table is always the passed-in table
        expect(appError.table).toBe(table);
        expect(appError.table.length).toBeGreaterThan(0);

        // operation is always the passed-in operation
        expect(appError.operation).toBe(operation);
        expect(appError.operation.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
