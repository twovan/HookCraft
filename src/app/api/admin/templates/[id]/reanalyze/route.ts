import { NextRequest, NextResponse } from "next/server";
import { TemplateAdminService } from "../../../../../../lib/admin/TemplateAdminService";
import { supabaseAdmin } from "../../../../../../lib/supabase/server";
import { requireAdmin } from "../../../../../../lib/admin/auth";

/**
 * POST /api/admin/templates/[id]/reanalyze
 *
 * 重新分析已有模板（管理员触发"重新分析"按钮）。
 * 使用之前存储的音频数据重新调用 Gemini LLM 分析。
 *
 * 返回：TemplateAnalysisResult
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { admin, response } = await requireAdmin(_req);
    if (response) return response;

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "请提供模板 ID" },
        { status: 400 }
      );
    }

    const service = new TemplateAdminService(supabaseAdmin);
    const result = await service.reAnalyzeTemplate(id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("重新分析失败:", error);

    // 区分音频数据不存在和分析失败
    if (error?.message?.includes("音频数据不存在")) {
      return NextResponse.json(
        { error: "该模板的音频数据不存在，无法重新分析，请重新上传音频" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "重新分析失败，请重试" },
      { status: 500 }
    );
  }
}
