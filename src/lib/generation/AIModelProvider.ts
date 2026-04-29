// AIModelProvider - AI 模型提供方统一接口
import type { GenerationRequest, GenerationResponse } from '../../types/generation';

/** AI 模型提供方统一接口，支持未来接入其他 AI 音乐生成模型 */
export interface AIModelProvider {
  readonly providerName: string;

  /** 生成 Preview（30 秒预览） */
  generatePreview(request: GenerationRequest): Promise<GenerationResponse>;

  /** 生成 Full_Demo（完整 Demo） */
  generateFullDemo(request: GenerationRequest): Promise<GenerationResponse>;
}
