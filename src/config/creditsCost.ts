// config/creditsCost.ts - Credits 消耗规则常量

import type { CreditOperationType, CreditsCostRule } from '../types/credits';

/**
 * Credits 消耗规则
 *
 * Preview（30 秒预览）= 1 Credit
 * Full Demo（2 分钟完整）= 10-20 Credits
 * 高级歌手声模 = 额外 +5 Credits
 * WAV 导出 = +3 Credits
 * 分轨导出 = +10 Credits
 */
export const CREDITS_COST: Record<CreditOperationType, number> = {
  preview: 1,
  full_demo_short: 10,
  full_demo_long: 20,
  premium_singer: 5,
  export_wav: 3,
  export_stems: 10,
  arrangement_generation: 15, // 上传音频生成编曲
  purchase: 0,            // 购买入账不消耗 Credits
};

/** 消耗规则详情列表（含描述） */
export const CREDITS_COST_RULES: CreditsCostRule[] = [
  { operation: 'preview', cost: 1, description: 'Preview 预览试听（30 秒）' },
  { operation: 'full_demo_short', cost: 10, description: '完整 Demo（短版）' },
  { operation: 'full_demo_long', cost: 20, description: '完整 Demo（长版）' },
  { operation: 'premium_singer', cost: 5, description: '高级歌手声模（额外消耗）' },
  { operation: 'export_wav', cost: 3, description: 'WAV 高品质导出' },
  { operation: 'export_stems', cost: 10, description: '分轨导出' },
  { operation: 'arrangement_generation', cost: 15, description: '上传音频生成编曲' },
];

/**
 * 计算一次生成任务的总 Credits 消耗
 */
export function calculateGenerationCost(
  type: 'preview' | 'full_demo_short' | 'full_demo_long',
  isPremiumSinger: boolean
): number {
  const baseCost = CREDITS_COST[type];
  const singerCost = isPremiumSinger ? CREDITS_COST.premium_singer : 0;
  return baseCost + singerCost;
}
