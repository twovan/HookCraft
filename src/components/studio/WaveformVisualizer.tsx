'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformVisualizerProps {
  file: File | null;
  onDecodeError?: (error: string) => void;
}

/**
 * 波形可视化组件
 * - 使用 Web Audio API 解码音频并渲染 Canvas 波形
 * - 对超过 60s 的音频降采样至 2000 数据点
 * - 显示音频时长（mm:ss 格式）
 * - 解码失败时显示错误信息
 * - 渲染完成后释放 AudioBuffer 引用
 */
export default function WaveformVisualizer({ file, onDecodeError }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  /** 格式化时长为 mm:ss */
  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  /** 渲染波形到 Canvas */
  const renderWaveform = useCallback((audioBuffer: AudioBuffer, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // 设置 Canvas 实际像素尺寸（高清屏适配）
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // 获取声道数据
    const rawData = audioBuffer.getChannelData(0);
    const audioDuration = audioBuffer.duration;

    // 降采样策略：超过 60s 的音频降采样至最多 2000 数据点
    // 否则降采样至 canvas 宽度
    const maxPoints = audioDuration > 60 ? 2000 : displayWidth;
    const numPoints = Math.min(maxPoints, displayWidth);
    const step = Math.ceil(rawData.length / numPoints);

    // 计算每个采样点的峰值
    const peaks: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const start = i * step;
      const end = Math.min(start + step, rawData.length);
      let max = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(rawData[j]);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }

    // 绘制波形条
    const barWidth = displayWidth / numPoints;
    ctx.fillStyle = '#7536d5';

    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth;
      const height = Math.max(peaks[i] * displayHeight * 0.8, 1); // 最小高度 1px
      const y = (displayHeight - height) / 2;
      ctx.fillRect(x, y, Math.max(barWidth - 0.5, 1), height);
    }
  }, []);

  /** 清空 Canvas */
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  /** 解码音频并渲染波形 */
  useEffect(() => {
    if (!file) {
      // 文件被移除时清理状态
      setDuration(null);
      setError(null);
      setIsLoading(false);
      setRendered(false);
      clearCanvas();
      return;
    }

    let cancelled = false;

    const decodeAndRender = async () => {
      setIsLoading(true);
      setError(null);
      setDuration(null);
      setRendered(false);

      try {
        // 读取文件为 ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        if (cancelled) return;

        // 使用 Web Audio API 解码
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

        let audioBuffer: AudioBuffer | null = null;
        try {
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch {
          if (cancelled) return;
          const errMsg = '音频文件无法解码，请检查文件是否损坏';
          setError(errMsg);
          onDecodeError?.(errMsg);
          setIsLoading(false);
          await audioContext.close();
          return;
        }

        if (cancelled) {
          await audioContext.close();
          return;
        }

        // 设置时长
        const audioDuration = audioBuffer.duration;
        setDuration(audioDuration);

        // 渲染波形
        const canvas = canvasRef.current;
        if (canvas) {
          renderWaveform(audioBuffer, canvas);
        }

        // 释放 AudioBuffer 引用（Requirement 13.3）
        audioBuffer = null;

        // 关闭 AudioContext 释放资源
        await audioContext.close();

        if (!cancelled) {
          setRendered(true);
          setIsLoading(false);
        }
      } catch {
        if (cancelled) return;
        const errMsg = '音频解码失败，请重试';
        setError(errMsg);
        onDecodeError?.(errMsg);
        setIsLoading(false);
      }
    };

    decodeAndRender();

    // 清理函数：组件卸载或 file 变化时取消
    return () => {
      cancelled = true;
    };
  }, [file, renderWaveform, clearCanvas, onDecodeError]);

  // 无文件时不渲染
  if (!file) {
    return null;
  }

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* 加载状态 */}
      {isLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 64,
          background: 'rgba(117, 54, 213, 0.08)',
          borderRadius: 8,
          gap: 8,
        }}>
          <div style={{
            width: 16,
            height: 16,
            border: '2px solid #7536d5',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'waveformSpin 0.8s linear infinite',
          }} />
          <span style={{
            fontSize: 13,
            color: '#9ca3af',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}>
            正在解析音频...
          </span>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 8,
          border: '1px solid rgba(239, 68, 68, 0.2)',
          gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{
            fontSize: 13,
            color: '#ef4444',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}>
            {error}
          </span>
        </div>
      )}

      {/* 波形可视化区域 - Canvas 始终存在，通过 visibility 控制显示 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        visibility: rendered && !error ? 'visible' : 'hidden',
        height: rendered && !error ? 'auto' : 0,
        overflow: 'hidden',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 64,
            borderRadius: 8,
            background: 'rgba(117, 54, 213, 0.06)',
            flex: 1,
          }}
        />
        {duration !== null && (
          <span style={{
            fontSize: 13,
            color: '#e8e8f0',
            fontWeight: 500,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {formatDuration(duration)}
          </span>
        )}
      </div>

      <style>{`
        @keyframes waveformSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
