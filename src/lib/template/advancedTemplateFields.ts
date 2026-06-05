import type { Template } from '@/types/template';

type LegacyTemplateFields = object;

function legacyField(template: LegacyTemplateFields, key: string) {
  const value = (template as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

export function getAdvancedAnalysisStatus(template: LegacyTemplateFields) {
  return legacyField(template, 'suno_analysis_status');
}

export function getAdvancedAnalysisResult(template: LegacyTemplateFields) {
  return legacyField(template, 'suno_analysis_result');
}

export function getAdvancedPrompt(template: LegacyTemplateFields) {
  return legacyField(template, 'suno_prompt');
}

export function buildAdvancedAnalysisPayload(analysisResult: string, prompt: string) {
  return {
    suno_analysis_result: analysisResult,
    suno_prompt: prompt,
  };
}

export function getTemplateAdvancedPrompt(template?: Template | null) {
  return template?.sunoPrompt?.trim() || '';
}

export function getTemplateAdvancedAnalysis(template?: Template | null) {
  return template?.sunoAnalysisResult?.trim() || '';
}
