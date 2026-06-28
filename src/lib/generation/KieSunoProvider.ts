import type {
  KieAddInstrumentalRequest,
  KieGenerateMusicRequest,
  KieGenerateMusicStartResult,
  KieMusicTaskDetails,
  KieStemSplitDetails,
  KieStemSplitRequest,
  KieStemSplitStartResult,
  KieSunoTrack,
  KieUploadCoverRequest,
  KieUploadCoverStartResult,
} from '@/types/kie';

interface KieProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  fileBaseUrl?: string;
}

interface KieApiResponse<T> {
  code?: number;
  msg?: string;
  data?: T;
  success?: boolean;
}

export function isKieProviderCreditsInsufficient(message?: string | null): boolean {
  const normalized = (message || '').toLowerCase();
  return (
    normalized.includes('credits insufficient') ||
    normalized.includes('current balance') ||
    normalized.includes('top up to continue')
  );
}

export function getKieUserFacingErrorMessage(message?: string | null): string | null {
  const normalized = (message || '').toLowerCase();

  if (isKieProviderCreditsInsufficient(message)) {
    return '生成服务额度不足，当前不是你的 HookCraft 余额问题，请联系管理员处理后重试';
  }
  if (normalized.includes('non-json response') || normalized.includes('响应格式无效')) {
    return '生成服务响应异常，请稍后重试';
  }
  return message || null;
}

interface KieFileUploadData {
  fileUrl?: string;
  downloadUrl?: string;
}

interface KieUploadCoverData {
  taskId?: string;
}

interface KieRecordInfoData {
  taskId?: string;
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  response?: {
    sunoData?: KieSunoTrack[];
  };
}

interface KieStemRecordInfoData {
  taskId?: string;
  successFlag?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  response?: Record<string, unknown> | null;
}

const DEFAULT_BASE_URL = 'https://api.kie.ai';
const DEFAULT_FILE_BASE_URL = 'https://kieai.redpandaai.co';

function getKieApiKey(): string {
  return process.env.KIE_API_KEY || process.env.KIE_AI_API_KEY || '';
}

export class KieSunoProvider {
  private apiKey: string;
  private baseUrl: string;
  private fileBaseUrl: string;

  constructor(config: KieProviderConfig = {}) {
    this.apiKey = config.apiKey || getKieApiKey();
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.fileBaseUrl = config.fileBaseUrl || DEFAULT_FILE_BASE_URL;

    if (!this.apiKey) {
      throw new Error('Kie API Key 未配置');
    }
  }

