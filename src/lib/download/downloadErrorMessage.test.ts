import { describe, expect, it } from 'vitest';
import { resolveDownloadErrorMessage } from './downloadErrorMessage';

describe('resolveDownloadErrorMessage', () => {
  it('uses the server error message when download API returns JSON', () => {
    expect(resolveDownloadErrorMessage({ error: '音频文件下载失败，请重试' }, 400)).toBe('音频文件下载失败，请重试');
  });

  it('falls back to a status-aware message when the response body has no error text', () => {
    expect(resolveDownloadErrorMessage({}, 500)).toBe('下载失败，请稍后重试（HTTP 500）');
  });
});
