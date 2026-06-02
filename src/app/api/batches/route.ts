import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../lib/supabase/server';
import { getAuthAccessToken, getAuthUser } from '../../../lib/supabase/auth-helpers';
import { loadStemCacheByTaskId } from '@/lib/stems/stemCacheLookup';

function extractTitleFromPrompt(prompt?: string | null) {
  if (!prompt) return null;

  const titleLine = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^(标题|歌曲名称)\s*[:：]/.test(line));

  if (!titleLine) return null;

  const title = titleLine.replace(/^(标题|歌曲名称)\s*[:：]\s*/, '').trim();
  return title || null;
}

function getDisplayTitle(task: any, batch: any, prompt?: string | null) {
  return task.title || batch?.title || extractTitleFromPrompt(prompt) || null;
}

function canEditSong(task: any) {
  return task.status === 'completed' && typeof task.model_id === 'string' && task.model_id.includes('kie');
}

/**
 * GET /api/batches
 *
 * 获取用户生成历史批次列表。
 * 支持查询参数：range（7d/30d/all）、page、pageSize（默认 20）
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const supabase = getServerSupabaseClient(await getAuthAccessToken());

    // Parse query params
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;

    // Build query at song/version granularity. The page still calls this API for
    // history, but each generation_task now represents one visible song row.
    let query = supabase
      .from('generation_tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply time range filter
    if (range === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', sevenDaysAgo);
    } else if (range === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', thirtyDaysAgo);
    }

    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('batches query error:', error);
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      );
    }

    const batchIds = Array.from(
      new Set((data ?? []).map((task: any) => task.batch_id).filter(Boolean))
    );
    const batchMap = new Map<string, any>();

    if (batchIds.length > 0) {
      const { data: batchesData, error: batchesError } = await supabase
        .from('generation_batches')
        .select('*, templates(name)')
        .in('id', batchIds);

      if (batchesError) {
        console.error('song batches query error:', batchesError);
      } else {
        for (const batch of batchesData ?? []) {
          batchMap.set(batch.id, batch);
        }
      }
    }

    const stemCacheByTaskId = await loadStemCacheByTaskId(supabase, user.id, data ?? []);

    // Keep the legacy "batches" response key for the existing client, but each
    // item is now one song/version instead of one generation batch.
    const batches = (data ?? []).map((task: any) => {
      const batch = task.batch_id ? batchMap.get(task.batch_id) : null;
      const prompt = batch?.prompt ?? task.prompt;
      const stemCache = stemCacheByTaskId.get(task.id);
      return {
        batchId: task.batch_id || task.id,
        taskId: task.id,
        versionNumber: task.version_number,
        createdAt: task.created_at,
        title: getDisplayTitle(task, batch, prompt),
        templateName: batch?.templates?.name ?? null,
        promptSummary: prompt ? prompt.slice(0, 50) : null,
        generationType: task.generation_type || batch?.generation_type,
        versionCount: 1,
        selectedVersionId: batch?.selected_task_id,
        status: task.status,
        errorMessage: task.error_message || null,
        refundedCredits: task.status === 'failed' ? task.credits_consumed || 0 : 0,
        durationSeconds: task.duration_seconds ?? null,
        lyrics: task.lyrics ?? null,
        authorName: task.author_name ?? null,
        styleTags: task.style_tags ?? [],
        canEditSong: canEditSong(task),
        hasStemCache: Boolean(stemCache),
        hasReadableStemCache: stemCache?.hasStemCache === true,
        stemJobId: stemCache?.jobId ?? null,
        stemEditSavedAt: stemCache?.editSavedAt ?? null,
      };
    });

    return NextResponse.json({
      batches,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('batches error:', error);
    return NextResponse.json(
      { error: '获取历史记录失败' },
      { status: 500 }
    );
  }
}
