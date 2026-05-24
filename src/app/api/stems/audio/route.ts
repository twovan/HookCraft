import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAuthUser } from '@/lib/supabase/auth-helpers';

export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    const sourceUrl = req.nextUrl.searchParams.get('url') || '';
    if (!sourceUrl || !isAllowedStemUrl(sourceUrl)) {
      return NextResponse.json({ error: 'Invalid stem audio URL' }, { status: 400 });
    }

    const upstream = await fetch(sourceUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'audio/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Failed to load stem audio' },
        { status: upstream.status || 502 },
      );
    }

    const contentType = getAudioContentType(upstream, sourceUrl);
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
      'X-Content-Type-Options': 'nosniff',
      'X-Stem-Audio-Id': createHash('sha1').update(sourceUrl).digest('hex'),
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
