import { NextRequest, NextResponse } from 'next/server';
import type { MembershipTier } from '../../../types/membership';
import { DownloadService } from '../../../lib/download/DownloadService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';

/**
 * POST /api/download
 *
 * 下载选中版本的 MP3 文件。
 * 成功时返回 MP3 二进制流，失败时返回 JSON 错误。
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { taskId } = body as { taskId: string };

    if (!taskId) {
      return NextResponse.json(
        { error: '请提供任务 ID' },
        { status: 400 }
      );
    }

    // Get user's membership tier
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: '无法获取会员信息' },
        { status: 500 }
      );
    }

    const userTier = membership.tier as MembershipTier;

    // Call DownloadService
    const downloadService = new DownloadService(supabaseAdmin);
    const result = await downloadService.download(user.id, userTier, taskId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Return MP3 binary
    const buffer = result.audioBuffer!;
    const responseBody = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as unknown as BodyInit;
    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error: any) {
    console.error('download error:', error);
    const message = error?.message || '下载失败，请重试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
