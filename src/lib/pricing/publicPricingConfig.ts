import type { AdminFullConfig } from '@/types/admin';
import type { TierConfig } from '@/config/tierConfig';

export function mergeTierConfigsWithAdminConfig(
  tiers: TierConfig[],
  adminConfig: Partial<Pick<AdminFullConfig, 'pricing' | 'creditQuotas'>> | null | undefined,
) {
  const pricingByTier = new Map((adminConfig?.pricing || []).map((pricing) => [pricing.tier, pricing]));
  const quotaByTier = new Map((adminConfig?.creditQuotas || []).map((quota) => [quota.tier, quota]));

  return tiers.map((tier) => {
    const pricing = pricingByTier.get(tier.tier);
    const quota = quotaByTier.get(tier.tier);

    return {
      ...tier,
      monthlyPrice: pricing?.monthlyPrice ?? tier.monthlyPrice,
      yearlyPrice: pricing?.yearlyPrice ?? tier.yearlyPrice,
      monthlyCredits: quota?.monthlyCredits ?? tier.monthlyCredits,
    };
  });
}
