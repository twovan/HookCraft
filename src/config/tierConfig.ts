// config/tierConfig.ts - 等级配置常量

import type { MembershipTier, LicenseLevel, FeatureKey } from '../types/membership';

/** 导出格式 */
export interface ExportFormat {
  format: 'mp3' | 'wav' | 'midi' | 'stems';
  quality?: string;
}

/** 等级配置接口 */
export interface TierConfig {
  tier: MembershipTier;
  name: string;
  monthlyPrice: number;            // 月付价格（分）
  yearlyPrice: number;             // 年付价格（分）
  monthlyCredits: number;          // 每月 Credits 配额（Free 为 0，用次数管理）
  monthlyPreviews: number;         // 每月 Preview 次数（仅 Free 使用）
  maxConcurrentTasks: number;
  exportFormats: ExportFormat[];
  features: FeatureKey[];
  licenseLevel: LicenseLevel;
  hasPriorityQueue: boolean;
}

/**
 * 三个等级的完整配置
 *
 * Free: ¥0, 3 次 Preview/月, 不能完整生成, 不能用声模, 不能商用
 * Pro: ¥199/月, 100 Credits/月, Preview+Full Demo+声模, 个人商用
 * Business: ¥499/月, 300 Credits/月, 优先队列+高清导出+完整商用+充值折扣
 */
export const TIER_CONFIGS: Record<MembershipTier, TierConfig> = {
  free: {
    tier: 'free',
    name: '免费版',
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyCredits: 0,
    monthlyPreviews: 3,
    maxConcurrentTasks: 1,
    exportFormats: [{ format: 'mp3', quality: '128kbps' }],
    features: [
      'preview',
      'free_template',
    ],
    licenseLevel: 'personal',
    hasPriorityQueue: false,
  },
  pro: {
    tier: 'pro',
    name: '专业版',
    monthlyPrice: 19900,           // ¥199
    yearlyPrice: 191040,           // ¥1910.4（8 折）
    monthlyCredits: 100,
    monthlyPreviews: 0,            // 付费用户用 Credits，不限次数
    maxConcurrentTasks: 3,
    exportFormats: [
      { format: 'mp3', quality: '320kbps' },
      { format: 'wav' },
    ],
    features: [
      'preview',
      'full_demo',
      'base_singer',
      'premium_singer',
      'free_template',
      'paid_template',
      'reference_audio_upload',
      'multi_track_editor',
      'effects_processor',
      'export_wav',
      'export_mp3_320',
      'commercial_use',
      'image_input',
    ],
    licenseLevel: 'commercial',
    hasPriorityQueue: false,
  },
  business: {
    tier: 'business',
    name: '商业版',
    monthlyPrice: 49900,           // ¥499
    yearlyPrice: 479040,           // ¥4790.4（8 折）
    monthlyCredits: 300,
    monthlyPreviews: 0,
    maxConcurrentTasks: 5,
    exportFormats: [
      { format: 'mp3', quality: '320kbps' },
      { format: 'wav' },
      { format: 'midi' },
      { format: 'stems' },
    ],
    features: [
      'preview',
      'full_demo',
      'base_singer',
      'premium_singer',
      'free_template',
      'paid_template',
      'reference_audio_upload',
      'multi_track_editor',
      'effects_processor',
      'ai_mixing',
      'ai_mastering',
      'export_wav',
      'export_midi',
      'export_stems',
      'export_mp3_320',
      'priority_queue',
      'commercial_use',
      'full_commercial_use',
      'credits_pack_discount',
      'image_input',
    ],
    licenseLevel: 'full_commercial',
    hasPriorityQueue: true,
  },
};
