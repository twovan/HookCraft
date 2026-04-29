// lib/downgrade/DowngradeService.ts - 降级文件访问管理服务（Supabase 版）

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type { DowngradedFileAccess } from '../../types/downgrade';
import { TIER_CONFIGS, type ExportFormat } from '../../config/tierConfig';
import { toDowngradedFileAccess } from '../supabase/mappers/downgrade';
import { toAppError } from '../supabase/errors';

/**
 * DowngradeService - 降级文件访问管理服务
 *
 * 负责降级后文件访问状态判断、宽限期检查和文件标记。
 * 宽限期为降级后 30 天，期间文件保持可访问。
 * 超过宽限期且文件格式超出 Free 等级范围时标记为 upgrade_required。
 *
 * 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。
 */
export class DowngradeService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 获取文件访问状态
   *
   * 从 downgraded_file_access 表查询指定 file_id 的记录，
   * 然后根据宽限期和格式判断访问状态。
   *
   * @param fileId - 文件 ID
   * @returns DowngradedFileAccess 包含访问状态
   */
  async getFileAccessStatus(fileId: string): Promise<DowngradedFileAccess | null> {
    const { data, error } = await this.supabase
      .from('downgraded_file_access')
      .select('*')
      .eq('file_id', fileId)
      .single();

    if (error) {
      // PGRST116 = no rows found, return null instead of throwing
      if (error.code === 'PGRST116') {
        return null;
      }
      throw toAppError(error, 'downgraded_file_access', 'select');
    }

    return toDowngradedFileAccess(data);
  }

  /**
   * 批量标记文件为 upgrade_required
   *
   * 检查每个文件的格式是否超出 Free 等级支持范围，
   * 超出的批量更新 access_status 为 'upgrade_required'。
   *
   * @param userId - 用户 ID
   * @param fileIds - 文件 ID 列表
   * @returns 更新后的文件列表
   */
  async markFilesForUpgrade(
    userId: string,
    fileIds: string[]
  ): Promise<DowngradedFileAccess[]> {
    if (fileIds.length === 0) {
      return [];
    }

    // 查询所有指定文件的记录
    const { data, error } = await this.supabase
      .from('downgraded_file_access')
      .select('*')
      .eq('user_id', userId)
      .in('file_id', fileIds);

    if (error) throw toAppError(error, 'downgraded_file_access', 'select');

    const files = (data ?? []).map(toDowngradedFileAccess);

    // 分类：需要标记为 upgrade_required 的文件 ID
    const upgradeRequiredIds: string[] = [];
    const results: DowngradedFileAccess[] = [];

    for (const file of files) {
      const status = this.isFormatWithinFreeTier(file.exportFormat)
        ? 'accessible' as const
        : 'upgrade_required' as const;

      if (status === 'upgrade_required') {
        upgradeRequiredIds.push(file.fileId);
      }

      results.push({ ...file, accessStatus: status });
    }

    // 批量更新需要标记的文件
    if (upgradeRequiredIds.length > 0) {
      const { error: updateError } = await this.supabase
        .from('downgraded_file_access')
        .update({
          access_status: 'upgrade_required',
        })
        .eq('user_id', userId)
        .in('file_id', upgradeRequiredIds);

      if (updateError) throw toAppError(updateError, 'downgraded_file_access', 'update');
    }

    // 批量更新保持 accessible 的文件（确保状态一致）
    const accessibleIds = fileIds.filter((id) => !upgradeRequiredIds.includes(id));
    if (accessibleIds.length > 0) {
      const { error: updateError } = await this.supabase
        .from('downgraded_file_access')
        .update({
          access_status: 'accessible',
        })
        .eq('user_id', userId)
        .in('file_id', accessibleIds);

      if (updateError) throw toAppError(updateError, 'downgraded_file_access', 'update');
    }

    return results;
  }

  /**
   * 检查当前日期是否在宽限期内
   *
   * @param gracePeriodEnd - 宽限期结束日期
   * @returns true 表示在宽限期内
   */
  isWithinGracePeriod(gracePeriodEnd: Date): boolean {
    const now = new Date();
    return now.getTime() <= gracePeriodEnd.getTime();
  }

  /**
   * 根据文件信息计算访问状态
   *
   * 宽限期内返回 'accessible'，超过宽限期且格式超出 Free 等级范围返回 'upgrade_required'。
   *
   * @param file - 降级文件访问信息
   * @returns 'accessible' | 'upgrade_required'
   */
  computeAccessStatus(file: DowngradedFileAccess): 'accessible' | 'upgrade_required' {
    // 宽限期内，所有文件可访问
    if (this.isWithinGracePeriod(file.gracePeriodEnd)) {
      return 'accessible';
    }

    // 超过宽限期，检查文件格式是否在 Free 等级支持范围内
    if (this.isFormatWithinFreeTier(file.exportFormat)) {
      return 'accessible';
    }

    return 'upgrade_required';
  }

  /**
   * 检查导出格式是否在 Free 等级支持范围内
   *
   * Free 等级仅支持 mp3（128kbps）
   */
  private isFormatWithinFreeTier(format: ExportFormat): boolean {
    const freeFormats = TIER_CONFIGS.free.exportFormats;
    return freeFormats.some(
      (f) => f.format === format.format && f.quality === format.quality
    );
  }
}
