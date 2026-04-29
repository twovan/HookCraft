import { NextRequest, NextResponse } from "next/server";
import { TemplateAdminService } from "../../../../../../lib/admin/TemplateAdminService";
import { supabaseAdmin } from "../../../../../../lib/supabase/server";
import { getAuthUser, isAdmin } from "../../../../../../lib/supabase/auth-helpers";
import type { ManualTemplateAnalysis } from "../../../../../../types/template";

/**
 * GET /api/admin/templates/[id]/analysis
 *
 * 获取模板的缓存分析结果。
 *
 * 返回：CachedTemplateAnalysis | null
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: '无权访问，需要管理员权限' },
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "请提供模板 ID" },
        { status: 400 }
      );
    }

    const service = new TemplateAdminService(supabaseAdmin);
    const cached = await service.getCachedAnalysis(id);

    if (!cached) {
      return NextResponse.json(
        { error: "该模板尚未进行分析" },
        { status: 404 }
      );
    }

    return NextResponse.json(cached);
  } catch (error: any) {
    console.error("获取分析结果失败:", error);
    return NextResponse.json(
      { error: "获取分析结果失败，请重试" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/templates/[id]/analysis
 *
 * 管理员手动填写/更新模板分析结果。
 * 用于 Gemini 分析失败时的备选方案。
 *
 * Body（JSON）：ManualTemplateAnalysis
 * - lyriaPrompt: string（必填，英文 Lyria Prompt）
 * - analysisResult?: string（可选，中文分析描述）
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: '无权访问，需要管理员权限' },
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "请提供模板 ID" },
        { status: 400 }
      );
    }

    const body = await req.json() as ManualTemplateAnalysis;

    if (!body.lyriaPrompt || body.lyriaPrompt.trim() === "") {
      return NextResponse.json(
        { error: "请提供英文 Lyria Prompt（lyriaPrompt 为必填项）" },
        { status: 400 }
      );
    }

    const service = new TemplateAdminService(supabaseAdmin);
    await service.updateAnalysisManually(id, body);

    return NextResponse.json({ success: true, message: "分析结果已更新" });
  } catch (error: any) {
    console.error("更新分析结果失败:", error);
    return NextResponse.json(
      { error: "更新分析结果失败，请重试" },
      { status: 500 }
    );
  }
}
