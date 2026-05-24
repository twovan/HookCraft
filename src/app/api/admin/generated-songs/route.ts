import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));
    const status = searchParams.get('status') || '';
    const generationType = searchParams.get('generationType') || '';
    const search = (searchParams.get('search') || '').trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from('generation_tasks')
      .select('*', { count: 'exact' });

    if (status) query = query.eq('status', status as any);
    if (generationType) query = query.eq('generation_type', generationType as any);
    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&');
      query = query.or(`id.ilike.%${escaped}%,title.ilike.%${escaped}%,prompt.ilike.%${escaped}%,error_message.ilike.%${escaped}%`);
    }

    const { data: tasks, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const batchIds = Array.from(new Set((tasks || []).map((t: any) => t.batch_id).filter(Boolean)));
    const batchMap = new Map<string, any>();
    if (batchIds.length > 0) {
      const { data: batches, error: batchError } = await supabaseAdmin
        .from('generation_batches')
        .select('*, templates(id, name, genre, genre_tags)')
        .in('id', batchIds);
      if (batchError) {
        console.error('[Generated Songs] batch query error:', batchError);
      } else {
        (batches || []).forEach((batch: any) => batchMap.set(batch.id, batch));
      }
    }

    const userIds = Array.from(new Set((tasks || []).map((t: any) => t.user_id).filter(Boolean)));
    const userMap = new Map<string, { email: string; name: string }>();
    await Promise.all(userIds.map(async (userId) => {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        const user = data?.user;
        if (!user) return;
        userMap.set(userId, {
          email: user.email || '',
          name: user.user_metadata?.display_name
            || user.user_metadata?.name
            || user.user_metadata?.full_name
            || user.email?.split('@')[0]
            || userId.slice(0, 8),
        });
      } catch {
        userMap.set(userId, { email: '', name: userId.slice(0, 8) });
      }
    }));

    const songs = await Promise.all((tasks || []).map(async (task: any) => {
      const batch = task.batch_id ? batchMap.get(task.batch_id) : null;
      const user = userMap.get(task.user_id);
      let audioUrl: string | null = null;
      if (task.audio_path) {
        if (task.audio_path.startsWith('http')) {
          audioUrl = task.audio_path;
        } else {
          const { data: signedData } = await supabaseAdmin.storage
            .from('generations')
            .createSignedUrl(task.audio_path, 3600);
          audioUrl = signedData?.signedUrl || null;
        }
      }

      return {
        id: task.id,
        batchId: task.batch_id,
        userId: task.user_id,
        userName: user?.name || task.user_id?.slice(0, 8) || '未知用户',
        userEmail: user?.email || '',
        title: task.title || null,
        authorName: task.author_name || null,
        status: task.status,
        generationType: task.generation_type,
        modelId: task.model_id,
        versionNumber: task.version_number,
        durationSeconds: task.duration_seconds,
        creditsConsumed: task.credits_consumed || 0,
        prompt: task.prompt || batch?.prompt || '',
        batchPrompt: batch?.prompt || '',
        templateId: task.template_id || batch?.template_id || null,
        templateName: batch?.templates?.name || null,
        templateGenre: batch?.templates?.genre || null,
        styleTags: task.style_tags || batch?.templates?.genre_tags || [],
        usePremiumSinger: batch?.use_premium_singer || false,
        lyrics: task.lyrics || '',
        songStructure: task.song_structure || '',
        audioUrl,
        audioPath: task.audio_path || null,
        rawAudioPath: task.raw_audio_path || null,
        errorCode: task.error_code || null,
        errorMessage: task.error_message || null,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      };
    }));

    const { data: statsRows } = await supabaseAdmin
      .from('generation_tasks')
      .select('status, credits_consumed, audio_path');

    const rows = statsRows || [];
    const completed = rows.filter((r: any) => r.status === 'completed').length;
    const failed = rows.filter((r: any) => r.status === 'failed').length;
    const generating = rows.filter((r: any) => ['pending', 'generating', 'building_prompt'].includes(r.status)).length;

    return NextResponse.json({
      data: songs,
      total: count || 0,
      page,
      pageSize,
      stats: {
        totalSongs: rows.length,
        completed,
        failed,
        generating,
        totalCredits: rows.reduce((sum: number, r: any) => sum + (r.credits_consumed || 0), 0),
      },
    });
  } catch (error) {
    console.error('[Admin Generated Songs GET Error]', error);
    return NextResponse.json({ error: '获取生成歌曲列表失败' }, { status: 500 });
  }
}
