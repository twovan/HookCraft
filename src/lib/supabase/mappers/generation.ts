// mappers/generation.ts - GenerationTask ↔ generation_tasks 行转换

import type { Tables, UpdateTables } from '../types';

/**
 * 业务层 GenerationTask 类型
 * 对应 generation_tasks 表的 camelCase 表示
 */
export interface GenerationTask {
  id: string;
  userId: string;
  generationType: 'preview' | 'full_demo';
  status: 'pending' | 'building_prompt' | 'generating' | 'post_processing' | 'completed' | 'failed' | 'safety_blocked';
  prompt: string | null;
  templateId: string | null;
  modelId: string;
  audioPath: string | null;
  rawAudioPath: string | null;
  lyrics: string | null;
  songStructure: string | null;
  creditsConsumed: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 将数据库 generation_tasks 行转换为业务层 GenerationTask 对象
 */
export function toGenerationTask(row: Tables<'generation_tasks'>): GenerationTask {
  return {
    id: row.id,
    userId: row.user_id,
    generationType: row.generation_type,
    status: row.status,
    prompt: row.prompt,
    templateId: row.template_id,
    modelId: row.model_id,
    audioPath: row.audio_path,
    rawAudioPath: row.raw_audio_path,
    lyrics: row.lyrics,
    songStructure: row.song_structure,
    creditsConsumed: row.credits_consumed,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * 将业务层 GenerationTask 转换为数据库 generation_tasks 更新对象
 */
export function fromGenerationTask(info: GenerationTask): Partial<UpdateTables<'generation_tasks'>> {
  return {
    id: info.id,
    user_id: info.userId,
    generation_type: info.generationType,
    status: info.status,
    prompt: info.prompt,
    template_id: info.templateId,
    model_id: info.modelId,
    audio_path: info.audioPath,
    raw_audio_path: info.rawAudioPath,
    lyrics: info.lyrics,
    song_structure: info.songStructure,
    credits_consumed: info.creditsConsumed,
    error_code: info.errorCode,
    error_message: info.errorMessage,
    created_at: info.createdAt.toISOString(),
    updated_at: info.updatedAt.toISOString(),
  };
}
