/**
 * 主线程封装：将 File 对象编码为 Base64 字符串
 *
 * - 对 ≥1MB 文件使用 Web Worker 编码，避免阻塞 UI 线程（Requirement 13.1）
 * - 小文件（<1MB）直接在主线程处理
 * - 编码完成后释放 ArrayBuffer 引用以便 GC 回收（Requirement 13.3）
 *
 * Requirements: 13.1, 13.3
 */

const ONE_MB = 1024 * 1024;

/** Worker 实例缓存，避免重复创建 */
let workerInstance: Worker | null = null;

/**
 * 获取或创建 Web Worker 实例
 */
function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('./fileToBase64Worker.ts', import.meta.url)
    );
  }
  return workerInstance;
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串（主线程版本，用于小文件）。
 * 分块处理以避免超出调用栈大小限制。
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

/**
 * 使用 Web Worker 编码 ArrayBuffer 为 Base64
 */
function encodeWithWorker(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();

    const handleMessage = (event: MessageEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);

      if (event.data.type === 'success') {
        resolve(event.data.data);
      } else {
        reject(new Error(event.data.error || 'Worker encoding failed'));
      }
    };

    const handleError = (error: ErrorEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      reject(new Error(error.message || 'Worker error'));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    // Transfer ArrayBuffer to worker (zero-copy)
    worker.postMessage(buffer, [buffer]);
  });
}

/**
 * 将 File 对象编码为 Base64 字符串（不含 data URI 前缀）。
 *
 * - 文件 ≥1MB 时使用 Web Worker 编码，保持 UI 流畅
 * - 文件 <1MB 时直接在主线程编码
 * - 编码完成后释放 ArrayBuffer 引用
 *
 * @param file - 要编码的文件对象
 * @returns Base64 编码字符串
 */
export async function fileToBase64(file: File): Promise<string> {
  // Step 1: 读取文件为 ArrayBuffer
  let buffer: ArrayBuffer | null = await file.arrayBuffer();

  try {
    let base64: string;

    if (file.size >= ONE_MB) {
      // Step 2a: 大文件使用 Web Worker 编码
      // 注意：postMessage 使用 transfer 后，buffer 在主线程不可用
      base64 = await encodeWithWorker(buffer);
    } else {
      // Step 2b: 小文件直接在主线程编码
      base64 = arrayBufferToBase64(buffer);
    }

    return base64;
  } finally {
    // Step 3: 释放 ArrayBuffer 引用，使内存可被 GC 回收（Requirement 13.3）
    buffer = null;
  }
}

/**
 * 终止 Web Worker 并释放资源。
 * 用于用户离开页面时清理（Requirement 13.5）。
 */
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
