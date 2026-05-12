// types/download.ts - 下载服务类型定义

import { MembershipTier } from '@/types/membership';

/** 下载次数信息 */
export interface DownloadCountInfo {
  used: number;
  total: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
}

/** 下载结果 */
export interface DownloadResult {
  success: boolean;
  audioBuffer?: Buffer;
  filename?: string;
  error?: string;
}

/** 各会员等级的月下载次数上限 */
export const DOWNLOAD_LIMITS: Record<MembershipTier, number> = {
  free: 3,
  pro: 30,
  business: 100,
};
