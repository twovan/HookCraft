import { describe, expect, it } from 'vitest';
import { TIER_CONFIGS } from '@/config/tierConfig';
import { mergeTierConfigsWithAdminConfig } from './publicPricingConfig';

describe('public pricing config', () => {
  it('applies admin pricing and credit quotas to public tier cards', () => {
    const tiers = mergeTierConfigsWithAdminConfig(Object.values(TIER_CONFIGS), {
      pricing: [
        { tier: 'pro', monthlyPrice: 8800, yearlyPrice: 80000 },
      ],
      creditQuotas: [
        { tier: 'pro', monthlyCredits: 88 },
      ],
    });

    const pro = tiers.find((tier) => tier.tier === 'pro');
    expect(pro?.monthlyPrice).toBe(8800);
    expect(pro?.yearlyPrice).toBe(80000);
    expect(pro?.monthlyCredits).toBe(88);
  });

  it('keeps defaults when admin config omits a tier', () => {
    const tiers = mergeTierConfigsWithAdminConfig(Object.values(TIER_CONFIGS), {
      pricing: [
        { tier: 'pro', monthlyPrice: 8800, yearlyPrice: 80000 },
      ],
      creditQuotas: [],
    });

    const business = tiers.find((tier) => tier.tier === 'business');
    expect(business?.monthlyPrice).toBe(TIER_CONFIGS.business.monthlyPrice);
    expect(business?.monthlyCredits).toBe(TIER_CONFIGS.business.monthlyCredits);
  });
});
