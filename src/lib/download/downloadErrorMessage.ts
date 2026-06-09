export function resolveDownloadErrorMessage(payload: unknown, status: number) {
  const value = payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : {};
  const error = typeof value.error === 'string' ? value.error.trim() : '';
  const message = typeof value.message === 'string' ? value.message.trim() : '';

  return error || message || `下载失败，请稍后重试（HTTP ${status}）`;
}
