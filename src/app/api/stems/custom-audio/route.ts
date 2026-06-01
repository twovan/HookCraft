import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const AUDIO_FILES_BUCKET = 'audio-files';
const MAX_CUSTOM_AUDIO_BYTES = 80 * 1024 * 1024;

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

function buildCustomAudioUrl(req: NextRequest, jobId: string, stemType: string, storagePath: string) {
  const url = new URL('/api/stems/custom-audio', req.nextUrl.origin);
  url.searchParams.set('jobId', jobId);
  url.searchParams.set('stemType', stemType);
  url.searchParams.set('path', storagePath);
  return `${url.pathname}${url.search}`;
}

function isAuthorizedPath(path: string, userId: string, jobId: string) {
  return path.startsWith(`${userId}/stem-editor/${jobId}/`);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    const form = await req.formData();
    const jobId = String(form.get('jobId') || '').trim();
    const stemType = sanitizePathPart(String(form.get('stemType') || ''), 'custom');
    const file = form.get('file');
    if (!jobId || !(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid custom audio payload' }, { status: 400 });
    }
    if (file.type && !file.type.startsWith('audio/') && file.type !== 'application/octet-stream') {
      return NextResponse.json({ error: 'Only audio files can be uploaded' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_CUSTOM_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file is empty or too large' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ error: 'Stem job not found' }, { status: 404 });
    }

    const extension = audioExtension(file.type, file.name);
    const storagePath = `${user.id}/stem-editor/${jobId}/${stemType}-${Date.now()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(AUDIO_FILES_BUCKET)
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.type || `audio/${extension}`,
      });

    if (uploadError) throw uploadError;

    return NextResponse.json({
      storagePath,
      url: buildCustomAudioUrl(req, jobId, stemType, storagePath),
    });
  } catch (error: any) {
    console.error('[stems/custom-audio] Upload error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload custom stem audio' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    const jobId = req.nextUrl.searchParams.get('jobId') || '';
    const storagePath = req.nextUrl.searchParams.get('path') || '';
    if (!jobId || !storagePath || !isAuthorizedPath(storagePath, user.id, jobId)) {
      return NextResponse.json({ error: 'Invalid custom audio path' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ error: 'Stem job not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(AUDIO_FILES_BUCKET)
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Custom audio not found' }, { status: 404 });
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
      { error: error?.message || 'Failed to load custom stem audio' },
      { status: 500 },
    );
  }
}
