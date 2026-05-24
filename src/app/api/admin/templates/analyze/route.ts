import { NextRequest, NextResponse } from "next/server";
import { TemplateAdminService } from "../../../../../lib/admin/TemplateAdminService";
import { supabaseAdmin } from "../../../../../lib/supabase/server";
import { requireAdmin } from "../../../../../lib/admin/auth";

/**
 * POST /api/admin/templates/analyze
 *
 * 管理员模板分析接口：接收 templateId + 音频文件（FormData），
 * 调用 TemplateAdminService.analyzeTemplate() 分析参考音频。
 *
 * FormData 参数：
 * - templateId: string（必填）
 * - audio: File（必填，参考音频文件）
 *
 * 返回：TemplateAnalysisResult
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const formData = await req.formData();
    const templateId = formData.get("templateId") as string | null;
    const audioFile = formData.get("audio") as File | null;
    const analysisTypeValue = formData.get("analysisType");
    const analysisType = analysisTypeValue === "suno" ? "suno" : "lyria3";

    if (!templateId) {
      return NextResponse.json(
        { error: "请提供模板 ID" },
        { status: 400 }
      );
    }

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { error: "请上传参考音频文件" },
        { status: 400 }
      );
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    const fileName = audioFile.name.toLowerCase();
    const mimeType = fileName.endsWith(".wav") ? "audio/wav" : "audio/mp3";

    const service = new TemplateAdminService(supabaseAdmin);
    const result = await service.analyzeTemplate(templateId, audioBase64, mimeType, analysisType);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("模板分析失败:", error);
    return NextResponse.json(
      { error: "模板分析失败，请重试或手动填写分析结果" },
      { status: 500 }
    );
  }
}
