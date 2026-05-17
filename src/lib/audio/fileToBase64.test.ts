// fileToBase64 单元测试
// Requirements: 13.1, 13.3
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Web Worker ──────────────────────────────────

interface MockWorkerInstance {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: Map<string, Function[]>;
  _simulateMessage: (data: unknown) => void;
  _simulateError: (error: Partial<ErrorEvent>) => void;
}

const mockWorkerInstances: MockWorkerInstance[] = [];

// Use a class so `new Worker(...)` works
class MockWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn((event: string, handler: Function) => {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event)!.push(handler);
  });
  removeEventListener = vi.fn((event: string, handler: Function) => {
    const handlers = this._listeners.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  });
  _listeners = new Map<string, Function[]>();

  _simulateMessage(data: unknown) {
    const handlers = this._listeners.get('message') || [];
    handlers.forEach((h) => h({ data } as MessageEvent));
  }

  _simulateError(error: Partial<ErrorEvent>) {
    const handlers = this._listeners.get('error') || [];
    handlers.forEach((h) => h(error as ErrorEvent));
  }

  constructor() {
    mockWorkerInstances.push(this as unknown as MockWorkerInstance);
  }
}

vi.stubGlobal('Worker', MockWorker);

/** 获取最近创建的 Worker 实例 */
function getLatestWorker(): MockWorkerInstance {
  return mockWorkerInstances[mockWorkerInstances.length - 1];
}

/** 创建模拟 File 对象 */
function createMockFile(size: number): File {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) {
    view[i] = i % 256;
  }
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  return new File([blob], 'test.mp3', { type: 'audio/mpeg' });
}

