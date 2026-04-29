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
