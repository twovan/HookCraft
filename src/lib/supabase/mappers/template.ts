// mappers/template.ts - Template ↔ templates 行转换

import type { Tables, UpdateTables } from '../types';
import type { Template } from '../../../types/template';

/**
 * 将数据库 templates 行转换为业务层 Template 对象
 */
export function toTemplate(row: Tables<'templates'>): Template {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    genre: row.genre,
    previewUrl: row.preview_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    referenceAudioUrl: row.reference_audio_url ?? undefined,
    analysisResult: row.analysis_result ?? undefined,
    lyriaPrompt: row.lyria_prompt ?? undefined,
    analyzedAt: row.analyzed_at ? new Date(row.analyzed_at) : undefined,
    analysisStatus: row.analysis_status,
  };
}

/**
 * 将业务层 Template 转换为数据库 templates 更新对象
 */
export function fromTemplate(info: Template): Partial<UpdateTables<'templates'>> {
  return {
    id: info.id,
    name: info.name,
    description: info.description,
    category: info.category,
    genre: info.genre,
    preview_url: info.previewUrl ?? null,
    cover_url: info.coverUrl ?? null,
    reference_audio_url: info.referenceAudioUrl ?? null,
    analysis_result: info.analysisResult ?? null,
    lyria_prompt: info.lyriaPrompt ?? null,
    analyzed_at: info.analyzedAt ? info.analyzedAt.toISOString() : null,
    analysis_status: info.analysisStatus,
  };
}
