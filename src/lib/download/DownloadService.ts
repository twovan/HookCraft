// lib/download/DownloadService.ts - 下载服务
//
// 负责根据会员等级约束提供音频文件下载。
// 仅提供 MP3 格式，按月限制下载次数。

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type { MembershipTier } from '../../types/membership';
import type { DownloadCountInfo, DownloadResult } from '../../types/download';
import { DOWNLOAD_LIMITS } from '../../types/download';
import { toAppError } from '../supabase/errors';

/**
 * DownloadService - 下载服务
 *
 * 负责：
 * - 校验版本状态为 selected
 * - 检查月下载次数限制
 * - 从 Supabase Storage 获取音频
 * - 返回 MP3 二进制流
 *
 * 下载计数使用原子操作确保并发安全。
 */
export class DownloadService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 下载选中版本的音频文件
   *
   * @param userId 用户 ID
   * @param userTier 用户会员等级
   * @param taskId 要下载的任务 ID（必须为 selected 状态）
   * @returns DownloadResult
   */
  async download(
    userId: string,
    userTier: MembershipTier,
    taskId: string,
  ): Promise<DownloadResult> {
    // 1. 验证任务状态为 selected
    const { data: task, error: taskError } = await this.supabase
      .from('generation_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (taskError || !task) {
      return { success: false, error: '任务不存在或无权访问' };
    }

    if (task.status !== 'selected') {
      return { success: false, error: '只能下载已选中的版本，请先选择一个版本' };
    }

    if (!task.audio_path) {
      return { success: false, error: '音频文件不存在，请重新生成' };
    }

    // 2. 检查月下载次数
    const canDl = await this.canDownload(userId, userTier);
    if (!canDl) {
      return { success: false, error: '本月下载次数已用尽，升级获取更多下载次数' };
    }

    // 3. 原子递增下载计数
    const incrementSuccess = await this.incrementDownloadCount(userId, userTier);
    if (!incrementSuccess) {
      return { success: false, error: '本月下载次数已用尽，升级获取更多下载次数' };
    }

    // 4. 从 Storage 获取音频文件
    const { data: fileData, error: downloadError } = await this.supabase.storage
      .from('generations')
      .download(task.audio_path);

    if (downloadError || !fileData) {
      return { success: false, error: '音频文件下载失败，请重试' };
    }

    // 转换为 Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // 构建文件名
    const batchId = task.batch_id ?? 'unknown';
    const versionNumber = task.version_number ?? 1;
    const filename = `creation-${batchId}-v${versionNumber}.mp3`;

    return {
      success: true,
      audioBuffer,
      filename,
    };
  }

  /**
   * 获取用户当月下载次数信息
   *
   * 如果当月记录不存在，自动创建。
   */
  async getDownloadCount(userId: string): Promise<DownloadCountInfo> {
    const { periodStart, periodEnd } = this.getCurrentPeriod();

    // 尝试获取当月记录
    const { data, error } = await this.supabase
      .from('download_counts')
      .select('*')
      .eq('user_id', userId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd)
      .maybeSingle();

    if (error) throw toAppError(error, 'download_counts', 'select');

    if (data) {
      return {
        used: data.used,
        total: data.total,
        remaining: Math.max(0, data.total - data.used),
        periodStart: data.period_start,
        periodEnd: data.period_end,
      };
    }

    // 记录不存在，返回默认值（不在此处创建，由 incrementDownloadCount 处理）
    return {
      used: 0,
      total: 0,
      remaining: 0,
      periodStart,
      periodEnd,
    };
  }

  /**
   * 检查用户是否可以下载
   *
   * @param userId 用户 ID
   * @param userTier 用户会员等级
   * @returns true 表示可以下载
   */
  async canDownload(userId: string, userTier: MembershipTier): Promise<boolean> {
    const limit = DOWNLOAD_LIMITS[userTier];
    const { periodStart, periodEnd } = this.getCurrentPeriod();

    // 尝试获取当月记录
    const { data, error } = await this.supabase
      .from('download_counts')
      .select('used, total')
      .eq('user_id', userId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd)
      .maybeSingle();

    if (error) throw toAppError(error, 'download_counts', 'select');

    if (!data) {
      // 没有记录，说明本月还没下载过
      return true;
    }

    return data.used < limit;
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 原子递增下载计数
   *
   * 使用 UPDATE ... SET used = used + 1 WHERE used < total 确保并发安全。
   * 如果当月记录不存在，先创建再递增。
   */
  private async incrementDownloadCount(
    userId: string,
    userTier: MembershipTier,
  ): Promise<boolean> {
    const limit = DOWNLOAD_LIMITS[userTier];
    const { periodStart, periodEnd } = this.getCurrentPeriod();

    // 尝试获取当月记录
    const { data: existing, error: selectError } = await this.supabase
      .from('download_counts')
      .select('id, used, total')
      .eq('user_id', userId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd)
      .maybeSingle();

    if (selectError) throw toAppError(selectError, 'download_counts', 'select');

    if (!existing) {
      // 创建当月记录，used 初始为 1（本次下载）
      const { error: insertError } = await this.supabase
        .from('download_counts')
        .insert({
          user_id: userId,
          used: 1,
          total: limit,
          period_start: periodStart,
          period_end: periodEnd,
        });

      if (insertError) {
        // 可能是并发插入导致唯一约束冲突，重试更新
        if (insertError.code === '23505') {
          return this.tryAtomicIncrement(userId, periodStart, periodEnd, limit);
        }
        throw toAppError(insertError, 'download_counts', 'insert');
      }
      return true;
    }

    // 记录已存在，原子递增
    if (existing.used >= limit) {
      return false;
    }

    return this.tryAtomicIncrement(userId, periodStart, periodEnd, limit);
  }

  /**
   * 尝试原子递增（UPDATE ... WHERE used < total）
   */
  private async tryAtomicIncrement(
    userId: string,
    periodStart: string,
    periodEnd: string,
    limit: number,
  ): Promise<boolean> {
    // 使用 RPC 或直接 update with filter
    // Supabase 不直接支持 SET used = used + 1，使用 select + update with version check
    const { data, error } = await this.supabase
      .from('download_counts')
      .select('id, used')
      .eq('user_id', userId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd)
      .single();

    if (error) throw toAppError(error, 'download_counts', 'select');

    if (data.used >= limit) {
      return false;
    }

    const { data: updated, error: updateError } = await this.supabase
      .from('download_counts')
      .update({
        used: data.used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('used', data.used) // 乐观锁：确保 used 没有被并发修改
      .select('id');

    if (updateError) throw toAppError(updateError, 'download_counts', 'update');

    // 如果没有行被更新，说明并发冲突
    if (!updated || updated.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * 获取当前计费周期的起止时间
   */
  private getCurrentPeriod(): { periodStart: string; periodEnd: string } {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  }
}
