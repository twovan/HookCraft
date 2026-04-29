import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import type { MusicGenerationInput, MusicGenerationResult } from "../../../types/generation";
import type { MembershipTier } from "../../../types/membership";
import { MusicGenerationService } from "../../../lib/generation/MusicGenerationService";
import { LyriaProvider } from "../../../lib/generation/LyriaProvider";
import { CreditService } from "../../../lib/credits/CreditService";
import { TemplateService } from "../../../lib/template/TemplateService";
import { TemplateAdminService } from "../../../lib/admin/TemplateAdminService";
import { supabaseAdmin } from "../../../lib/supabase/server";
import { getAuthUser } from "../../../lib/supabase/auth-helpers";

export const maxDuration = 300;

/**
 * 判断请求是否为 JSON 格式（MusicGenerationInput）
 */
function isJsonRequest(req: NextRequest): boolean {
  const contentType = req.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

/**
 * JSON 路径：使用 MusicGenerationService.generate() 执行流水线
 */
async function handleJsonRequest(req: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: '未登录，请先登录' },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { userTier, input } = body as {
    userTier: MembershipTier;
    input: MusicGenerationInput;
  };

  if (!userTier || !input) {
    return NextResponse.json(
      { error: "请提供完整的生成参数" },
      { status: 400 }
    );
  }

  if (!input.generationType) {
    return NextResponse.json(
      { error: "请指定生成类型（preview 或 full_demo）" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "服务配置异常，请稍后重试" }, { status: 500 });
  }

  const provider = new LyriaProvider(apiKey);
  const creditService = new CreditService(supabaseAdmin);
  const templateService = new TemplateService(supabaseAdmin);
  const templateAdminService = new TemplateAdminService(supabaseAdmin);

  const service = new MusicGenerationService({
    supabase: supabaseAdmin,
    provider,
    creditService,
    templateService,
    templateAdminService,
  });

  const result: MusicGenerationResult = await service.generate(user.id, userTier, input);
  return NextResponse.json(result);
}

/**
 * FormData 路径：保持原有 demo 逻辑（直接调用 Lyria 3）
 */
async function handleFormDataRequest(req: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: '未登录，请先登录' },
      { status: 401 }
    );
  }

  const formData = await req.formData();
  const prompt = (formData.get("prompt") as string) || "";
  const audioFile = formData.get("audio") as File | null;
  const mode = (formData.get("mode") as string) || "clip";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "请配置 GEMINI_API_KEY" }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });
  let analysisResult = "";
  let analysisDisplay = "";

  // 步骤 1：如果有参考音频，用 Gemini 分析风格
  if (audioFile && audioFile.size > 0) {
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    const fileName = audioFile.name.toLowerCase();
    const mimeType = fileName.endsWith(".wav") ? "audio/wav" : "audio/mp3";

    const analysisResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: `请详细分析这段音乐，用于音乐制作参考。请用中文输出分析结果，同时在最后附上一段英文的 AI 音乐生成 prompt。

请包含以下内容：
1. 🎵 流派与子流派
2. ⏱️ BPM（速度）
3. 🎹 调性与音阶
4. 🎸 主要使用的乐器
5. 🌙 情绪与氛围
6. 📐 歌曲结构（前奏、主歌、副歌等）
7. 🔧 值得注意的制作技巧
8. ⚡ 整体能量水平

最后，请用英文输出一段简洁的音乐生成 prompt，格式如下：
[PROMPT] A [genre] track at [BPM] BPM in [key], featuring [instruments], with a [mood] atmosphere. [structure details]. Instrumental only. [/PROMPT]`,
            },
          ],
        },
      ],
    });

    const analysisParts = analysisResponse.candidates?.[0]?.content?.parts;
    let fullAnalysis = "";
    if (analysisParts) {
      for (const part of analysisParts) {
        if (part.text) fullAnalysis += part.text;
      }
    }

    // 提取英文 prompt 给 Lyria 用，中文部分给用户看
    const promptMatch = fullAnalysis.match(/\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/);
    if (promptMatch) {
      analysisResult = promptMatch[1].trim();
      analysisDisplay = fullAnalysis.replace(/\[PROMPT\][\s\S]*?\[\/PROMPT\]/, "").trim();
    } else {
      analysisResult = fullAnalysis;
      analysisDisplay = fullAnalysis;
    }
  }

  // 步骤 2：构建最终 prompt
  let finalPrompt = "";
  if (analysisResult && prompt.trim()) {
    finalPrompt = `Based on this reference style: ${analysisResult.trim()}\n\nUser's additional instructions: ${prompt.trim()}`;
  } else if (analysisResult) {
    finalPrompt = analysisResult.trim();
  } else if (prompt.trim()) {
    finalPrompt = prompt.trim();
  } else {
    return NextResponse.json({ error: "请输入音乐描述或上传参考音频" }, { status: 400 });
  }

  // 步骤 3：用 Lyria 3 生成音乐
  const modelId = mode === "pro" ? "lyria-3-pro-preview" : "lyria-3-clip-preview";

  const response = await ai.models.generateContent({
    model: modelId,
    contents: finalPrompt,
  });

  // 解析响应
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    return NextResponse.json({ error: "生成失败，请重试" }, { status: 500 });
  }

  const result: {
    tracks: { name: string; audio: string; mimeType: string }[];
    lyrics: string;
    analysis: string;
    prompt: string;
    finalPrompt: string;
    model: string;
  } = { tracks: [], lyrics: "", analysis: analysisDisplay || analysisResult, prompt, finalPrompt, model: modelId };

  for (const part of parts) {
    if (part.text) {
      result.lyrics += part.text + "\n";
    } else if (part.inlineData) {
      result.tracks.push({
        name: result.tracks.length === 0 ? "完整混音" : `音轨 ${result.tracks.length + 1}`,
        audio: part.inlineData.data ?? "",
        mimeType: part.inlineData.mimeType ?? "audio/mp3",
      });
    }
  }
  result.lyrics = result.lyrics.trim();

  if (result.tracks.length === 0) {
    return NextResponse.json(
      { error: "未返回音频数据。\n" + (result.lyrics || "请调整描述后重试") },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}

/**
 * POST /api/generate
 *
 * 支持两种请求格式：
 * 1. JSON（Content-Type: application/json）→ MusicGenerationInput 格式，使用 MusicGenerationService
 * 2. FormData（Content-Type: multipart/form-data）→ 原有 demo 格式，直接调用 Lyria 3
 */
export async function POST(req: NextRequest) {
  try {
    if (isJsonRequest(req)) {
      return await handleJsonRequest(req);
    }
    return await handleFormDataRequest(req);
  } catch (error: any) {
    console.error("API error:", error);
    let message = "生成失败";
    if (error?.message?.includes("quota") || error?.message?.includes("429")) {
      message = "API 配额不足，请稍后重试";
    } else if (error?.message?.includes("API key")) {
      message = "API Key 无效";
    } else if (error?.message?.includes("safety")) {
      message = "内容被安全过滤器拦截，请调整描述";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
