export type KieSunoModel = 'V5_5' | 'V5' | 'V4_5PLUS' | 'V4_5' | 'V4';

export interface KieUploadCoverRequest {
  prompt: string;
  uploadUrl: string;
  customMode: boolean;
  instrumental: boolean;
  model: KieSunoModel;
  style?: string;
  title?: string;
  negativeTags?: string;
  vocalGender?: 'm' | 'f';
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  callBackUrl?: string;
}

export interface KieGenerateMusicRequest {
  prompt: string;
  instrumental: boolean;
  model: KieSunoModel;
  callBackUrl?: string;
}

export interface KieAddInstrumentalRequest {
  uploadUrl: string;
  title: string;
  tags: string;
  model: KieSunoModel;
  negativeTags?: string;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  callBackUrl?: string;
}

export interface KieUploadCoverStartResult {
  taskId: string;
  uploadUrl: string;
}

export interface KieGenerateMusicStartResult {
  taskId: string;
}

export interface KieStemSplitRequest {
  sourceTaskId: string;
  sourceAudioId: string;
  type?: 'separate_vocal' | 'split_stem';
  callBackUrl?: string;
}

export interface KieStemSplitStartResult {
  taskId: string;
}

export interface KieStemSplitDetails {
  taskId: string;
  status: string;
  response: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export type KieMusicTaskStatus =
  | 'PENDING'
  | 'TEXT_SUCCESS'
  | 'FIRST_SUCCESS'
  | 'SUCCESS'
  | 'CREATE_TASK_FAILED'
  | 'GENERATE_AUDIO_FAILED'
  | 'CALLBACK_EXCEPTION'
  | 'SENSITIVE_WORD_ERROR'
  | string;

export interface KieSunoTrack {
  id?: string;
  audioUrl?: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  prompt?: string;
  modelName?: string;
  title?: string;
  tags?: string;
  createTime?: string;
  duration?: number;
}

export interface KieMusicTaskDetails {
  taskId: string;
  status: KieMusicTaskStatus;
  tracks: KieSunoTrack[];
  errorCode?: string | null;
  errorMessage?: string | null;
}
