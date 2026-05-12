import { NextRequest, NextResponse } from 'next/server';
import { ProducerService } from '../../../../lib/producer/ProducerService';
import { supabaseAdmin } from '../../../../lib/supabase/server';

/**
 * GET /api/producers/[id]
 *
 * 获取制作人主页信息。无需认证（公开接口）。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: producerId } = await params;

    const producerService = new ProducerService(supabaseAdmin);
    const producer = await producerService.getProducer(producerId);

    return NextResponse.json({ producer });
  } catch (error: any) {
    console.error('producer profile error:', error);

    // Handle not found
    if (error?.code === 'PGRST116') {
      return NextResponse.json(
        { error: '制作人不存在' },
        { status: 404 }
      );
    }

    const message = error?.message || '获取制作人信息失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
