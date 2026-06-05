// lib/credits/CreditService.ts - AI 创作额度管理服务（Supabase 版）

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type { MembershipTier } from '../../types/membership';
import type {
  CreditInfo,
  CreditInfoEnhanced,
  CreditHistory,
  CreditHistoryEnhanced,
  ConsumeResult,
  CreditOperationType,
  CreditsCostRule,
  PreviewCountInfo,
  PurchaseResult,
} from '../../types/credits';
import { CREDITS_COST, CREDITS_COST_RULES } from '../../config/creditsCost';
import { DEFAULT_CREDITS_PACKS } from '../../config/creditsPack';
import { TIER_CONFIGS } from '../../config/tierConfig';
import { toCreditInfo, toCreditHistory, toCreditInfoEnhanced, toCreditHistoryEnhanced, toPreviewCount } from '../supabase/mappers/credits';
import { toAppError } from '../supabase/errors';

type PurchasedCreditsRow = Database['public']['Tables']['purchased_credits']['Row'];
type CreditsRow = Database['public']['Tables']['credits']['Row'];

/**
 * CreditService - AI 创作额度管理服务
 *
 * 负责 Credits 的查询、消耗、重置和历史记录管理。
 * 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。
 * 使用乐观锁（version 字段）确保并发消耗的安全性。
 */
