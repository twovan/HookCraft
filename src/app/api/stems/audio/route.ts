import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { KieSunoProvider } from '@/lib/generation/KieSunoProvider';
import { readNormalizedStems } from '@/lib/stems/kieStemResult';
import { TimedPromiseCache } from '@/lib/stems/stemRefreshCache';
import { createStemAudioFetchTimeout } from '@/lib/stems/stemAudioFetchTimeout';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { KieStemSplitDetails } from '@/types/kie';

export const dynamic = 'force-dynamic';

const stemDetailsCache = new TimedPromiseCache<KieStemSplitDetails>(60_000);

function isAllowedStemUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getAudioContentType(response: Response, sourceUrl: string) {
  const contentType = response.headers.get('content-type');
  if (contentType?.startsWith('audio/')) return contentType;
  const pathname = new URL(sourceUrl).pathname.toLowerCase();
  if (pathname.endsWith('.wav')) return 'audio/wav';
  if (pathname.endsWith('.m4a')) return 'audio/mp4';
  if (pathname.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/mpeg';
}

function isUsableAudioResponse(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  return (
    !contentType ||
    contentType.startsWith('audio/') ||
    contentType.includes('octet-stream') ||
    contentType.includes('mpeg') ||
    contentType.includes('mp4') ||
    contentType.includes('wav') ||
    contentType.includes('ogg')
  );
}

async function fetchStemAudio(sourceUrl: string) {
  let upstream: Response;
  const timeout = createStemAudioFetchTimeout();

  try {
    upstream = await fetch(sourceUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'audio/*,*/*;q=0.8',
      },
      signal: timeout.signal,
    });
  } catch (error) {
    console.warn('[stems/audio] Stem source fetch failed:', error);
    return null;
  } finally {
    timeout.cancel();
  }

  return upstream.ok && upstream.body && isUsableAudioResponse(upstream) ? upstream : null;
}

function getFreshStemSplitDetails(providerTaskId: string) {
  return stemDetailsCache.get(providerTaskId, () => (
    new KieSunoProvider().getStemSplitDetails(providerTaskId)
  ));
}

async function refreshStemSourceUrl({
  jobId,
  stemType,
  userId,
}: {
  jobId: string;
  stemType: string;
  userId: string;
}) {
  if (!jobId || !stemType || jobId.startsWith('kie:')) return null;

  const { data: job, error } = await supabaseAdmin
    .from('audio_stem_jobs')
    .select('id,provider_task_id,result_payload')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!job?.provider_task_id) return null;

  const details = await getFreshStemSplitDetails(job.provider_task_id);
  const normalizedStems = readNormalizedStems({ response: details.response });
  const freshStem = normalizedStems.find((stem) => stem.type === stemType);
  if (!freshStem?.url) return null;

  const currentPayload = job.result_payload && typeof job.result_payload === 'object'
    ? job.result_payload as Record<string, unknown>
    : {};

  await supabaseAdmin
    .from('audio_stem_jobs')
    .update({
      result_payload: {
        ...currentPayload,
        response: details.response,
        normalizedStems,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('user_id', userId);

  return freshStem.url;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录后再加载音频。' }, { status: 401 });
    }

    const sourceUrl = req.nextUrl.searchParams.get('url') || '';
    const jobId = req.nextUrl.searchParams.get('jobId') || '';
    const stemType = req.nextUrl.searchParams.get('stemType') || '';
    if (!sourceUrl || !isAllowedStemUrl(sourceUrl)) {
      return NextResponse.json({ error: 'Invalid stem audio URL' }, { status: 400 });
    }

    let upstream = await fetchStemAudio(sourceUrl);
    let finalSourceUrl = sourceUrl;

    if (!upstream) {
      const refreshedUrl = await refreshStemSourceUrl({
        jobId,
        stemType,
        userId: user.id,
      });

      if (refreshedUrl && isAllowedStemUrl(refreshedUrl) && refreshedUrl !== sourceUrl) {
        const refreshedUpstream = await fetchStemAudio(refreshedUrl);
        if (refreshedUpstream) {
          upstream = refreshedUpstream;
          finalSourceUrl = refreshedUrl;
        }
      }
    }

    if (!upstream) {
      return NextResponse.json(
        { error: 'Failed to load stem audio' },
        { status: 502 },
      );
    }

    const contentType = getAudioContentType(upstream, finalSourceUrl);
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'X-Stem-Audio-Id': createHash('sha1').update(finalSourceUrl).digest('hex'),
    });
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('[stems/audio] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to proxy stem audio' },
      { status: 500 },
    );
  }
}
