// types/downgrade.ts - 降级文件访问类型定义

import type { MembershipTier } from './membership';
import type { ExportFormat } from '../config/tierConfig';

/** 降级后文件访问状态 */
export interface DowngradedFileAccess {
  fileId: string;
  userId: string;
  originalTier: MembershipTier;     // 生成时的等级
  exportFormat: ExportFormat;
  generatedAt: Date;
  gracePeriodEnd: Date;             // 宽限期结束（降级后 30 天）
  accessStatus: 'accessible' | 'upgrade_required';
}