export class CreditService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;
  private costRulesCache: Map<CreditOperationType, CreditsCostRule> | null = null;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  private creditsFromCompletedPaymentAmount(amount: number): number {
    const pack = DEFAULT_CREDITS_PACKS.find((item) => {
      const discountPrice = Math.round(item.price * item.businessDiscount);
      return item.price === amount || discountPrice === amount;
    });
    return pack?.credits ?? 0;
  }

  private async recoverPurchasedCreditsFromCompletedPayments(userId: string): Promise<PurchasedCreditsRow | null> {
    const { data: payments, error: paymentsError } = await this.supabase
      .from('payments')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (paymentsError) throw toAppError(paymentsError, 'payments', 'select');

    const recoveredCredits = (payments ?? []).reduce((sum, payment) => (
      sum + this.creditsFromCompletedPaymentAmount(payment.amount)
    ), 0);

    if (recoveredCredits <= 0) return null;

    const { data: recoveredRow, error: upsertError } = await this.supabase
      .from('purchased_credits')
      .upsert({
        user_id: userId,
        balance: recoveredCredits,
        total_purchased: recoveredCredits,
        version: 0,
      }, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();

    if (upsertError) throw toAppError(upsertError, 'purchased_credits', 'upsert');
    return recoveredRow;
  }

  private async readPurchasedCreditsRow(userId: string): Promise<PurchasedCreditsRow | null> {
    const { data, error } = await this.supabase
      .from('purchased_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw toAppError(error, 'purchased_credits', 'select');
    if (data) return data;
    return this.recoverPurchasedCreditsFromCompletedPayments(userId);
  }

  private isCreditsPeriodExpired(row: Pick<CreditsRow, 'period_end'>): boolean {
    return new Date(row.period_end).getTime() <= Date.now();
  }

  private async refreshExpiredCreditsRow(userId: string, row: CreditsRow): Promise<CreditsRow> {
    if (!this.isCreditsPeriodExpired(row)) return row;

    await this.resetMonthlyCredits(userId);

    const { data, error } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw toAppError(error, 'credits', 'select');
    if (!data) throw new Error('Credits record not found after monthly reset');
    return data;
  }

  /**
   * 获取用户当前 Credits 信息
   * 从 credits 表查询指定 user_id 的记录
   */
  async getCredits(userId: string): Promise<CreditInfo> {
    const { data, error } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw toAppError(error, 'credits', 'select');
    
    if (!data) {
      // Auto-create credits record
      const { data: membershipRow } = await this.supabase
        .from('memberships')
        .select('tier')
        .eq('user_id', userId)
        .maybeSingle();
      const userTier = (membershipRow?.tier || 'free') as keyof typeof TIER_CONFIGS;
      const tierConfig = TIER_CONFIGS[userTier];
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      const { data: newData, error: insertError } = await this.supabase
        .from('credits')
        .insert({
          user_id: userId,
          tier: userTier,
          total: tierConfig.monthlyCredits,
          used: 0,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
        } as any)
        .select()
        .single();
      
      if (insertError) {
        // Try reading again in case of race condition
        const { data: retryData } = await this.supabase
          .from('credits')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (retryData) return toCreditInfo(retryData);
        throw toAppError(insertError, 'credits', 'insert');
      }
      return toCreditInfo(newData);
    }
    
    const currentData = await this.refreshExpiredCreditsRow(userId, data);
    return toCreditInfo(currentData);
  }

  /**
   * 消耗 Credits（优先扣除逻辑）
   *
   * 调用 consume_credits_with_priority RPC 函数实现原子性优先扣除。
   * 优先从月度 Credits 扣除，不足部分从购买 Credits 补扣。
   *
   * @param userId - 用户 ID
   * @param operations - 本次操作涉及的消耗类型列表
   * @returns ConsumeResult 包含 success/remaining/consumed/error 及拆分明细
   */
  async consumeCredits(
    userId: string,
    operations: CreditOperationType[]
  ): Promise<ConsumeResult> {
    const totalCost = await this.calculateTotalCostAsync(operations);

    // 1. 读取当前 credits 及 version
    const { data: creditsData, error: creditsReadError } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (creditsReadError) throw toAppError(creditsReadError, 'credits', 'select');
    if (!creditsData) throw new Error('Credits record not found');
    const currentCredits = await this.refreshExpiredCreditsRow(userId, creditsData);

    // 2. 读取当前 purchased_credits 及 version（可能不存在）
    const currentPurchased = await this.readPurchasedCreditsRow(userId);

    const purchasedVersion = currentPurchased?.version ?? 0;

    // 3. 调用 consume_credits_with_priority RPC 函数
    const operationType = operations.length === 1 ? operations[0] : operations.join('+');
    const { data: rpcResult, error: rpcError } = await this.supabase.rpc(
      'consume_credits_with_priority',
      {
        p_user_id: userId,
        p_total_cost: totalCost,
        p_operation_type: operationType,
        p_credits_version: currentCredits.version,
        p_purchased_version: purchasedVersion,
      }
    );

    if (rpcError) throw toAppError(rpcError, 'credits', 'update');

    // 4. 解析 JSONB 结果
    const result = rpcResult as Record<string, unknown>;

    if (!result.success) {
      if (result.error === 'concurrent_limit') {
        const monthlyRemaining = currentCredits.total - currentCredits.used;
        const purchasedBalance = currentPurchased?.balance ?? 0;
        return {
          success: false,
          remaining: monthlyRemaining + purchasedBalance,
          consumed: 0,
          error: 'concurrent_limit',
        };
      }

      // RPC failed (likely version mismatch) - try direct update as fallback
      const monthlyRemaining = currentCredits.total - currentCredits.used;
      const purchasedBalance = currentPurchased?.balance ?? 0;
      const totalPool = monthlyRemaining + purchasedBalance;

      if (totalPool >= totalCost) {
        // Direct deduction: prefer monthly first
        const monthlyCost = Math.min(monthlyRemaining, totalCost);
        const purchasedCost = totalCost - monthlyCost;

        await this.supabase
          .from('credits')
          .update({ used: currentCredits.used + monthlyCost, updated_at: new Date().toISOString() })
          .eq('user_id', userId);

        if (purchasedCost > 0 && currentPurchased) {
          await this.supabase
            .from('purchased_credits')
            .update({ balance: currentPurchased.balance - purchasedCost, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        }

        return {
          success: true,
          remaining: totalPool - totalCost,
          consumed: totalCost,
          monthlyCost,
          purchasedCost,
          monthlyRemaining: monthlyRemaining - monthlyCost,
          purchasedRemaining: purchasedBalance - purchasedCost,
        };
      }

      return {
        success: false,
        remaining: totalPool,
        consumed: 0,
        error: result.error as 'no_credits' | 'concurrent_limit',
      };
    }

    const monthlyCost = result.monthly_cost as number;
    const purchasedCost = result.purchased_cost as number;
    const monthlyRemaining = result.monthly_remaining as number;
    const purchasedRemaining = result.purchased_remaining as number;

    return {
      success: true,
      remaining: monthlyRemaining + purchasedRemaining,
      consumed: totalCost,
      monthlyCost,
      purchasedCost,
      monthlyRemaining,
      purchasedRemaining,
    };
  }

  /**
   * 获取用户购买 Credits 余额
   * 从 purchased_credits 表查询，无记录时返回 0
   */
  async getPurchasedBalance(userId: string): Promise<number> {
    const data = await this.readPurchasedCreditsRow(userId);
    return data?.balance ?? 0;
  }

  /**
   * 获取用户增强版 Credits 信息
   * 查询 credits 表和 purchased_credits 表，返回完整的分类信息
   */
  async getCreditsEnhanced(userId: string): Promise<CreditInfoEnhanced> {
    const { data: creditsRow, error: creditsError } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (creditsError) throw toAppError(creditsError, 'credits', 'select');

    // If no credits record, create one
    let finalCreditsRow = creditsRow;
    if (!finalCreditsRow) {
      // Get user's actual membership tier
      const { data: membershipRow } = await this.supabase
        .from('memberships')
        .select('tier')
        .eq('user_id', userId)
        .maybeSingle();
      const userTier = (membershipRow?.tier || 'free') as keyof typeof TIER_CONFIGS;
      const tierConfig = TIER_CONFIGS[userTier];

      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const { data: newCredits, error: insertError } = await this.supabase
        .from('credits')
        .insert({
          user_id: userId,
          tier: userTier,
          total: tierConfig.monthlyCredits,
          used: 0,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
        } as any)
        .select()
        .single();

      if (insertError) {
        // If insert fails (e.g. unique constraint), try to read again
        const { data: retryRow } = await this.supabase
          .from('credits')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        finalCreditsRow = retryRow;
        if (!finalCreditsRow) throw toAppError(insertError, 'credits', 'insert');
      } else {
        finalCreditsRow = newCredits;
      }
    }

    finalCreditsRow = await this.refreshExpiredCreditsRow(userId, finalCreditsRow);

    const purchasedRow = await this.readPurchasedCreditsRow(userId);

    // Ensure credits.total and tier match the user's membership
    const { data: membershipCheck } = await this.supabase
      .from('memberships')
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle();
    const actualTier = (membershipCheck?.tier || finalCreditsRow.tier || 'free') as keyof typeof TIER_CONFIGS;
    const tierConfig = TIER_CONFIGS[actualTier];
    const correctTotal = tierConfig.monthlyCredits;
    
    if (finalCreditsRow.total !== correctTotal || finalCreditsRow.tier !== actualTier) {
      await this.supabase
        .from('credits')
        .update({ total: correctTotal, tier: actualTier })
        .eq('user_id', userId);
      finalCreditsRow = { ...finalCreditsRow, total: correctTotal, tier: actualTier };
    }

    return toCreditInfoEnhanced(finalCreditsRow, purchasedRow);
  }

  /**
   * 检查用户是否有足够的 Credits 执行指定操作
   *
   * @param userId - 用户 ID
   * @param operations - 本次操作涉及的消耗类型列表
   * @returns true 表示余额充足
   */
  async hasEnoughCredits(
    userId: string,
    operations: CreditOperationType[]
  ): Promise<boolean> {
    const info = await this.getCreditsEnhanced(userId);
    const totalCost = await this.calculateTotalCostAsync(operations);
    return info.totalAvailable >= totalCost;
  }

  /**
   * 重置单个用户的月度 Credits
   *
   * 事务性操作：归档当前周期到 credit_history + 重置 credits 表。
   * 将 used 归零，total 设为当前等级的月度配额，更新计费周期。
   * 购买 Credits 保持不变。
   * 归档时从 credit_transactions 汇总 monthly_cost 和 purchased_cost。
   */
  async resetMonthlyCredits(userId: string): Promise<void> {
    // 1. 读取当前 credits 记录
    const { data: current, error: readError } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (readError) throw toAppError(readError, 'credits', 'select');

    // 2. 查询当前周期内的 credit_transactions 汇总 monthly_cost 和 purchased_cost
    const periodStart = new Date(current.period_start);
    const periodEnd = new Date(current.period_end);
    const month = `${periodStart.getFullYear()}-${String(
      periodStart.getMonth() + 1
    ).padStart(2, '0')}`;

    const { data: transactions, error: txError } = await this.supabase
      .from('credit_transactions')
      .select('monthly_cost, purchased_cost')
      .eq('user_id', userId)
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString())
      .neq('operation_type', 'purchase');

    if (txError) throw toAppError(txError, 'credit_transactions', 'select');

    // 汇总 monthly_cost 和 purchased_cost
    let monthlyUsed = 0;
    let purchasedUsed = 0;
    if (transactions && transactions.length > 0) {
      for (const tx of transactions) {
        monthlyUsed += tx.monthly_cost;
        purchasedUsed += tx.purchased_cost;
      }
    }

    // 如果没有 transactions 记录，回退到 credits.used 作为 monthlyUsed
    const totalUsed = monthlyUsed + purchasedUsed;
    if (totalUsed === 0 && current.used > 0) {
      monthlyUsed = current.used;
    }

    // 3. 归档当前周期到 credit_history（含分类消耗）
    const { error: insertError } = await this.supabase
      .from('credit_history')
      .insert({
        user_id: userId,
        month,
        used: monthlyUsed + purchasedUsed || current.used,
        total: current.total,
        monthly_used: monthlyUsed,
        purchased_used: purchasedUsed,
      });

    if (insertError) throw toAppError(insertError, 'credit_history', 'insert');

    // 4. 重置 credits 表（purchased_credits 保持不变）
    const now = new Date();
    const newPeriodEnd = new Date(now);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    const monthlyCredits = TIER_CONFIGS[current.tier].monthlyCredits;

    const { error: updateError } = await this.supabase
      .from('credits')
      .update({
        used: 0,
        total: monthlyCredits,
        period_start: now.toISOString(),
        period_end: newPeriodEnd.toISOString(),
        version: current.version + 1,
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) throw toAppError(updateError, 'credits', 'update');
  }

  /**
   * 购买 Credits 入账
   *
   * 将购买的 Credits 累加到 purchased_credits 表。
   * 首次购买时创建记录，后续购买使用乐观锁累加。
   * 成功后写入 operation_type 为 'purchase' 的 credit_transactions 记录。
   *
   * @param userId - 用户 ID
   * @param amount - 购买数量
   * @returns PurchaseResult 包含新余额和总可用量
   */
  async purchaseCredits(userId: string, amount: number): Promise<PurchaseResult> {
    // 1. 尝试读取现有 purchased_credits 记录
    const { data: existing, error: readError } = await this.supabase
      .from('purchased_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (readError) throw toAppError(readError, 'purchased_credits', 'select');

    let newBalance: number;

    if (existing) {
      // 2a. 已有记录：使用乐观锁更新 balance += amount, total_purchased += amount
      const { data: updated, error: updateError } = await this.supabase
        .from('purchased_credits')
        .update({
          balance: existing.balance + amount,
          total_purchased: existing.total_purchased + amount,
          version: existing.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('version', existing.version)
        .select('*');

      if (updateError) throw toAppError(updateError, 'purchased_credits', 'update');

      // 乐观锁冲突
      if (!updated || updated.length === 0) {
        return {
          success: false,
          purchasedBalance: existing.balance,
          totalAvailable: 0,
          error: 'concurrent_limit',
        };
      }

      newBalance = updated[0].balance;
    } else {
      // 2b. 无记录：插入新记录
      const { data: inserted, error: insertError } = await this.supabase
        .from('purchased_credits')
        .insert({
          user_id: userId,
          balance: amount,
          total_purchased: amount,
          version: 0,
        })
        .select('*');

      if (insertError) throw toAppError(insertError, 'purchased_credits', 'insert');

      newBalance = inserted![0].balance;
    }

    // 3. 获取月度 Credits 剩余量
    const { data: creditsRow, error: creditsError } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (creditsError) throw toAppError(creditsError, 'credits', 'select');

    const monthlyRemaining = creditsRow ? (creditsRow.total - creditsRow.used) : 0;
    const totalAvailable = monthlyRemaining + newBalance;

    // 4. 写入 credit_transactions 记录（purchase 类型，purchased_cost 为负值表示增加）
    const { error: txError } = await this.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        operation_type: 'purchase',
        total_cost: -amount,
        monthly_cost: 0,
        purchased_cost: -amount,
        monthly_remaining_after: monthlyRemaining,
        purchased_remaining_after: newBalance,
      });

    if (txError) throw toAppError(txError, 'credit_transactions', 'insert');

    return {
      success: true,
      purchasedBalance: newBalance,
      totalAvailable,
    };
  }

  /**
   * 消耗 1 次 Free 用户的 Preview 次数
   * 从 preview_counts 表更新 used 字段
   * 次数用尽时返回 no_previews 错误
   */
  async consumePreview(userId: string): Promise<ConsumeResult> {
    // 1. 读取当前 preview_counts
    const { data: current, error: readError } = await this.supabase
      .from('preview_counts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (readError) throw toAppError(readError, 'preview_counts', 'select');

    const remaining = current.total - current.used;

    // 2. 检查是否还有剩余次数
    if (remaining <= 0) {
      return {
        success: false,
        remaining: 0,
        consumed: 0,
        error: 'no_previews',
      };
    }

    // 3. 更新 used + 1
    const { error: updateError } = await this.supabase
      .from('preview_counts')
      .update({
        used: current.used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) throw toAppError(updateError, 'preview_counts', 'update');

    return {
      success: true,
      remaining: remaining - 1,
      consumed: 1,
    };
  }

  /**
   * 获取 Free 用户的 Preview 次数信息
   * 从 preview_counts 表查询指定 user_id 的记录
   */
  async getPreviewCount(userId: string): Promise<PreviewCountInfo> {
    const { data, error } = await this.supabase
      .from('preview_counts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw toAppError(error, 'preview_counts', 'select');
    return toPreviewCount(data);
  }

  /**
   * 获取用户 Credits 使用历史
   * 从 credit_history 表查询，按 month 降序排列
   *
   * @param userId - 用户 ID
   * @param months - 查询最近几个月的历史
   * @returns CreditHistory 数组
   */
  async getCreditHistory(userId: string, months: number): Promise<CreditHistory[]> {
    const { data, error } = await this.supabase
      .from('credit_history')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(months);

    if (error) throw toAppError(error, 'credit_history', 'select');
    return (data ?? []).map(toCreditHistory);
  }

  /**
   * 重置 Free 用户的 Preview 次数
   */
  async resetMonthlyPreviews(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('preview_counts')
      .update({
        used: 0,
        total: TIER_CONFIGS.free.monthlyPreviews,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw toAppError(error, 'preview_counts', 'update');
  }

  /**
   * 设置用户等级（等级变更时调用，更新 Credits 配额）
   */
  async setUserTier(userId: string, tier: MembershipTier): Promise<void> {
    const monthlyCredits = TIER_CONFIGS[tier].monthlyCredits;

    const { error } = await this.supabase
      .from('credits')
      .update({
        tier,
        total: monthlyCredits,
        used: 0,
        version: 0, // 等级变更时重置 version
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw toAppError(error, 'credits', 'update');
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 计算操作列表的总 Credits 消耗
   */
  calculateTotalCost(operations: CreditOperationType[]): number {
    return operations.reduce((sum, op) => sum + CREDITS_COST[op], 0);
  }

  async calculateTotalCostAsync(operations: CreditOperationType[]): Promise<number> {
    const rules = await this.getCostRules();
    return operations.reduce((sum, op) => {
      const rule = rules.get(op);
      if (rule?.enabled === false) return sum;
      return sum + (rule?.cost ?? CREDITS_COST[op]);
    }, 0);
  }

  private async getCostRules(): Promise<Map<CreditOperationType, CreditsCostRule>> {
    if (this.costRulesCache) return this.costRulesCache;

    const fallback = new Map<CreditOperationType, CreditsCostRule>(
      CREDITS_COST_RULES.map((rule) => [rule.operation, rule])
    );

    try {
      const table = this.supabase.from('admin_config' as any) as any;
      if (typeof table?.select !== 'function') {
        this.costRulesCache = fallback;
        return fallback;
      }

      const { data, error } = await table
        .select('config_data')
        .eq('config_type', 'cost_rule')
        .maybeSingle();

      if (error || !Array.isArray(data?.config_data)) {
        this.costRulesCache = fallback;
        return fallback;
      }

      const merged = new Map(fallback);
      for (const rule of data.config_data as CreditsCostRule[]) {
        if (!rule?.operation || typeof rule.cost !== 'number') continue;
        merged.set(rule.operation, {
          ...fallback.get(rule.operation),
          ...rule,
        });
      }

      this.costRulesCache = merged;
      return merged;
    } catch {
      this.costRulesCache = fallback;
      return fallback;
    }
  }
}
