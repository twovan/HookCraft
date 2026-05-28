'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformVisualizerProps {
  file: File | null;
  onDecodeError?: (error: string) => void;
}

export default function WaveformVisualizer({ file, onDecodeError }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderWaveform = useCallback((audioBuffer: AudioBuffer, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const rawData = audioBuffer.getChannelData(0);
    const audioDuration = audioBuffer.duration;
    const maxPoints = audioDuration > 60 ? 2000 : displayWidth;
    const numPoints = Math.min(maxPoints, displayWidth);
    const step = Math.ceil(rawData.length / numPoints);
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

    const gradient = ctx.createLinearGradient(0, 0, displayWidth, 0);
    gradient.addColorStop(0, '#ceff35');
    gradient.addColorStop(1, '#52d6c6');
    ctx.fillStyle = gradient;

    const barWidth = displayWidth / numPoints;
    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth;
      const height = Math.max(peaks[i] * displayHeight * 0.8, 1);
      const y = (displayHeight - height) / 2;
      ctx.fillRect(x, y, Math.max(barWidth - 0.5, 1), height);
    }
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!file) {
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
        const arrayBuffer = await file.arrayBuffer();
        if (cancelled) return;

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

        setDuration(audioBuffer.duration);

        const canvas = canvasRef.current;
        if (canvas) {
          renderWaveform(audioBuffer, canvas);
        }

        audioBuffer = null;
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

    return () => {
      cancelled = true;
    };
  }, [file, renderWaveform, clearCanvas, onDecodeError]);

  if (!file) return null;

  return (
    <div style={containerStyle}>
      {isLoading && (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          <span style={messageStyle}>正在解析音频...</span>
        </div>
      )}

      {error && !isLoading && (
        <div style={errorStyle}>
          <span style={{ fontSize: 13, color: '#ff8b76' }}>{error}</span>
        </div>
      )}

      <div
        style={{
          ...waveWrapStyle,
          visibility: rendered && !error ? 'visible' : 'hidden',
          height: rendered && !error ? 'auto' : 0,
        }}
      >
        <canvas ref={canvasRef} style={canvasStyle} />
        {duration !== null && <span style={durationStyle}>{formatDuration(duration)}</span>}
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

const containerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 64,
  borderRadius: 10,
  border: '1px solid var(--hc-line)',
  background: 'rgba(206, 255, 53, 0.08)',
  gap: 9,
};

const spinnerStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  border: '2px solid var(--hc-lime)',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'waveformSpin 0.8s linear infinite',
};

const messageStyle: React.CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255, 90, 61, 0.26)',
  background: 'rgba(255, 90, 61, 0.1)',
};

const waveWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  overflow: 'hidden',
};

const canvasStyle: React.CSSProperties = {
  width: '100%',
  height: 64,
  borderRadius: 10,
  border: '1px solid var(--hc-line)',
  background: 'rgba(206, 255, 53, 0.06)',
  flex: 1,
};

const durationStyle: React.CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 13,
  fontWeight: 800,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};
