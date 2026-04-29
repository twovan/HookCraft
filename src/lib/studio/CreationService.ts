// lib/studio/CreationService.ts - 创作入口验证服务

import type { MembershipTier } from '../../types/membership';
import type { CreationInput } from '../../types/template';
import type { CreditOperationType } from '../../types/credits';
import { CreditService } from '../credits/CreditService';
import { TemplateService } from '../template/TemplateService';
import { CREDITS_COST } from '../../config/creditsCost';

/** 生成类型 */
export type GenerationType = 'preview' | 'full_demo';

/** Prompt 策略 */
export type PromptStrategy = 'template_only' | 'prompt_only' | 'template_and_prompt';

/** 生成任务结果 */
export interface GenerationTaskResult {
  success: boolean;
  generationType: GenerationType;
  creditsCost: number;
  promptStrategy: PromptStrategy;
  input: CreationInput;
  error?: string;
}

/**
 * CreationService - 创作入口验证层
 *
 * 在 MusicGenerationService 调用 Lyria 3 之前，负责：
 * 1. 输入验证（templateId 或 prompt 至少提供一个）
 * 2. 模板访问权限校验
 * 3. 生成类型判定（Preview / Full Demo）
 * 4. Free 用户限制（仅允许 Preview）
 * 5. Credits 消耗计算与余额校验
 */
export class CreationService {
  private creditService: CreditService;
  private templateService: TemplateService;

  constructor(creditService: CreditService, templateService: TemplateService) {
    this.creditService = creditService;
    this.templateService = templateService;
  }

  /**
   * 创建生成任务（入口验证）
   *
   * @param userId - 用户 ID
   * @param userTier - 用户当前会员等级
   * @param input - 创作输入（templateId / prompt / duration）
   * @returns GenerationTaskResult
   */
  async createGenerationTask(
    userId: string,
    userTier: MembershipTier,
    input: CreationInput
  ): Promise<GenerationTaskResult> {
    // 1. 输入验证：templateId 和 prompt 不能同时为空
    if (!input.templateId && !input.prompt) {
      return this.fail('请选择模板或输入提示词');
    }

    // 2. 模板访问权限校验
    if (input.templateId) {
      const accessible = this.templateService.isTemplateAccessible(userTier, input.templateId);
      if (!accessible) {
        return this.fail('您无权访问该模板，请升级会员或选择免费模板');
      }
    }

    // 3. 判定生成类型
    const generationType: GenerationType = input.duration === 30 ? 'preview' : 'full_demo';

    // 4. Free 用户仅允许 Preview（30 秒）
    if (userTier === 'free' && generationType === 'full_demo') {
      return this.fail('升级到专业版解锁完整 Demo 生成');
    }

    // 5. 确定 Prompt 策略
    const promptStrategy = this.determinePromptStrategy(input);

    // 6. 计算 Credits 消耗
    const creditsCost = this.calculateCost(generationType, input.duration);

    // 7. 余额校验
    if (userTier === 'free') {
      // Free 用户消耗 Preview 次数
      const result = await this.creditService.consumePreview(userId);
      if (!result.success) {
        return this.fail('本月预览次数已用尽，升级到专业版获取更多创作额度');
      }
    } else {
      // 付费用户检查 Credits 余额
      const operations = this.buildOperations(generationType, input.duration);
      if (!(await this.creditService.hasEnoughCredits(userId, operations))) {
        return this.fail('Credits 不足，请购买 Credits 充值包或升级会员');
      }
    }

    return {
      success: true,
      generationType,
      creditsCost,
      promptStrategy,
      input,
    };
  }

  /**
   * 确定 Prompt 构建策略
   */
  private determinePromptStrategy(input: CreationInput): PromptStrategy {
    if (input.templateId && input.prompt) {
      return 'template_and_prompt';
    }
    if (input.templateId) {
      return 'template_only';
    }
    return 'prompt_only';
  }

  /**
   * 计算生成任务的 Credits 消耗
   */
  private calculateCost(generationType: GenerationType, duration: 30 | 120): number {
    if (generationType === 'preview') {
      return CREDITS_COST.preview;
    }
    // Full Demo: 根据时长选择短版或长版
    // duration=120 对应 full_demo_long
    return CREDITS_COST.full_demo_long;
  }

  /**
   * 构建消耗操作列表
   */
  private buildOperations(
    generationType: GenerationType,
    duration: 30 | 120
  ): CreditOperationType[] {
    if (generationType === 'preview') {
      return ['preview'];
    }
    return ['full_demo_long'];
  }

  /**
   * 构建失败结果
   */
  private fail(error: string): GenerationTaskResult {
    return {
      success: false,
      generationType: 'preview',
      creditsCost: 0,
      promptStrategy: 'prompt_only',
      input: { duration: 30 },
      error,
    };
  }
}
