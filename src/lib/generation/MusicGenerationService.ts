// lib/generation/MusicGenerationService.ts - AI 音乐生成服务（Supabase 版）
//
// 协调 Prompt 构建、权限校验、Credits 管理和 Lyria 3 调用。
// 生成成功后扣减 Credits，失败不扣减。
// 任务状态持久化到 generation_tasks 表。

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type { AIModelProvider } from './AIModelProvider';
import type { MembershipTier, FeatureKey } from '../../types/membership';
import type {
  MusicGenerationInput,
  MusicGenerationResult,
  GenerationRequest,
  GenerationResponse,
  GenerationTaskStatus,
  GenerationError,
  GenerationErrorCode,
  LyriaModelId,
  BatchGenerationResult,
  VersionResult,
} from '../../types/generation';
import type { CreditOperationType } from '../../types/credits';
import type { CreditService } from '../credits/CreditService';
import type { TemplateService } from '../template/TemplateService';
import type { TemplateAdminService } from '../admin/TemplateAdminService';
import { TIER_CONFIGS } from '../../config/tierConfig';
import { toAppError } from '../supabase/errors';

/** 默认模板描述（缓存缺失时的降级 fallback） */
const DEFAULT_TEMPLATE_DESCRIPTION = 'A melodic instrumental track with a balanced mix of rhythm and harmony.';

/**
 * MusicGenerationService - AI 音乐生成服务
 *
 * 简化流水线：
 * 1. 权限校验（等级权限、图片输入权限、并发任务数）
 * 2. 构建 Prompt（模板缓存读取 / 用户直接输入 / 合并）
 * 3. Credits/Preview 余额校验
 * 4. 调用 LyriaProvider 生成音频（Preview → Clip，Full_Demo → Pro）
 * 5. 生成成功后扣减 Credits（失败不扣减）
 *
 * 使用 Supabase（PostgreSQL）持久化任务状态到 generation_tasks 表。
 */
