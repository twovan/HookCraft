import { NextRequest, NextResponse } from 'next/server';
import { ProducerService } from '../../../../../lib/producer/ProducerService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';

/**
 * GET /api/producers/[id]/templates
 *
 * 获取制作人的模板列表。无需认证（公开接口）。
 * 支持查询参数：genre、page、pageSize
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: producerId } = await params;

    // Parse query params
    const { searchParams } = new URL(req.url);
    const genre = searchParams.get('genre') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));

    const producerService = new ProducerService(supabaseAdmin);
    const result = await producerService.getProducerTemplates(producerId, {
      genre,
      page,
      pageSize,
    });

    return NextResponse.json({
      templates: result.templates,
      total: result.total,
    });
  } catch (error: any) {
    console.error('producer templates error:', error);
    const message = error?.message || '获取模板列表失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
