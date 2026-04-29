'use client';

import { useCallback } from 'react';
import { useMembershipStore } from '@/store/membershipStore';
import { TIER_CONFIGS } from '@/config/tierConfig';
import type { FeatureKey, MembershipTier } from '@/types/membership';

const TIER_ORDER: MembershipTier[] = ['free', 'pro', 'business'];

/**
 * Find the lowest tier that includes the given feature.
 * Returns 'business' as fallback if no tier has the feature.
 */
function getRequiredTier(feature: FeatureKey): MembershipTier {
  for (const tier of TIER_ORDER) {
    if (TIER_CONFIGS[tier].features.includes(feature)) {
      return tier;
    }
  }
  return 'business';
}

export interface MembershipPermissionResult {
  hasPermission: boolean;
  currentTier: MembershipTier;
  requiredTier: MembershipTier;
  showUpgradePrompt: boolean;
}

/**
 * Hook to check if the current user has permission for a given feature.
 * Returns permission status, current/required tiers, and whether to show upgrade prompt.
 */
export function useMembershipPermission(feature: FeatureKey): MembershipPermissionResult {
  const currentTier = useMembershipStore((s) => s.currentTier());
  const tierConfig = TIER_CONFIGS[currentTier];
  const hasPermission = tierConfig.features.includes(feature);
  const requiredTier = getRequiredTier(feature);
  const showUpgradePrompt = !hasPermission;

  return {
    hasPermission,
    currentTier,
    requiredTier,
    showUpgradePrompt,
  };
}
