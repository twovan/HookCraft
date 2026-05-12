// mappers/template.ts - Template ↔ templates 行转换

import type { Tables, UpdateTables } from '../types';
import type { Template } from '../../../types/template';

/**
 * 将数据库 templates 行转换为业务层 Template 对象
 */
export function toTemplate(row: Tables<'templates'>): Template {
  // 使用 (row as any) 确保能访问所有字段，包括后来 ALTER TABLE 添加的
  const r = row as any;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    genre: r.genre,
    previewUrl: r.preview_url || undefined,
    coverUrl: r.cover_url || undefined,
    referenceAudioUrl: r.reference_audio_url || undefined,
    analysisResult: r.analysis_result || undefined,
    lyriaPrompt: r.lyria_prompt || undefined,
    analyzedAt: r.analyzed_at ? new Date(r.analyzed_at) : undefined,
    analysisStatus: r.analysis_status || 'pending',
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
