import { describe, it, expect } from 'vitest';
import { validateLyricsStructure } from './validateLyricsStructure';

describe('validateLyricsStructure', () => {
  it('should return true when lyrics contain [verse]', () => {
    expect(validateLyricsStructure('[verse]\n月光洒在窗台')).toBe(true);
  });

  it('should return true when lyrics contain [chorus]', () => {
    expect(validateLyricsStructure('[chorus]\n我们一起走过')).toBe(true);
  });

  it('should return true when lyrics contain [bridge]', () => {
    expect(validateLyricsStructure('[bridge]\n转折的旋律')).toBe(true);
  });

  it('should return true when lyrics contain [intro]', () => {
    expect(validateLyricsStructure('[intro]\n前奏部分')).toBe(true);
  });

  it('should return true when lyrics contain [outro]', () => {
    expect(validateLyricsStructure('[outro]\n结尾部分')).toBe(true);
  });

  it('should return true when lyrics contain multiple structure tags', () => {
    const lyrics = '[intro]\n前奏\n[verse]\n第一段\n[chorus]\n副歌';
    expect(validateLyricsStructure(lyrics)).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(validateLyricsStructure('[VERSE]\n大写标签')).toBe(true);
    expect(validateLyricsStructure('[Chorus]\n混合大小写')).toBe(true);
    expect(validateLyricsStructure('[BRIDGE]\n全大写')).toBe(true);
    expect(validateLyricsStructure('[Intro]\n首字母大写')).toBe(true);
    expect(validateLyricsStructure('[OUTRO]\n全大写结尾')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(validateLyricsStructure('')).toBe(false);
  });

  it('should return false for whitespace-only string', () => {
    expect(validateLyricsStructure('   ')).toBe(false);
    expect(validateLyricsStructure('\n\t')).toBe(false);
  });

  it('should return false when lyrics have no structure tags', () => {
    expect(validateLyricsStructure('这是一段没有标签的歌词')).toBe(false);
  });

  it('should return false for invalid structure tags', () => {
    expect(validateLyricsStructure('[hook]\n不是有效标签')).toBe(false);
    expect(validateLyricsStructure('[pre-chorus]\n不是有效标签')).toBe(false);
    expect(validateLyricsStructure('[refrain]\n不是有效标签')).toBe(false);
  });

  it('should return false for partial tag matches', () => {
    expect(validateLyricsStructure('verse without brackets')).toBe(false);
    expect(validateLyricsStructure('[vers]\n缺少字母')).toBe(false);
  });
});