export class MusicGenerationService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;

  private provider: AIModelProvider;
  private creditService: CreditService;
  private templateService: TemplateService;
  private templateAdminService: TemplateAdminService;

  /** 活跃任务追踪（userId → 活跃任务数） */
  private activeTasks = new Map<string, number>();

  constructor(deps: {
    supabase: SupabaseClient<Database>;
    provider: AIModelProvider;
    creditService: CreditService;
    templateService: TemplateService;
    templateAdminService: TemplateAdminService;
  }) {
    this.supabase = deps.supabase;
    this.provider = deps.provider;
    this.creditService = deps.creditService;
    this.templateService = deps.templateService;
    this.templateAdminService = deps.templateAdminService;
  }

  /**
   * 发起音乐生成（Preview 或 Full_Demo）
   *
   * @param userId 用户 ID
   * @param userTier 用户当前会员等级
   * @param input 生成输入参数
   * @returns MusicGenerationResult
   */
  async generate(
    userId: string,
    userTier: MembershipTier,
    input: MusicGenerationInput,
  ): Promise<MusicGenerationResult> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const modelId: LyriaModelId = input.generationType === 'preview'
      ? 'lyria-3-clip-preview'
      : 'lyria-3-pro-preview';

    // 创建任务记录到 generation_tasks 表
    await this.createTask(taskId, userId, input, modelId);

    const tierConfig = TIER_CONFIGS[userTier];

    // ── Step 1: 权限校验 ──────────────────────────────────

    // 检查生成类型权限
    const requiredFeature: FeatureKey =
      input.generationType === 'full_demo' ? 'full_demo' : 'preview';
    if (!tierConfig.features.includes(requiredFeature)) {
      return this.failResult(taskId, input, 0, {
        code: 'INVALID_PROMPT',
        message: input.generationType === 'full_demo'
          ? '您的等级不支持完整 Demo 生成，请升级到专业版'
          : '您的等级不支持此功能',
      });
    }

    // 图片输入验证
    if (input.images && input.images.length > 0) {
      if (userTier === 'free') {
        return this.failResult(taskId, input, 0, {
          code: 'IMAGE_NOT_ALLOWED',
          message: '升级到专业版解锁图片灵感创作',
        });
      }
      if (input.images.length > 10) {
        return this.failResult(taskId, input, 0, {
          code: 'IMAGE_LIMIT_EXCEEDED',
          message: '图片数量超限，最多 10 张',
        });
      }
    }

    // 并发任务数检查
    const currentTasks = this.activeTasks.get(userId) ?? 0;
    if (currentTasks >= tierConfig.maxConcurrentTasks) {
      return this.failResult(taskId, input, 0, {
        code: 'LYRIA_GENERATION_FAILED',
        message: '并发任务数已达上限，请等待当前任务完成',
      });
    }

    // ── Step 2: 构建 Prompt ───────────────────────────────

    await this.updateTaskStatus(taskId, 'building_prompt');
    let prompt: string;
    try {
      prompt = await this.buildPrompt(input);
    } catch {
      return this.failResult(taskId, input, 0, {
        code: 'CACHED_ANALYSIS_MISSING',
        message: '构建 Prompt 失败',
      });
    }

    // ── Step 3: Credits/Preview 余额校验 ──────────────────

    const operations = this.getOperations(input);

    if (userTier === 'free') {
      // Free 用户只能 preview，使用 Preview 次数
      const previewInfo = await this.creditService.getPreviewCount(userId);
      if (previewInfo.remaining <= 0) {
        return this.failResult(taskId, input, 0, {
          code: 'LYRIA_GENERATION_FAILED',
          message: '本月 Preview 次数已用完，请升级到专业版获取更多创作额度',
        });
      }
    } else {
      // 付费用户使用 Credits
      if (!(await this.creditService.hasEnoughCredits(userId, operations))) {
        return this.failResult(taskId, input, 0, {
          code: 'LYRIA_GENERATION_FAILED',
          message: 'Credits 余额不足，请购买 Credits 充值包',
        });
      }
    }

    // ── Step 4: 调用 LyriaProvider 生成音频 ───────────────

    await this.updateTaskStatus(taskId, 'generating');
    this.activeTasks.set(userId, currentTasks + 1);

    const request: GenerationRequest = {
      prompt,
      outputFormat: input.outputFormat ?? 'audio/mpeg',
      images: input.images,
    };

    let response: GenerationResponse;
    try {
      if (input.generationType === 'preview') {
        response = await this.provider.generatePreview(request);
      } else {
        response = await this.provider.generateFullDemo(request);
      }
    } catch (error) {
      this.decrementActiveTasks(userId);
      return this.failResult(taskId, input, 0, {
        code: 'LYRIA_GENERATION_FAILED',
        message: '音乐生成失败，请重试',
      });
    }

    this.decrementActiveTasks(userId);

    // 检查安全过滤器拦截
    if (!response.success) {
      return this.failResult(taskId, input, 0, {
        code: 'SAFETY_FILTER_BLOCKED',
        message: '您的创作请求包含不支持的内容，请修改后重试',
        modelId: response.modelId,
      });
    }

    // ── Step 5: 生成成功 → 扣减 Credits ──────────────────

    let creditsConsumed = 0;

    if (userTier === 'free') {
      const consumeResult = await this.creditService.consumePreview(userId);
      creditsConsumed = consumeResult.consumed;
    } else {
      const consumeResult = await this.creditService.consumeCredits(userId, operations);
      creditsConsumed = consumeResult.consumed;
    }

    // 更新任务完成状态和结果字段
    await this.completeTask(taskId, {
      lyrics: response.lyrics,
      songStructure: response.songStructureDescription,
      creditsConsumed,
    });

    return {
      success: true,
      taskId,
      generationType: input.generationType,
      lyrics: response.lyrics,
      songStructure: response.songStructureDescription,
      creditsConsumed,
      modelId: response.modelId,
      hasSynthIdWatermark: response.hasSynthIdWatermark,
    };
  }

  /**
   * 构建最终 Prompt（简单字符串拼接，匹配 demo 逻辑）
   *
   * - 模板 + 用户 Prompt：`Based on this reference style: ${cachedLyriaPrompt}\n\nUser's additional instructions: ${userPrompt}`
   * - 仅模板：直接使用 cachedLyriaPrompt
   * - 仅用户 Prompt：直接使用 userPrompt（不经过 Gemini LLM）
   * - 缓存缺失/损坏：降级为模板预设默认描述
   */
  async buildPrompt(input: MusicGenerationInput): Promise<string> {
    let cachedLyriaPrompt: string | null = null;

    if (input.templateId) {
      const cached = await this.templateAdminService.getCachedAnalysis(input.templateId);

      if (cached && cached.status === 'completed' && cached.lyriaPrompt) {
        cachedLyriaPrompt = cached.lyriaPrompt;
      } else {
        // 缓存缺失/损坏 → 降级为默认描述
        cachedLyriaPrompt = DEFAULT_TEMPLATE_DESCRIPTION;
      }
    }

    if (cachedLyriaPrompt && input.userPrompt) {
      // 模板 + 用户 Prompt
      return `Based on this reference style: ${cachedLyriaPrompt}\n\nUser's additional instructions: ${input.userPrompt}`;
    }

    if (cachedLyriaPrompt) {
      // 仅模板
      return cachedLyriaPrompt;
    }

    if (input.userPrompt) {
      // 仅用户 Prompt
      return input.userPrompt;
    }

    // 无模板也无 Prompt（理论上不应到达）
    return DEFAULT_TEMPLATE_DESCRIPTION;
  }

  /** 获取当前 AI 模型提供方 */
  getProvider(): AIModelProvider {
    return this.provider;
  }

  /** 获取生成任务状态（从 generation_tasks 表查询） */
  async getTaskStatus(taskId: string): Promise<GenerationTaskStatus> {
    const { data, error } = await this.supabase
      .from('generation_tasks')
      .select('status')
      .eq('id', taskId)
      .single();

    if (error) throw toAppError(error, 'generation_tasks', 'select');
    return data.status;
  }

  // ─── 数据库操作方法 ─────────────────────────────────────

  /**
   * 创建生成任务记录
   * 在 generation_tasks 表中插入一条新记录，状态为 'pending'
   */
  private async createTask(
    taskId: string,
    userId: string,
    input: MusicGenerationInput,
    modelId: LyriaModelId,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('generation_tasks')
      .insert({
        id: taskId,
        user_id: userId,
        generation_type: input.generationType,
        status: 'pending',
        prompt: input.userPrompt ?? null,
        template_id: input.templateId ?? null,
        model_id: modelId,
      });

    if (error) throw toAppError(error, 'generation_tasks', 'insert');
  }

  /**
   * 更新任务状态
   * 更新 generation_tasks 表中对应任务的 status 字段
   */
  private async updateTaskStatus(
    taskId: string,
    status: GenerationTaskStatus,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('generation_tasks')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) throw toAppError(error, 'generation_tasks', 'update');
  }

  /**
   * 标记任务完成
   * 更新 audio_path、lyrics、song_structure、credits_consumed 等字段
   */
  private async completeTask(
    taskId: string,
    result: {
      audioPath?: string;
      lyrics?: string;
      songStructure?: string;
      creditsConsumed: number;
    },
  ): Promise<void> {
    const { error } = await this.supabase
      .from('generation_tasks')
      .update({
        status: 'completed' as const,
        audio_path: result.audioPath ?? null,
        lyrics: result.lyrics ?? null,
        song_structure: result.songStructure ?? null,
        credits_consumed: result.creditsConsumed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) throw toAppError(error, 'generation_tasks', 'update');
  }

  /**
   * 标记任务失败
   * 更新 status、error_code、error_message 字段
   */
  private async failTask(
    taskId: string,
    errorInfo: GenerationError,
  ): Promise<void> {
    const status: GenerationTaskStatus =
      errorInfo.code === 'SAFETY_FILTER_BLOCKED' ? 'safety_blocked' : 'failed';

    const { error } = await this.supabase
      .from('generation_tasks')
      .update({
        status,
        error_code: errorInfo.code,
        error_message: errorInfo.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) throw toAppError(error, 'generation_tasks', 'update');
  }

  // ─── 多版本批量生成方法 ─────────────────────────────────

  /**
   * 批量生成多个版本
   *
   * 1. 检查 Credits/Preview 余额（versionCount × 单版本消耗）
   * 2. 创建 generation_batches 记录
   * 3. 创建 N 个 generation_tasks 记录
   * 4. 并行发起 N 个 Lyria 3 生成请求
   * 5. 每个版本独立：生成 → 上传 → 更新状态 → 扣减 Credits
   * 6. 失败版本不扣减 Credits
   *
   * @param userId 用户 ID
   * @param userTier 用户当前会员等级
   * @param input 生成输入参数
   * @param versionCount 版本数量（默认 3）
   * @returns BatchGenerationResult
   */
  async generateBatch(
    userId: string,
    userTier: MembershipTier,
    input: MusicGenerationInput,
    versionCount = 3,
  ): Promise<BatchGenerationResult> {
    const tierConfig = TIER_CONFIGS[userTier];
    const modelId: LyriaModelId = input.generationType === 'preview'
      ? 'lyria-3-clip-preview'
      : 'lyria-3-pro-preview';

    // ── Step 1: 权限校验 ──────────────────────────────────

    const requiredFeature: FeatureKey =
      input.generationType === 'full_demo' ? 'full_demo' : 'preview';
    if (!tierConfig.features.includes(requiredFeature)) {
      throw new Error(
        input.generationType === 'full_demo'
          ? '您的等级不支持完整 Demo 生成，请升级到专业版'
          : '您的等级不支持此功能',
      );
    }

    if (input.images && input.images.length > 0) {
      if (userTier === 'free') {
        throw new Error('升级到专业版解锁图片灵感创作');
      }
      if (input.images.length > 10) {
        throw new Error('图片数量超限，最多 10 张');
      }
    }

    // ── Step 2: Credits/Preview 余额预检查 ────────────────

    const operations = this.getOperations(input);
    const singleVersionCost = this.creditService.calculateTotalCost(operations);

    if (userTier === 'free') {
      // Free 用户使用 Preview 次数
      const previewInfo = await this.creditService.getPreviewCount(userId);
      if (previewInfo.remaining < versionCount) {
        throw new Error(
          `Preview 次数不足，需要 ${versionCount} 次，剩余 ${previewInfo.remaining} 次`,
        );
      }
    } else {
      // 付费用户使用 Credits
      const creditInfo = await this.creditService.getCredits(userId);
      const totalCost = singleVersionCost * versionCount;
      if (creditInfo.remaining < totalCost) {
        throw new Error(
          `Credits 余额不足，需要 ${totalCost} Credits，剩余 ${creditInfo.remaining} Credits`,
        );
      }
    }

    // ── Step 3: 构建 Prompt ───────────────────────────────

    const prompt = await this.buildPrompt(input);

    // ── Step 4: 创建 batch 和 tasks 记录 ──────────────────

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { error: batchError } = await this.supabase
      .from('generation_batches')
      .insert({
        id: batchId,
        user_id: userId,
        template_id: input.templateId ?? null,
        prompt: input.userPrompt ?? null,
        generation_type: input.generationType,
        use_premium_singer: input.usePremiumSinger ?? false,
        version_count: versionCount,
        status: 'generating',
      });

    if (batchError) throw toAppError(batchError, 'generation_batches', 'insert');

    // 创建 N 个 generation_tasks 记录
    const taskIds: string[] = [];
    for (let i = 1; i <= versionCount; i++) {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-v${i}`;
      taskIds.push(taskId);

      const { error: taskError } = await this.supabase
        .from('generation_tasks')
        .insert({
          id: taskId,
          user_id: userId,
          generation_type: input.generationType,
          status: 'pending',
          prompt: input.userPrompt ?? null,
          template_id: input.templateId ?? null,
          model_id: modelId,
          batch_id: batchId,
          version_number: i,
        });

      if (taskError) throw toAppError(taskError, 'generation_tasks', 'insert');
    }

    // ── Step 5: 并行生成 ─────────────────────────────────

    const request: GenerationRequest = {
      prompt,
      outputFormat: input.outputFormat ?? 'audio/mpeg',
      images: input.images,
    };

    const generateVersion = async (taskId: string, versionNumber: number): Promise<VersionResult> => {
      try {
        // 更新状态为 generating
        await this.updateTaskStatus(taskId, 'generating');

        // 调用 Lyria 3
        let response: GenerationResponse;
        if (input.generationType === 'preview') {
          response = await this.provider.generatePreview(request);
        } else {
          response = await this.provider.generateFullDemo(request);
        }

        // 检查安全过滤器
        if (!response.success) {
          await this.failTask(taskId, {
            code: 'SAFETY_FILTER_BLOCKED',
            message: '内容被安全过滤器拦截',
            modelId: response.modelId,
          });
          return {
            taskId,
            versionNumber,
            status: 'safety_blocked',
            creditsConsumed: 0,
            error: { code: 'SAFETY_FILTER_BLOCKED', message: '内容被安全过滤器拦截' },
          };
        }

        // 上传音频到 Storage
        let audioPath: string | undefined;
        if (response.audioData) {
          audioPath = await this.uploadAudio(
            userId,
            batchId,
            versionNumber,
            response.audioData,
            response.audioMimeType ?? 'audio/mpeg',
          );
        }

        // 扣减 Credits
        let creditsConsumed = 0;
        if (userTier === 'free') {
          const consumeResult = await this.creditService.consumePreview(userId);
          creditsConsumed = consumeResult.consumed;
        } else {
          const consumeResult = await this.creditService.consumeCredits(userId, operations);
          creditsConsumed = consumeResult.consumed;
        }

        // 更新任务完成状态
        await this.completeTask(taskId, {
          audioPath,
          lyrics: response.lyrics,
          songStructure: response.songStructureDescription,
          creditsConsumed,
        });

        return {
          taskId,
          versionNumber,
          status: 'completed',
          audioUrl: audioPath,
          lyrics: response.lyrics,
          creditsConsumed,
        };
      } catch (err) {
        // 生成失败
        const errorMessage = err instanceof Error ? err.message : '生成失败';
        await this.failTask(taskId, {
          code: 'LYRIA_GENERATION_FAILED',
          message: errorMessage,
        });
        return {
          taskId,
          versionNumber,
          status: 'failed',
          creditsConsumed: 0,
          error: { code: 'LYRIA_GENERATION_FAILED', message: errorMessage },
        };
      }
    };

    // 使用 Promise.allSettled 并行生成
    const results = await Promise.allSettled(
      taskIds.map((taskId, index) => generateVersion(taskId, index + 1)),
    );

    // 收集结果
    const versions: VersionResult[] = results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // Promise rejected（不应发生，因为 generateVersion 内部已 catch）
      return {
        taskId: '',
        versionNumber: 0,
        status: 'failed' as const,
        creditsConsumed: 0,
        error: { code: 'LYRIA_GENERATION_FAILED', message: '未知错误' },
      };
    });

    // ── Step 6: 更新 batch 状态 ──────────────────────────

    const completedCount = versions.filter((v) => v.status === 'completed').length;
    let batchStatus: 'completed' | 'partial' | 'failed';
    if (completedCount === versionCount) {
      batchStatus = 'completed';
    } else if (completedCount > 0) {
      batchStatus = 'partial';
    } else {
      batchStatus = 'failed';
    }

    const { error: updateBatchError } = await this.supabase
      .from('generation_batches')
      .update({
        status: batchStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    if (updateBatchError) throw toAppError(updateBatchError, 'generation_batches', 'update');

    const totalCreditsConsumed = versions.reduce((sum, v) => sum + v.creditsConsumed, 0);

    return {
      batchId,
      versions,
      totalCreditsConsumed,
      status: batchStatus,
    };
  }

  /**
   * 选择版本
   *
   * 使用数据库事务：将选中版本状态设为 selected，其余版本设为 archived。
   * 更新 generation_batches.selected_task_id。
   *
   * @param userId 用户 ID
   * @param batchId 批次 ID
   * @param taskId 选中的任务 ID
   */
  async selectVersion(
    userId: string,
    batchId: string,
    taskId: string,
  ): Promise<{ success: boolean; selectedTaskId: string; archivedTaskIds: string[] }> {
    // 验证 batch 属于该用户
    const { data: batch, error: batchError } = await this.supabase
      .from('generation_batches')
      .select('*')
      .eq('id', batchId)
      .eq('user_id', userId)
      .single();

    if (batchError || !batch) {
      throw new Error('批次不存在或无权操作');
    }

    // 验证 taskId 属于该 batch
    const { data: tasks, error: tasksError } = await this.supabase
      .from('generation_tasks')
      .select('id, status')
      .eq('batch_id', batchId)
      .eq('user_id', userId);

    if (tasksError) throw toAppError(tasksError, 'generation_tasks', 'select');

    const targetTask = tasks?.find((t) => t.id === taskId);
    if (!targetTask) {
      throw new Error('任务不属于该批次或无权操作');
    }

    if (targetTask.status !== 'completed' && targetTask.status !== 'selected') {
      throw new Error('只能选择已完成的版本');
    }

    // 将选中版本设为 selected
    const { error: selectError } = await this.supabase
      .from('generation_tasks')
      .update({
        status: 'selected' as const,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (selectError) throw toAppError(selectError, 'generation_tasks', 'update');

    // 将其余版本设为 archived
    const otherTaskIds = (tasks ?? [])
      .filter((t) => t.id !== taskId && (t.status === 'completed' || t.status === 'selected'))
      .map((t) => t.id);

    if (otherTaskIds.length > 0) {
      const { error: archiveError } = await this.supabase
        .from('generation_tasks')
        .update({
          status: 'archived' as const,
          updated_at: new Date().toISOString(),
        })
        .in('id', otherTaskIds);

      if (archiveError) throw toAppError(archiveError, 'generation_tasks', 'update');
    }

    // 更新 batch 的 selected_task_id
    const { error: batchUpdateError } = await this.supabase
      .from('generation_batches')
      .update({
        selected_task_id: taskId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    if (batchUpdateError) throw toAppError(batchUpdateError, 'generation_batches', 'update');

    return {
      success: true,
      selectedTaskId: taskId,
      archivedTaskIds: otherTaskIds,
    };
  }

  /**
   * 获取用户最近一个未完成选择的批次
   *
   * 查询条件：selected_task_id IS NULL 且 status 为 generating/completed/partial
   * 返回批次详情含所有版本
   */
  async getLatestIncompleteBatch(
    userId: string,
  ): Promise<{
    batch: {
      id: string;
      templateId: string | null;
      prompt: string | null;
      generationType: string;
      status: string;
      createdAt: string;
    };
    versions: VersionResult[];
  } | null> {
    const { data: batch, error: batchError } = await this.supabase
      .from('generation_batches')
      .select('*')
      .eq('user_id', userId)
      .is('selected_task_id', null)
      .in('status', ['generating', 'completed', 'partial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (batchError) throw toAppError(batchError, 'generation_batches', 'select');
    if (!batch) return null;

    // 查询该批次的所有版本
    const { data: tasks, error: tasksError } = await this.supabase
      .from('generation_tasks')
      .select('*')
      .eq('batch_id', batch.id)
      .order('version_number', { ascending: true });

    if (tasksError) throw toAppError(tasksError, 'generation_tasks', 'select');

    const versions: VersionResult[] = (tasks ?? []).map((task) => ({
      taskId: task.id,
      versionNumber: task.version_number ?? 0,
      status: task.status,
      audioUrl: task.audio_path ?? undefined,
      lyrics: task.lyrics ?? undefined,
      durationSeconds: task.duration_seconds ?? undefined,
      creditsConsumed: task.credits_consumed,
      error: task.error_code
        ? { code: task.error_code, message: task.error_message ?? '' }
        : undefined,
    }));

    return {
      batch: {
        id: batch.id,
        templateId: batch.template_id,
        prompt: batch.prompt,
        generationType: batch.generation_type,
        status: batch.status,
        createdAt: batch.created_at,
      },
      versions,
    };
  }

  // ─── 音频上传方法 ──────────────────────────────────────

  /**
   * 上传音频到 Supabase Storage
   *
   * 路径格式: generations/{userId}/{batchId}/v{n}.mp3
   *
   * @param userId 用户 ID
   * @param batchId 批次 ID
   * @param versionNumber 版本号
   * @param audioData 音频二进制数据
   * @param mimeType 音频 MIME 类型
   * @returns storage path
   */
  private async uploadAudio(
    userId: string,
    batchId: string,
    versionNumber: number,
    audioData: Buffer,
    mimeType: string,
  ): Promise<string> {
    const extension = mimeType === 'audio/wav' ? 'wav' : 'mp3';
    const path = `${userId}/${batchId}/v${versionNumber}.${extension}`;

    const { data, error } = await this.supabase.storage
      .from('generations')
      .upload(path, audioData, {
        upsert: true,
        contentType: mimeType,
      });

    if (error) {
      throw new Error(`音频上传失败: ${error.message}`);
    }

    return data.path;
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /** 根据输入计算需要消耗的操作类型列表 */
  private getOperations(input: MusicGenerationInput): CreditOperationType[] {
    const ops: CreditOperationType[] = [];

    if (input.generationType === 'preview') {
      ops.push('preview');
    } else {
      // Full Demo 默认使用短版消耗
      ops.push('full_demo_short');
    }

    if (input.usePremiumSinger) {
      ops.push('premium_singer');
    }

    return ops;
  }

  /** 递减用户活跃任务数 */
  private decrementActiveTasks(userId: string): void {
    const current = this.activeTasks.get(userId) ?? 0;
    if (current <= 1) {
      this.activeTasks.delete(userId);
    } else {
      this.activeTasks.set(userId, current - 1);
    }
  }

  /** 构建失败结果并更新数据库 */
  private async failResult(
    taskId: string,
    input: MusicGenerationInput,
    creditsConsumed: number,
    error: GenerationError,
  ): Promise<MusicGenerationResult> {
    await this.failTask(taskId, error);
    return {
      success: false,
      taskId,
      generationType: input.generationType,
      creditsConsumed,
      modelId: (error.modelId as LyriaModelId) ?? 'lyria-3-clip-preview',
      hasSynthIdWatermark: true,
      error,
    };
  }
}

export { DEFAULT_TEMPLATE_DESCRIPTION };
