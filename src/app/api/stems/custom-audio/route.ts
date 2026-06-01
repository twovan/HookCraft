import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const AUDIO_FILES_BUCKET = 'audio-files';
const CUSTOM_AUDIO_FALLBACK_BUCKET = 'generations';
const MAX_CUSTOM_AUDIO_BYTES = 80 * 1024 * 1024;
const CUSTOM_AUDIO_BUCKET_OPTIONS = {
  public: false,
  fileSizeLimit: MAX_CUSTOM_AUDIO_BYTES,
  allowedMimeTypes: [
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'application/octet-stream',
  ],
};

async function ensureAudioFilesBucket() {
  const { data: bucket, error: getError } = await supabaseAdmin.storage.getBucket(AUDIO_FILES_BUCKET);
  if (bucket) {
    const { error: updateError } = await supabaseAdmin.storage.updateBucket(
      AUDIO_FILES_BUCKET,
      CUSTOM_AUDIO_BUCKET_OPTIONS,
    );
    if (updateError) throw updateError;
    return;
  }

  const missingBucket = getError && (
    getError.message?.toLowerCase().includes('not found')
    || getError.message?.toLowerCase().includes('does not exist')
  );
  if (getError && !missingBucket) throw getError;

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    AUDIO_FILES_BUCKET,
    CUSTOM_AUDIO_BUCKET_OPTIONS,
  );
  if (createError && !createError.message?.toLowerCase().includes('already exists')) {
    throw createError;
  }
}

function sanitizePathPart(value: string, fallback: string) {
  const safe = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return safe || fallback;
}

function audioExtension(contentType: string, fallbackName: string) {
  const lowerName = fallbackName.toLowerCase();
  if (contentType.includes('wav') || lowerName.endsWith('.wav')) return 'wav';
  if (contentType.includes('mpeg') || lowerName.endsWith('.mp3')) return 'mp3';
  if (contentType.includes('mp4') || lowerName.endsWith('.m4a')) return 'm4a';
  if (contentType.includes('ogg') || lowerName.endsWith('.ogg')) return 'ogg';
  if (contentType.includes('webm') || lowerName.endsWith('.webm')) return 'webm';
  return 'webm';
}

function buildCustomAudioUrl(req: NextRequest, jobId: string, stemType: string, storagePath: string, bucket: string) {
  const url = new URL('/api/stems/custom-audio', req.nextUrl.origin);
  url.searchParams.set('jobId', jobId);
  url.searchParams.set('stemType', stemType);
  url.searchParams.set('path', storagePath);
  url.searchParams.set('bucket', bucket);
  return `${url.pathname}${url.search}`;
}

function isAuthorizedPath(path: string, userId: string, jobId: string) {
  return path.startsWith(`${userId}/stem-editor/${jobId}/`);
}

function normalizeCustomAudioBucket(value: string | null) {
  return value === CUSTOM_AUDIO_FALLBACK_BUCKET ? CUSTOM_AUDIO_FALLBACK_BUCKET : AUDIO_FILES_BUCKET;
}

async function uploadCustomAudioObject(
  storagePath: string,
  buffer: Buffer,
  contentType: string,
) {
  const buckets = [AUDIO_FILES_BUCKET, CUSTOM_AUDIO_FALLBACK_BUCKET];
  let lastError: unknown = null;

  for (const bucket of buckets) {
    try {
      if (bucket === AUDIO_FILES_BUCKET) {
        await ensureAudioFilesBucket();
      }
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          upsert: true,
          contentType,
        });
      if (!error) return bucket;
      lastError = error;
      console.warn(`[stems/custom-audio] Upload to ${bucket} failed:`, error);
    } catch (error) {
      lastError = error;
      console.warn(`[stems/custom-audio] Upload to ${bucket} failed:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Custom audio upload failed');
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录后再导入音频。' }, { status: 401 });
    }

    const form = await req.formData();
    const jobId = String(form.get('jobId') || '').trim();
    const stemType = sanitizePathPart(String(form.get('stemType') || ''), 'custom');
    const file = form.get('file');
    if (!jobId || !(file instanceof File)) {
      return NextResponse.json({ error: '导入音频参数不完整，请重新选择文件。' }, { status: 400 });
    }
    if (file.type && !file.type.startsWith('audio/') && file.type !== 'application/octet-stream') {
      return NextResponse.json({ error: '只能导入音频文件。' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_CUSTOM_AUDIO_BYTES) {
      return NextResponse.json({ error: '音频文件为空或超过 80MB。' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ error: '没有找到可编辑的分轨任务。' }, { status: 404 });
    }

    const extension = audioExtension(file.type, file.name);
    const storagePath = `${user.id}/stem-editor/${jobId}/${stemType}-${Date.now()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = await uploadCustomAudioObject(
      storagePath,
      buffer,
      file.type || `audio/${extension}`,
    );

    return NextResponse.json({
      storagePath,
      url: buildCustomAudioUrl(req, jobId, stemType, storagePath, bucket),
    });
  } catch (error: any) {
    console.error('[stems/custom-audio] Upload error:', error);
    return NextResponse.json(
      { error: '自定义轨道音频上传失败，请稍后重试。' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录后再加载音频。' }, { status: 401 });
    }

    const jobId = req.nextUrl.searchParams.get('jobId') || '';
    const storagePath = req.nextUrl.searchParams.get('path') || '';
    const bucket = normalizeCustomAudioBucket(req.nextUrl.searchParams.get('bucket'));
    if (!jobId || !storagePath || !isAuthorizedPath(storagePath, user.id, jobId)) {
      return NextResponse.json({ error: '自定义音频路径无效。' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ error: '没有找到可编辑的分轨任务。' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json({ error: '自定义音频不存在或已过期。' }, { status: 404 });
    }

    return new NextResponse(data.stream(), {
      headers: {
        'Content-Type': data.type || 'audio/webm',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('[stems/custom-audio] Download error:', error);
    return NextResponse.json(
      { error: '自定义轨道音频加载失败，请稍后重试。' },
      { status: 500 },
    );
  }
}