  async uploadAudioFile(file: File, userId: string): Promise<string> {
    const extension = file.name.split('.').pop() || 'mp3';
    const safeName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadPath', `hookcraft/advanced-arrangement/${userId}`);
    formData.append('fileName', safeName);

    const response = await fetch(`${this.fileBaseUrl}/api/file-stream-upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    const payload = await this.parseJson<KieApiResponse<KieFileUploadData>>(response);
    const uploadUrl = payload.data?.fileUrl || payload.data?.downloadUrl;

    if (!response.ok || payload.success === false || !uploadUrl) {
      throw new Error(payload.msg || `音频上传到 Kie 失败 (${response.status})`);
    }

    return uploadUrl;
  }

  async uploadAndCover(input: KieUploadCoverRequest): Promise<KieUploadCoverStartResult> {
    const requestBody: Record<string, unknown> = {
      uploadUrl: input.uploadUrl,
      prompt: input.prompt,
      customMode: input.customMode,
      instrumental: input.instrumental,
      model: input.model,
    };

    if (input.customMode) {
      requestBody.style = input.style || '';
      requestBody.title = input.title || '';
      if (input.negativeTags) requestBody.negativeTags = input.negativeTags;
      if (input.vocalGender) requestBody.vocalGender = input.vocalGender;
      if (input.styleWeight !== undefined) requestBody.styleWeight = input.styleWeight;
      if (input.weirdnessConstraint !== undefined) requestBody.weirdnessConstraint = input.weirdnessConstraint;
      if (input.audioWeight !== undefined) requestBody.audioWeight = input.audioWeight;
    }

    const callBackUrl = input.callBackUrl || process.env.KIE_CALLBACK_URL;
    if (callBackUrl) {
      requestBody.callBackUrl = callBackUrl;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/generate/upload-cover`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await this.parseJson<KieApiResponse<KieUploadCoverData>>(response);
    const taskId = payload.data?.taskId;

    if (!response.ok || payload.code !== 200 || !taskId) {
      throw new Error(payload.msg || `Kie 高级编曲任务创建失败 (${response.status})`);
    }

    return {
      taskId,
      uploadUrl: input.uploadUrl,
    };
  }

  async generateMusic(input: KieGenerateMusicRequest): Promise<KieGenerateMusicStartResult> {
    const requestBody: Record<string, unknown> = {
      prompt: input.prompt,
      customMode: false,
      instrumental: input.instrumental,
      model: input.model,
    };

    const callBackUrl = input.callBackUrl || process.env.KIE_CALLBACK_URL;
    if (callBackUrl) {
      requestBody.callBackUrl = callBackUrl;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await this.parseJson<KieApiResponse<KieUploadCoverData>>(response);
    const taskId = payload.data?.taskId;

    if (!response.ok || payload.code !== 200 || !taskId) {
      throw new Error(payload.msg || `Kie generate-music task failed (${response.status})`);
    }

    return { taskId };
  }

  async addInstrumental(input: KieAddInstrumentalRequest): Promise<KieUploadCoverStartResult> {
    const requestBody: Record<string, unknown> = {
      uploadUrl: input.uploadUrl,
      title: input.title,
      tags: input.tags,
      negativeTags: input.negativeTags || 'low quality, distorted, clipping, harsh noise, off-key, messy arrangement',
      model: input.model,
    };

    if (input.styleWeight !== undefined) requestBody.styleWeight = input.styleWeight;
    if (input.weirdnessConstraint !== undefined) requestBody.weirdnessConstraint = input.weirdnessConstraint;
    if (input.audioWeight !== undefined) requestBody.audioWeight = input.audioWeight;

    const callBackUrl = input.callBackUrl || process.env.KIE_CALLBACK_URL;
    if (callBackUrl) {
      requestBody.callBackUrl = callBackUrl;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/generate/add-instrumental`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await this.parseJson<KieApiResponse<KieUploadCoverData>>(response);
    const taskId = payload.data?.taskId;

    if (!response.ok || payload.code !== 200 || !taskId) {
      throw new Error(payload.msg || `Kie add-instrumental task failed (${response.status})`);
    }

    return {
      taskId,
      uploadUrl: input.uploadUrl,
    };
  }

  async splitStems(input: KieStemSplitRequest): Promise<KieStemSplitStartResult> {
    const requestBody: Record<string, unknown> = {
      taskId: input.sourceTaskId,
      audioId: input.sourceAudioId,
      type: input.type || 'split_stem',
    };

    if (input.callBackUrl) {
      requestBody.callBackUrl = input.callBackUrl;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/vocal-removal/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const payload = await this.parseJson<KieApiResponse<KieUploadCoverData>>(response);
    const taskId = payload.data?.taskId;

    if (!response.ok || payload.code !== 200 || !taskId) {
      throw new Error(payload.msg || `Kie stem split task failed (${response.status})`);
    }

    return { taskId };
  }

  async getTaskDetails(taskId: string): Promise<KieMusicTaskDetails> {
    const url = new URL(`${this.baseUrl}/api/v1/generate/record-info`);
    url.searchParams.set('taskId', taskId);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    const payload = await this.parseJson<KieApiResponse<KieRecordInfoData>>(response);
    const data = payload.data;

    if (!response.ok || payload.code !== 200 || !data) {
      throw new Error(payload.msg || `Kie 任务查询失败 (${response.status})`);
    }

    return {
      taskId: data.taskId || taskId,
      status: data.status || 'PENDING',
      tracks: data.response?.sunoData || [],
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    };
  }

  async getStemSplitDetails(taskId: string): Promise<KieStemSplitDetails> {
    const url = new URL(`${this.baseUrl}/api/v1/vocal-removal/record-info`);
    url.searchParams.set('taskId', taskId);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    const payload = await this.parseJson<KieApiResponse<KieStemRecordInfoData>>(response);
    const data = payload.data;

    if (!response.ok || payload.code !== 200 || !data) {
      throw new Error(payload.msg || `Kie stem split query failed (${response.status})`);
    }

    return {
      taskId: data.taskId || taskId,
      status: data.successFlag || 'PENDING',
      response: data.response || null,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    };
  }

  private async parseJson<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') || 'unknown';
    const text = await response.text();

    try {
      return JSON.parse(text) as T;
    } catch {
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 180) || 'empty response';
      throw new Error(`Kie API returned non-JSON response (${response.status}, ${contentType}): ${preview}`);
    }
  }
}
