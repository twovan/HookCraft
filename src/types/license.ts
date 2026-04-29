// types/license.ts - 授权相关类型定义

import type { LicenseLevel, MembershipTier } from './membership';

/** 授权信息 */
export interface LicenseInfo {
  level: LicenseLevel;
  tier: MembershipTier;
  userId: string;
  generatedAt: Date;
  trackId: string;                // 生成的音乐 ID
}

/** 授权等级描述映射 */
export const LICENSE_DESCRIPTIONS: Record<LicenseLevel, string> = {
  personal: '仅限个人非商业使用',
  commercial: '个人商业使用（自媒体、独立游戏、单人项目）',
  full_commercial: '完整商业授权（团队项目、企业用途、广告、影视）',
};

// Re-export LicenseLevel for convenience
export type { LicenseLevel } from './membership';