describe('fileToBase64', () => {
  let fileToBase64: (file: File) => Promise<string>;
  let terminateWorker: () => void;

  beforeEach(async () => {
    // Clear tracked instances
    mockWorkerInstances.length = 0;
    // Reset module to get fresh worker cache
    vi.resetModules();
    const mod = await import('./fileToBase64');
    fileToBase64 = mod.fileToBase64;
    terminateWorker = mod.terminateWorker;
  });

  afterEach(() => {
    terminateWorker();
  });

  // ─── 小文件（<1MB）主线程编码 ──────────────────────────

  describe('小文件（<1MB）主线程编码', () => {
    it('小文件直接在主线程编码，不创建 Worker', async () => {
      const file = createMockFile(100); // 100 bytes
      const result = await fileToBase64(file);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      // Worker 不应被创建
      expect(mockWorkerInstances.length).toBe(0);
    });

    it('返回有效的 Base64 字符串（不含 data URI 前缀）', async () => {
      const file = createMockFile(256);
      const result = await fileToBase64(file);

      // 不应包含 data: 前缀
      expect(result).not.toContain('data:');
      // 应该是有效的 base64 字符
      expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('编码结果可正确解码回原始数据', async () => {
      const originalSize = 128;
      const file = createMockFile(originalSize);
      const result = await fileToBase64(file);

      // 解码 base64
      const decoded = atob(result);
      expect(decoded.length).toBe(originalSize);

      // 验证内容一致
      for (let i = 0; i < originalSize; i++) {
        expect(decoded.charCodeAt(i)).toBe(i % 256);
      }
    });

    it('恰好 1MB-1 字节的文件在主线程处理', async () => {
      const size = 1024 * 1024 - 1;
      const file = createMockFile(size);
      const result = await fileToBase64(file);

      expect(result).toBeTruthy();
      expect(mockWorkerInstances.length).toBe(0);
    });
  });

  // ─── 大文件（≥1MB）Worker 编码 ──────────────────────────

  describe('大文件（≥1MB）Worker 编码', () => {
    it('≥1MB 文件使用 Web Worker 编码', async () => {
      const size = 1024 * 1024; // exactly 1MB
      const file = createMockFile(size);

      // Start encoding (will await worker response)
      const promise = fileToBase64(file);

      // Allow microtask to proceed (file.arrayBuffer() is async)
      await new Promise((r) => setTimeout(r, 0));

      // Worker 应被创建
      expect(mockWorkerInstances.length).toBe(1);

      // 模拟 Worker 返回成功
      getLatestWorker()._simulateMessage({
        type: 'success',
        data: 'bW9ja0Jhc2U2NA==',
      });

      const result = await promise;
      expect(result).toBe('bW9ja0Jhc2U2NA==');
    });

    it('Worker 使用 transfer 传递 ArrayBuffer', async () => {
      const size = 2 * 1024 * 1024; // 2MB
      const file = createMockFile(size);

      const promise = fileToBase64(file);

      // Allow microtask to proceed
      await new Promise((r) => setTimeout(r, 0));

      const worker = getLatestWorker();
      // 验证 postMessage 被调用时使用了 transfer
      expect(worker.postMessage).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        expect.arrayContaining([expect.any(ArrayBuffer)])
      );

      worker._simulateMessage({
        type: 'success',
        data: 'dGVzdA==',
      });

      await promise;
    });

    it('Worker 返回错误时 reject', async () => {
      const size = 1024 * 1024;
      const file = createMockFile(size);

      const promise = fileToBase64(file);

      await new Promise((r) => setTimeout(r, 0));

      getLatestWorker()._simulateMessage({
        type: 'error',
        error: 'Encoding failed',
      });

      await expect(promise).rejects.toThrow('Encoding failed');
    });

    it('Worker 发生 error 事件时 reject', async () => {
      const size = 1024 * 1024;
      const file = createMockFile(size);

      const promise = fileToBase64(file);

      await new Promise((r) => setTimeout(r, 0));

      getLatestWorker()._simulateError({
        message: 'Worker crashed',
      });

      await expect(promise).rejects.toThrow('Worker crashed');
    });

    it('复用 Worker 实例（不重复创建）', async () => {
      const size = 1024 * 1024;
      const file1 = createMockFile(size);
      const file2 = createMockFile(size);

      // 第一次调用
      const promise1 = fileToBase64(file1);
      await new Promise((r) => setTimeout(r, 0));
      getLatestWorker()._simulateMessage({ type: 'success', data: 'YQ==' });
      await promise1;

      // 第二次调用
      const promise2 = fileToBase64(file2);
      await new Promise((r) => setTimeout(r, 0));
      getLatestWorker()._simulateMessage({ type: 'success', data: 'Yg==' });
      await promise2;

      // Worker 只被创建一次
      expect(mockWorkerInstances.length).toBe(1);
    });
  });

  // ─── terminateWorker ──────────────────────────────────

  describe('terminateWorker', () => {
    it('终止 Worker 并释放引用', async () => {
      const size = 1024 * 1024;
      const file = createMockFile(size);

      const promise = fileToBase64(file);
      await new Promise((r) => setTimeout(r, 0));
      getLatestWorker()._simulateMessage({ type: 'success', data: 'YQ==' });
      await promise;

      const workerRef = getLatestWorker();
      terminateWorker();

      expect(workerRef.terminate).toHaveBeenCalled();
    });

    it('未创建 Worker 时调用 terminateWorker 不报错', () => {
      expect(() => terminateWorker()).not.toThrow();
    });

    it('终止后再次编码大文件会创建新 Worker', async () => {
      const size = 1024 * 1024;
      const file = createMockFile(size);

      // 第一次
      const promise1 = fileToBase64(file);
      await new Promise((r) => setTimeout(r, 0));
      getLatestWorker()._simulateMessage({ type: 'success', data: 'YQ==' });
      await promise1;

      terminateWorker();

      // 第二次
      const promise2 = fileToBase64(file);
      await new Promise((r) => setTimeout(r, 0));
      getLatestWorker()._simulateMessage({ type: 'success', data: 'Yg==' });
      await promise2;

      // Worker 被创建两次
      expect(mockWorkerInstances.length).toBe(2);
    });
  });
});
