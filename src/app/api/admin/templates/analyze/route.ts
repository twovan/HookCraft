import { NextRequest, NextResponse } from "next/server";
import { TemplateAdminService } from "../../../../../lib/admin/TemplateAdminService";
import { supabaseAdmin } from "../../../../../lib/supabase/server";
import { requireAdmin } from "../../../../../lib/admin/auth";

export const maxDuration = 300;

type TemplateAudioInput = {
  audioBase64: string;
  mimeType: string;
};

/**
 * POST /api/admin/templates/analyze
 *
 * 管理端模板分析接口。优先接收已上传到 Storage 的 audioPaths，避免把大音频文件
 * 二次塞进 Vercel Function 请求体；同时保留旧版 audio File[] 兼容。
 */
export async function POST(req: NextRequest) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;

    const formData = await req.formData();
    const templateId = formData.get("templateId") as string | null;
    const audioPaths = parseAudioPaths(formData.get("audioPaths"));
    const audioFiles = formData
      .getAll("audio")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const analysisTypeValue = formData.get("analysisType");
    const analysisType = analysisTypeValue === "suno" ? "suno" : "lyria3";

    if (!templateId) {
      return NextResponse.json(
        { error: "请提供模板 ID" },
        { status: 400 },
      );
    }

    if (audioPaths.length === 0 && audioFiles.length === 0) {
      return NextResponse.json(
        { error: "请上传参考音频文件" },
        { status: 400 },
      );
    }

    const audioInputs = audioPaths.length > 0
      ? await loadAudioInputsFromStorage(templateId, audioPaths)
      : await Promise.all(audioFiles.map(async (audioFile) => {
          const audioBuffer = await audioFile.arrayBuffer();
          return {
            audioBase64: Buffer.from(audioBuffer).toString("base64"),
            mimeType: audioFile.type || inferAudioMimeType(audioFile.name),
          };
        }));

    const service = new TemplateAdminService(supabaseAdmin);
    const result = await service.analyzeTemplateFiles(templateId, audioInputs, analysisType);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("模板分析失败:", error);
    return NextResponse.json(
      { error: "模板分析失败，请重试或手动填写分析结果" },
      { status: 500 },
    );
  }
}

function parseAudioPaths(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || value.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

async function loadAudioInputsFromStorage(
  templateId: string,
  audioPaths: string[],
): Promise<TemplateAudioInput[]> {
  return Promise.all(audioPaths.map(async (path) => {
    const expectedPrefix = `${templateId}/reference-audio/`;
    if (!path.startsWith(expectedPrefix)) {
      throw new Error("Invalid reference audio path");
    }

    const { data, error } = await supabaseAdmin.storage
      .from("template-assets")
      .download(path);

    if (error || !data) {
      throw new Error(error?.message || "Reference audio download failed");
    }

    const audioBuffer = await data.arrayBuffer();
    return {
      audioBase64: Buffer.from(audioBuffer).toString("base64"),
      mimeType: data.type || inferAudioMimeType(path),
    };
  }));
}

function inferAudioMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".flac")) return "audio/flac";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".webm")) return "audio/webm";
  return "audio/mpeg";
}
