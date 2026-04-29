// lib/credits/CreditService.ts - AI 创作额度管理服务（Supabase 版）

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type { MembershipTier } from '../../types/membership';
import type {
  CreditInfo,
  CreditHistory,
  ConsumeResult,
  CreditOperationType,
  PreviewCountInfo,
} from '../../types/credits';
import { CREDITS_COST } from '../../config/creditsCost';
import { TIER_CONFIGS } from '../../config/tierConfig';
import { toCreditInfo, toCreditHistory, toPreviewCount } from '../supabase/mappers/credits';
import { toAppError } from '../supabase/errors';

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

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
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
      .single();

    if (error) throw toAppError(error, 'credits', 'select');
    return toCreditInfo(data);
  }

  /**
   * 消耗 Credits
   *
   * 根据操作类型列表计算总消耗，支持复合消耗场景。
   * 使用乐观锁确保并发安全：读取当前 version → 检查余额 → 以 WHERE version = expected_version 条件更新。
   *
   * @param userId - 用户 ID
   * @param operations - 本次操作涉及的消耗类型列表
   * @returns ConsumeResult 包含 success/remaining/consumed/error
   */
  async consumeCredits(
    userId: string,
    operations: CreditOperationType[]
  ): Promise<ConsumeResult> {
    const totalCost = this.calculateTotalCost(operations);

    // 1. 读取当前 credits 及 version
    const { data: current, error: readError } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (readError) throw toAppError(readError, 'credits', 'select');

    // 2. 检查余额是否充足
    if (current.used + totalCost > current.total) {
      return {
        success: false,
        remaining: current.total - current.used,
        consumed: 0,
        error: 'no_credits',
      };
    }

    // 3. 使用乐观锁更新（WHERE version = expected_version）
    const { data, error, count } = await this.supabase
      .from('credits')
      .update({
        used: current.used + totalCost,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('version', current.version)
      .select('*');

    if (error) throw toAppError(error, 'credits', 'update');

    // 如果没有行被更新，说明并发修改冲突
    if (!data || data.length === 0) {
      return {
        success: false,
        remaining: current.total - current.used,
        consumed: 0,
        error: 'concurrent_limit',
      };
    }

    return {
      success: true,
      remaining: data[0].total - data[0].used,
      consumed: totalCost,
    };
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
    const info = await this.getCredits(userId);
    const totalCost = this.calculateTotalCost(operations);
    return info.remaining >= totalCost;
  }

  /**
   * 重置单个用户的月度 Credits
   *
   * 事务性操作：归档当前周期到 credit_history + 重置 credits 表。
   * 将 used 归零，total 设为当前等级的月度配额，更新计费周期。
   */
  async resetMonthlyCredits(userId: string): Promise<void> {
    // 1. 读取当前 credits 记录
    const { data: current, error: readError } = await this.supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (readError) throw toAppError(readError, 'credits', 'select');

    // 2. 归档当前周期到 credit_history
    const periodStart = new Date(current.period_start);
    const month = `${periodStart.getFullYear()}-${String(
      periodStart.getMonth() + 1
    ).padStart(2, '0')}`;

    const { error: insertError } = await this.supabase
      .from('credit_history')
      .insert({
        user_id: userId,
        month,
        used: current.used,
        total: current.total,
      });

    if (insertError) throw toAppError(insertError, 'credit_history', 'insert');

    // 3. 重置 credits 表
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const monthlyCredits = TIER_CONFIGS[current.tier].monthlyCredits;

    const { error: updateError } = await this.supabase
      .from('credits')
      .update({
        used: 0,
        total: monthlyCredits,
        period_start: now.toISOString(),
        period_end: periodEnd.toISOString(),
        version: current.version + 1,
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) throw toAppError(updateError, 'credits', 'update');
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
}
