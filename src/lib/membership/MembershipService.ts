// lib/membership/MembershipService.ts - 会员等级管理核心服务（Supabase 版）

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  MembershipTier,
  MembershipInfo,
  FeatureKey,
} from '../../types/membership';
import type { UpgradeResult, DowngradeResult, CancelResult } from '../../types/payment';
import { TIER_CONFIGS, type TierConfig } from '../../config/tierConfig';
import { toMembershipInfo } from '../supabase/mappers/membership';
import { toAppError } from '../supabase/errors';

/**
 * MembershipService - 会员等级管理核心服务
 *
 * 负责会员信息查询、等级升降级、取消订阅、权限校验和到期处理。
 * 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。
 */
export class MembershipService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 获取用户当前会员信息
   * 从 memberships 表查询指定 user_id 的记录
   */
  async getMembership(userId: string): Promise<MembershipInfo> {
    const { data, error } = await this.supabase
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw toAppError(error, 'memberships', 'select');
    return toMembershipInfo(data);
  }

  /**
   * 升级会员等级
   *
   * 调用 upgrade_membership RPC 函数，在同一事务中更新 memberships + credits。
   * 计算按剩余天数比例的差价：(目标日均价 - 当前日均价) × 剩余天数
   *
   * @param userId - 用户 ID
   * @param targetTier - 目标等级（必须高于当前等级）
   * @returns UpgradeResult 包含差价和是否成功
   */
  async upgradeTier(userId: string, targetTier: MembershipTier): Promise<UpgradeResult> {
    // 获取当前会员信息
    const current = await this.getMembership(userId);
    const tierOrder: Record<MembershipTier, number> = { free: 0, pro: 1, business: 2 };

    if (tierOrder[targetTier] <= tierOrder[current.tier]) {
      return {
        success: false,
        proratedAmount: 0,
        error: '目标等级必须高于当前等级',
      };
    }

    // 计算差价
    const remainingDays = this.getRemainingDays(current);
    const proratedAmount = this.calculateProration(current.tier, targetTier, remainingDays);

    // 调用 RPC 函数执行事务性升级
    const billingCycle = current.billingCycle ?? 'monthly';
    const monthlyCredits = TIER_CONFIGS[targetTier].monthlyCredits;

    const { error } = await this.supabase.rpc('upgrade_membership', {
      p_user_id: userId,
      p_target_tier: targetTier,
      p_billing_cycle: billingCycle,
      p_monthly_credits: monthlyCredits,
    });

    if (error) throw toAppError(error, 'memberships', 'rpc:upgrade_membership');

    return {
      success: true,
      proratedAmount,
    };
  }

  /**
   * 降级会员等级
   *
   * 降级在当前计费周期结束后生效。
   * 返回降级后将失去的功能列表（当前等级与目标等级 features 的差集）。
   *
   * @param userId - 用户 ID
   * @param targetTier - 目标等级（必须低于当前等级）
   * @returns DowngradeResult 包含生效日期和失去的功能
   */
  async downgradeTier(userId: string, targetTier: MembershipTier): Promise<DowngradeResult> {
    const current = await this.getMembership(userId);
    const tierOrder: Record<MembershipTier, number> = { free: 0, pro: 1, business: 2 };

    if (tierOrder[targetTier] >= tierOrder[current.tier]) {
      return {
        success: false,
        effectiveDate: new Date(),
        lostFeatures: [],
      };
    }

    // 计算失去的功能
    const currentFeatures = TIER_CONFIGS[current.tier].features;
    const targetFeatures = new Set(TIER_CONFIGS[targetTier].features);
    const lostFeatures = currentFeatures.filter((f) => !targetFeatures.has(f));

    // 降级在当前周期结束后生效
    const effectiveDate = current.expiresAt ?? new Date();

    // 更新 auto_renew 和 pending_downgrade_tier
    const { error } = await this.supabase
      .from('memberships')
      .update({
        auto_renew: false,
        pending_downgrade_tier: targetTier,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw toAppError(error, 'memberships', 'update');

    return {
      success: true,
      effectiveDate,
      lostFeatures,
    };
  }

  /**
   * 取消订阅
   *
   * 取消后保留权限直到当前计费周期结束。
   *
   * @param userId - 用户 ID
   * @returns CancelResult 包含取消生效日期和权限保留截止日期
   */
  async cancelSubscription(userId: string): Promise<CancelResult> {
    const current = await this.getMembership(userId);

    if (current.tier === 'free') {
      return {
        success: false,
        effectiveDate: new Date(),
        retainedUntil: new Date(),
      };
    }

    const now = new Date();
    const retainedUntil = current.expiresAt ?? now;

    // 更新 status 和 auto_renew
    const { error } = await this.supabase
      .from('memberships')
      .update({
        status: 'cancelled',
        auto_renew: false,
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw toAppError(error, 'memberships', 'update');

    return {
      success: true,
      effectiveDate: now,
      retainedUntil,
    };
  }

  /**
   * 检查用户是否有指定功能的权限
   *
   * 基于 TIER_CONFIGS[tier].features 进行权限校验。
   * 包括模板访问权限（free_template / paid_template）。
   *
   * @param userId - 用户 ID
   * @param feature - 功能键
   * @returns true 表示用户有权限
   */
  async checkPermission(userId: string, feature: FeatureKey): Promise<boolean> {
    const membership = await this.getMembership(userId);
    const config = TIER_CONFIGS[membership.tier];
    return config.features.includes(feature);
  }

  /**
   * 处理订阅到期
   *
   * 将用户降级为 Free 等级，设置 30 天宽限期用于文件访问。
   *
   * @param userId - 用户 ID
   */
  async handleExpiration(userId: string): Promise<void> {
    const current = await this.getMembership(userId);

    if (current.tier === 'free') {
      return;
    }

    const now = new Date();
    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

    // 更新 tier、status、grace_period_end 及相关字段
    const { error } = await this.supabase
      .from('memberships')
      .update({
        tier: 'free',
        status: 'grace_period',
        billing_cycle: null,
        auto_renew: false,
        subscription_id: null,
        payment_provider: null,
        grace_period_end: gracePeriodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw toAppError(error, 'memberships', 'update');
  }

  /**
   * 获取等级配置
   */
  getTierConfig(tier: MembershipTier): TierConfig {
    return TIER_CONFIGS[tier];
  }

  /**
   * 检查用户订阅是否即将到期（7 天内）
   *
   * @param userId - 用户 ID
   * @returns true 表示 7 天内到期
   */
  async isExpiringSoon(userId: string): Promise<boolean> {
    const membership = await this.getMembership(userId);

    if (!membership.expiresAt || membership.tier === 'free') {
      return false;
    }

    const now = new Date();
    const daysUntilExpiry = (membership.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 计算升级差价（按剩余天数比例）
   *
   * 差价 = (目标日均价 - 当前日均价) × 剩余天数
   * 日均价 = 月付价格 / 30
   */
  calculateProration(
    currentTier: MembershipTier,
    targetTier: MembershipTier,
    remainingDays: number
  ): number {
    const currentConfig = TIER_CONFIGS[currentTier];
    const targetConfig = TIER_CONFIGS[targetTier];

    const currentDailyRate = currentConfig.monthlyPrice / 30;
    const targetDailyRate = targetConfig.monthlyPrice / 30;

    const proration = Math.round((targetDailyRate - currentDailyRate) * remainingDays);
    return Math.max(0, proration);
  }

  /**
   * 获取用户剩余天数
   */
  private getRemainingDays(membership: MembershipInfo): number {
    if (!membership.expiresAt) {
      return 0;
    }
    const now = new Date();
    const diff = membership.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}
