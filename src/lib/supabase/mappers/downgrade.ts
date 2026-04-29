// mappers/downgrade.ts - DowngradedFileAccess ↔ downgraded_file_access 行转换

import type { Tables, UpdateTables } from '../types';
import type { DowngradedFileAccess } from '../../../types/downgrade';
import type { ExportFormat } from '../../../config/tierConfig';

/**
 * 将数据库 downgraded_file_access 行转换为业务层 DowngradedFileAccess 对象
 * JSONB export_format 字段直接解析为 ExportFormat 类型
 */
export function toDowngradedFileAccess(row: Tables<'downgraded_file_access'>): DowngradedFileAccess {
  return {
    fileId: row.file_id,
    userId: row.user_id,
    originalTier: row.original_tier,
    exportFormat: row.export_format as unknown as ExportFormat,
    generatedAt: new Date(row.generated_at),
    gracePeriodEnd: new Date(row.grace_period_end),
    accessStatus: row.access_status,
  };
}

/**
 * 将业务层 DowngradedFileAccess 转换为数据库 downgraded_file_access 更新对象
 * ExportFormat 序列化为 JSONB
 */
export function fromDowngradedFileAccess(info: DowngradedFileAccess): Partial<UpdateTables<'downgraded_file_access'>> {
  return {
    file_id: info.fileId,
    user_id: info.userId,
    original_tier: info.originalTier,
    export_format: info.exportFormat as unknown as Record<string, unknown>,
    generated_at: info.generatedAt.toISOString(),
    grace_period_end: info.gracePeriodEnd.toISOString(),
    access_status: info.accessStatus,
  };
}
