// types/credits.ts - Credits 积分系统类型定义

import type { MembershipTier } from './membership';

/** Credits 信息 */
export interface CreditInfo {
  userId: string;
  tier: MembershipTier;
  used: number;           // 本月已消耗 Credits
  total: number;          // 本月总 Credits 配额
  remaining: number;      // 剩余 Credits
  periodStart: Date;      // 当前计费周期开始
  periodEnd: Date;        // 当前计费周期结束（下次刷新）
}

/** Credits 使用历史 */
export interface CreditHistory {
  month: string;          // 格式：'2024-01'
  used: number;
  total: number;
}

/** Free 用户 Preview 次数信息 */
export interface PreviewCountInfo {
  userId: string;
  used: number;           // 本月已使用 Preview 次数
  total: number;          // 每月总 Preview 次数（3）
  remaining: number;      // 剩余 Preview 次数
}

/** Credits 消耗结果 */
export interface ConsumeResult {
  success: boolean;
  remaining: number;
  consumed: number;
  error?: 'no_credits' | 'no_previews' | 'concurrent_limit';
}

/** Credits 消耗操作类型 */
export type CreditOperationType =
  | 'preview'             // Preview 预览试听（30 秒）
  | 'full_demo_short'     // 完整 Demo（短版，10 Credits）
  | 'full_demo_long'      // 完整 Demo（长版，20 Credits）
  | 'premium_singer'      // 高级歌手声模（额外消耗）
  | 'export_wav'          // WAV 导出
  | 'export_stems';       // 分轨导出

/** Credits 消耗规则 */
export interface CreditsCostRule {
  operation: CreditOperationType;
  cost: number;
  description: string;
}
