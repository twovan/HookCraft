import type { ArrangementParams } from '@/types/arrangement';

const MAX_PROMPT_LENGTH = 2000;

/**
 * 将用户编曲参数组合成 MiniMax API 可理解的 Prompt 字符串。
 *
 * 构建规则：
 * 1. 包含 BPM、调性（musicalKey）、音阶（scale）
 * 2. 如果有选中乐器，追加乐器列表段落（Requirement 5.6: 无乐器时跳过）
 * 3. 如果用户提供了非空风格描述（prompt），追加到末尾（Requirement 5.3）
 * 4. 最终结果截断至 2000 字符（Requirement 5.2）
 *
 * @example
 * buildArrangementPrompt({
 *   bpm: 128,
 *   musicalKey: 'A',
 *   scale: 'minor',
 *   instruments: ['piano', 'strings', 'synth pad'],
 *   prompt: '梦幻感的电子流行编曲',
 *   ...
 * })
 * // → "An arrangement at 128 BPM in A minor, featuring piano, strings, synth pad. 梦幻感的电子流行编曲"
 */
export function buildArrangementPrompt(params: ArrangementParams): string {
  const { bpm, musicalKey, scale, instruments, prompt } = params;

  // 基础段落：BPM + 调性 + 音阶
  let result = `An arrangement at ${bpm} BPM in ${musicalKey} ${scale}`;

  // 乐器段落（Requirement 5.6: 无乐器时跳过）
  if (instruments.length > 0) {
    result += `, featuring ${instruments.join(', ')}`;
  }

  // 追加用户风格描述（Requirement 5.3: 非空时追加）
  const userPrompt = prompt?.trim() ?? '';
  if (userPrompt.length > 0) {
    result += `. ${userPrompt}`;
  }

  // 截断至 2000 字符（Requirement 5.2）
  if (result.length > MAX_PROMPT_LENGTH) {
    result = result.slice(0, MAX_PROMPT_LENGTH);
  }

  return result;
}
