// lib/audio/validateLyricsStructure.ts - 歌词结构标签校验

/**
 * 校验歌词是否包含至少一个结构标签
 *
 * 需求 5.4, 5.5:
 * - 非纯器乐模式下，歌词必须包含至少一个结构标签
 * - 有效结构标签：[verse], [chorus], [bridge], [intro], [outro]
 * - 标签匹配不区分大小写
 *
 * @param lyrics - 歌词文本
 * @returns true 如果歌词包含至少一个有效结构标签，否则 false
 */
export function validateLyricsStructure(lyrics: string): boolean {
  if (!lyrics || lyrics.trim().length === 0) {
    return false;
  }

  const structureTagPattern = /\[(verse|chorus|bridge|intro|outro)\]/i;
  return structureTagPattern.test(lyrics);
}
