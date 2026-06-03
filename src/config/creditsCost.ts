// config/creditsCost.ts - default Credits cost rules.

import type { CreditOperationType, CreditsCostRule } from '../types/credits';

export const CREDITS_COST: Record<CreditOperationType, number> = {
  preview: 1,
  full_demo_short: 10,
  full_demo_long: 20,
  premium_singer: 5,
  export_wav: 3,
  export_stems: 10,
  arrangement_generation: 15,
  cover_generation: 20,
  add_instrumental: 20,
  stem_split: 10,
  stem_split_advanced: 50,
  ai_preprocess: 2,
  purchase: 0,
};

export const CREDITS_COST_RULES: CreditsCostRule[] = [
  { operation: 'preview', cost: 1, description: 'Preview preview generation', enabled: true },
  { operation: 'full_demo_short', cost: 10, description: 'Full demo, short version', enabled: true },
  { operation: 'full_demo_long', cost: 20, description: 'Full demo, long version', enabled: true },
  { operation: 'premium_singer', cost: 5, description: 'Premium singer voice add-on', enabled: true },
  { operation: 'export_wav', cost: 3, description: 'WAV export', enabled: true },
  { operation: 'export_stems', cost: 10, description: 'Stem export', enabled: true },
  { operation: 'arrangement_generation', cost: 15, description: 'Upload audio and generate arrangement', enabled: true },
  { operation: 'cover_generation', cost: 20, description: 'AI cover generation', enabled: true },
  { operation: 'add_instrumental', cost: 20, description: 'AI add instrumental', enabled: true },
  { operation: 'stem_split', cost: 10, description: 'AI stem split', enabled: true },
  { operation: 'stem_split_advanced', cost: 50, description: 'AI advanced stem analysis result', enabled: true },
  { operation: 'ai_preprocess', cost: 2, description: 'AI preprocess or audio analysis', enabled: true },
];

export function calculateGenerationCost(
  type: 'preview' | 'full_demo_short' | 'full_demo_long',
  isPremiumSinger: boolean
): number {
  const baseCost = CREDITS_COST[type];
  const singerCost = isPremiumSinger ? CREDITS_COST.premium_singer : 0;
  return baseCost + singerCost;
}
