// lib/audio/validateAudioFile.ts - 音频文件客户端校验模块
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10

import type { ValidationResult } from '@/types/arrangement';

/** 允许的音频 MIME 类型 */
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav'];

/** 最大文件大小：50MB */
const MAX_SIZE = 50 * 1024 * 1024;

/** 最短音频时长：6 秒 */
const MIN_DURATION = 6;

/** 最长音频时长：360 秒（6 分钟，MiniMax API 上限） */
const MAX_DURATION = 360;

/**
 * 使用 Web Audio API 获取音频文件时长（秒）
 *
 * @param file - 音频文件对象
 * @returns 音频时长（秒），精度到小数点后 2 位
 * @throws 当音频解码失败时抛出错误
 *
 * Preconditions:
 * - file 是有效的音频文件（MP3 或 WAV）
 * - 浏览器支持 AudioContext
 *
 * Postconditions:
 * - 返回音频时长（秒），精度到小数点后 2 位
 * - 时长 > 0
 * - 不修改输入文件
 */
export async function getAudioDuration(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const duration = Math.round(audioBuffer.duration * 100) / 100;
    return duration;
  } finally {
    await audioContext.close();
  }
}

/**
 * 校验音频文件是否满足上传要求
 *
 * 按顺序校验：格式（MP3/WAV）→ 大小（≤50MB）→ 时长（6s-180s）
 * 遇到第一个不满足的条件即返回错误，不继续后续校验。
 *
 * @param file - 待校验的文件对象
 * @returns 校验结果，包含 valid 标志和可选的 error/duration
 *
 * Preconditions:
 * - file 参数非空且为有效的 File 对象
 * - 浏览器支持 Web Audio API
 *
 * Postconditions:
 * - 返回 { valid: true, duration } 当且仅当文件通过所有校验
 * - 返回 { valid: false, error } 包含具体错误信息
 * - 不修改输入文件
 */
export async function validateAudioFile(file: File): Promise<ValidationResult> {
  // Step 1: 格式校验
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: '仅支持 MP3/WAV 格式' };
  }

  // Step 2: 大小校验
  if (file.size > MAX_SIZE) {
    return { valid: false, error: '文件大小不能超过 50MB' };
  }

  // Step 3: 时长校验（使用 Web Audio API 解码）
  let duration: number;
  try {
    duration = await getAudioDuration(file);
  } catch {
    return { valid: false, error: '音频文件无法解码，可能已损坏或格式不支持' };
  }

  if (duration < MIN_DURATION) {
    return { valid: false, error: '音频时长不能少于 6 秒' };
  }

  if (duration > MAX_DURATION) {
    return { valid: false, error: '音频时长不能超过 6 分钟' };
  }

  return { valid: true, duration };
}
