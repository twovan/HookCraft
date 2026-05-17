'use client';

import { useState, useCallback, useRef } from 'react';
import type { SensitivityCheckInput, SensitivityCheckResult } from '@/types/sensitivity';

export type SensitivityCheckStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseSensitivityCheckResult {
  /** 触发敏感词检测 */
  check: (input: SensitivityCheckInput) => Promise<SensitivityCheckResult | null>;
  /** 当前检测状态 */
  status: SensitivityCheckStatus;
  /** 检测结果 */
  result: SensitivityCheckResult | null;
  /** 当前加载提示文案 */
  loadingMessage: string;
  /** 重置状态为 idle */
  reset: () => void;
  /** 错误信息 */
  error: string | null;
}

/**
 * 敏感词检测 Hook
 *
 * 封装 /api/sensitivity-check 调用，管理检测状态和加载提示文案。
 * 实现降级策略：请求失败时允许继续生成。
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6, 6.5
 */
export function useSensitivityCheck(): UseSensitivityCheckResult {
  const [status, setStatus] = useState<SensitivityCheckStatus>('idle');
  const [result, setResult] = useState<SensitivityCheckResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /** 清除加载提示切换定时器 */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** 重置状态为 idle */
  const reset = useCallback(() => {
    clearTimer();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setResult(null);
    setLoadingMessage('');
    setError(null);
  }, [clearTimer]);

  /** 触发敏感词检测 */
  const check = useCallback(
    async (input: SensitivityCheckInput): Promise<SensitivityCheckResult | null> => {
      // 清除之前的状态
      clearTimer();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 设置初始加载状态
      setStatus('loading');
      setResult(null);
      setError(null);
      setLoadingMessage('正在准备创作...');

      // 2s 后切换加载提示文案（Requirement 5.6）
      timerRef.current = setTimeout(() => {
        setLoadingMessage('正在进行内容安全检查...');
      }, 2000);

      // 创建新的 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch('/api/sensitivity-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '检测请求失败' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const checkResult: SensitivityCheckResult = await response.json();

        clearTimer();
        setStatus('success');
        setResult(checkResult);
        setLoadingMessage('');
        return checkResult;
      } catch (err) {
        clearTimer();

        // 如果是主动取消的请求，不更新状态
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        // 降级策略（Requirement 6.5）：请求失败时允许继续生成
        const errorMessage = err instanceof Error ? err.message : '检测服务暂时不可用';
        setStatus('error');
        setError(errorMessage);
        setLoadingMessage('');

        // 返回 null 表示检测失败，调用方可根据 status === 'error' 决定是否继续
        return null;
      }
    },
    [clearTimer]
  );

  return {
    check,
    status,
    result,
    loadingMessage,
    reset,
    error,
  };
}
