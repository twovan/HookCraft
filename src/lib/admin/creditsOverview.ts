import { TIER_CONFIGS } from '../../config/tierConfig';
import type { AdminCreditConfig } from '../../types/admin';
import type { MembershipTier } from '../../types/membership';

export const CREDIT_TIERS: MembershipTier[] = ['free', 'pro', 'business'];

function getDefaultMonthlyQuota(tier: MembershipTier): number {
  return tier === 'free'
    ? TIER_CONFIGS.free.monthlyPreviews
    : TIER_CONFIGS[tier].monthlyCredits;
}

export function buildMonthlyQuotaMap(
  creditQuotas: AdminCreditConfig[] = [],
): Record<MembershipTier, number> {
  const quotaMap = CREDIT_TIERS.reduce((acc, tier) => {
    acc[tier] = getDefaultMonthlyQuota(tier);
    return acc;
  }, {} as Record<MembershipTier, number>);

  for (const quota of creditQuotas) {
    if (CREDIT_TIERS.includes(quota.tier) && Number.isFinite(quota.monthlyCredits)) {
      quotaMap[quota.tier] = quota.monthlyCredits;
    }
  }

  return quotaMap;
}
