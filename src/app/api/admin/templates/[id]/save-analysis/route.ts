import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

const MAX_SUNO_PROMPT_CHARS = 1000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { analysisResult, lyriaPrompt, status, error: errorMsg } = body;
    const analysisType = body.analysisType === 'suno' ? 'suno' : 'lyria3';
    const now = new Date().toISOString();

    if (status === 'failed') {
      const failedUpdate = analysisType === 'suno'
        ? {
            suno_analysis_status: 'failed',
            suno_analysis_result: `分析失败: ${errorMsg || '未知错误'}`,
            updated_at: now,
          }
        : {
            analysis_status: 'failed',
            analysis_result: `分析失败: ${errorMsg || '未知错误'}`,
            updated_at: now,
          };

      await supabaseAdmin.from('templates').update(failedUpdate as any).eq('id', id);
      return NextResponse.json({ success: true, status: 'failed', analysisType });
    }

    const safeAnalysisResult = analysisType === 'suno'
      ? normalizeSunoHumanAnalysis(analysisResult || '')
      : analysisResult || '';
    const safePrompt = analysisType === 'suno'
      ? truncateSunoText(lyriaPrompt || '')
      : lyriaPrompt || '';

    const completedUpdate = analysisType === 'suno'
      ? {
          suno_analysis_result: safeAnalysisResult,
          suno_prompt: safePrompt,
          suno_analysis_status: 'completed',
          suno_analyzed_at: now,
          updated_at: now,
        }
      : {
          analysis_result: safeAnalysisResult,
          lyria_prompt: safePrompt,
          analysis_status: 'completed',
          analyzed_at: now,
          updated_at: now,
        };

    await supabaseAdmin.from('templates').update(completedUpdate as any).eq('id', id);

    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `模板分析完成 (${analysisType}, 前端): ${id}`,
      target_type: 'template',
      target_id: id,
    });

    return NextResponse.json({ success: true, status: 'completed', analysisType });
  } catch (error: any) {
    console.error('[Save Analysis Error]', error?.message || error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

function normalizeSunoText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function truncateSunoText(text: string) {
  const normalized = normalizeSunoText(text);
  const chars = Array.from(normalized);
  if (chars.length <= MAX_SUNO_PROMPT_CHARS) return normalized;
  const limited = chars.slice(0, MAX_SUNO_PROMPT_CHARS).join('');
  const withoutDanglingLabel = stripIncompleteMusicalField(limited);
  if (Array.from(withoutDanglingLabel).length >= Math.floor(MAX_SUNO_PROMPT_CHARS * 0.78)) {
    return withoutDanglingLabel;
  }
  const boundary = Math.max(
    limited.lastIndexOf('. '),
    limited.lastIndexOf('; '),
    limited.lastIndexOf(', '),
    limited.lastIndexOf('| '),
    limited.lastIndexOf('，'),
    limited.lastIndexOf('。'),
  );
  if (boundary >= Math.floor(MAX_SUNO_PROMPT_CHARS * 0.82)) {
    return stripIncompleteMusicalField(limited.slice(0, boundary + 1));
  }
  return stripIncompleteMusicalField(limited);
}

function normalizeSunoHumanAnalysis(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?，。；])/g, '$1')
    .trim();
}

function stripIncompleteMusicalField(text: string) {
  const musicalFieldLabels = [
    'Genre',
    'Subgenre',
    'Tempo',
    'BPM',
    'Key',
    'Scale',
    'Instrumentation',
    'Instruments',
    'Drums',
    'Drum groove',
    'Bass',
    'Bassline',
    'Chords',
    'Harmony',
    'Motifs',
    'Structure',
    'Sound design',
    'Mix',
    'Texture',
    'Mood',
    'Energy',
    'Production',
    'Arrangement',
  ].join('|');

  return text
    .replace(new RegExp(`(?:^|[\\s,.;|，。；])(?:${musicalFieldLabels})\\s*:\\s*$`, 'i'), '')
    .replace(/[,;:|，。；\s-]+$/g, '')
    .trim();
}
