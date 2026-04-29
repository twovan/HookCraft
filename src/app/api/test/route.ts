import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. 检查 API Key 配置
  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({
      step: "API Key 检查",
      status: "❌ 失败",
      message: "请在 .env.local 中配置 GEMINI_API_KEY",
    });
  }

  // 2. 测试网络连通性（直接用 fetch 调 Google API）
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({
        step: "Google API 连通性测试",
        status: "❌ API 返回错误",
        httpStatus: res.status,
        error: data.error?.message || JSON.stringify(data),
        hint: res.status === 403
          ? "API Key 无效或未开通权限"
          : res.status === 429
          ? "请求频率超限"
          : "检查 API Key 是否正确",
      });
    }

    // 3. 检查 Lyria 模型是否可用
    const models = data.models || [];
    const lyriaModels = models.filter((m: any) =>
      m.name?.includes("lyria")
    );

    return NextResponse.json({
      step: "全部检查通过",
      status: "✅ 成功",
      apiKeyPrefix: apiKey.substring(0, 10) + "...",
      totalModels: models.length,
      lyriaModels: lyriaModels.map((m: any) => m.name),
      hint: lyriaModels.length === 0
        ? "⚠️ 未找到 Lyria 模型，可能你的 API Key 还没有 Lyria 3 的访问权限"
        : "Lyria 模型可用，API 连接正常",
    });
  } catch (error: any) {
    return NextResponse.json({
      step: "Google API 连通性测试",
      status: "❌ 网络失败",
      error: error.name === "AbortError" ? "请求超时（15秒）" : error.message,
      hint: "国内服务器无法直接访问 Google API，需要代理或部署到 Vercel",
    });
  }
}
