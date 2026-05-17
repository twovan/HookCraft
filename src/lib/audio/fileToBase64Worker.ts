/**
 * Web Worker: 将 ArrayBuffer 编码为 Base64 字符串
 *
 * 用于大文件（≥1MB）的 Base64 编码，避免阻塞主线程。
 * 通过 postMessage 通信：
 *   - 接收: ArrayBuffer（音频文件的二进制数据）
 *   - 返回成功: { type: 'success', data: string }（Base64 字符串，不含 data URI 前缀）
 *   - 返回错误: { type: 'error', error: string }
 *
 * 支持通过 worker.terminate() 终止（用户离开页面时）。
 *
 * Requirements: 13.1, 13.5
 */

/* eslint-disable no-restricted-globals */

/**
 * 将 ArrayBuffer 转换为 Base64 字符串。
 * 分块处理以避免超出调用栈大小限制（大文件场景）。
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // 每次处理 8KB，避免 String.fromCharCode 参数过多
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

self.addEventListener('message', (event: MessageEvent) => {
  try {
    const buffer = event.data as ArrayBuffer;

    if (!(buffer instanceof ArrayBuffer)) {
      self.postMessage({
        type: 'error',
        error: 'Invalid input: expected ArrayBuffer',
      });
      return;
    }

    if (buffer.byteLength === 0) {
      self.postMessage({
        type: 'error',
        error: 'Invalid input: ArrayBuffer is empty',
      });
      return;
    }

    const base64 = arrayBufferToBase64(buffer);

    self.postMessage({
      type: 'success',
      data: base64,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown encoding error';
    self.postMessage({
      type: 'error',
      error: errorMessage,
    });
  }
});
