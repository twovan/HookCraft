// types/template.ts - 模板与创作输入类型定义

/** 模板分类 */
export type TemplateCategory = 'free_template' | 'paid_template';

/** 模板分析状态 */
export type TemplateAnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

/** 模板 */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  genre: string;
  /** 发布状态 */
  status?: string;
  /** 价格（分） */
  price?: number;
  /** 制作人 ID */
  producerId?: string;
  producerName?: string;
  producerAvatarUrl?: string;
  previewUrl?: string;
  coverUrl?: string;
  /** 参考音频文件 URL（管理员上传） */
  referenceAudioUrl?: string;
  /** 缓存的分析结果（中文分析描述） */
  analysisResult?: string;
  /** 缓存的英文 Lyria Prompt（直接用于 Lyria 3 生成） */
  lyriaPrompt?: string;
  sunoAnalysisResult?: string;
  sunoPrompt?: string;
  sunoAnalyzedAt?: Date;
  sunoAnalysisStatus?: TemplateAnalysisStatus;
  /** 分析完成时间 */
  analyzedAt?: Date;
  /** 分析状态 */
  analysisStatus: TemplateAnalysisStatus;
}

/** 缓存的模板分析结果（数据库存储） */
export interface CachedTemplateAnalysis {
  templateId: string;
  /** 中文分析描述（展示给管理员/用户） */
  analysisResult: string;
  /** 英文 Lyria Prompt（直接传给 Lyria 3） */
  lyriaPrompt: string;
  /** Advanced style prompt for template-based generation. */
  advancedPrompt?: string;
  /** Advanced style analysis status. */
  advancedStatus?: TemplateAnalysisStatus;
  /** 分析时间 */
  analyzedAt: Date;
  /** 分析状态 */
  status: TemplateAnalysisStatus;
}

/** 管理员手动填写的模板分析 */
export interface ManualTemplateAnalysis {
  analysisResult?: string;
  lyriaPrompt: string;
}

/** 创作输入（模板或提示词） */
export interface CreationInput {
  /** 选择的模板 ID（可选） */
  templateId?: string;
  /** 用户输入的提示词（可选） */
  prompt?: string;
  /** 生成时长（秒）：30 或 120 */
  duration: 30 | 120;
}
