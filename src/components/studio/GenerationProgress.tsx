'use client';

import { useState, useEffect } from 'react';

interface GenerationProgressProps {
  completedCount: number;
  totalCount: number;
  isGenerating: boolean;
}

const STEPS = [
  { label: '准备生成', icon: '🎯' },
  { label: '构建 Prompt', icon: '📝' },
  { label: 'AI 创作中', icon: '🎵' },
  { label: '后处理', icon: '✨' },
];

export default function GenerationProgress({
  completedCount,
  totalCount,
  isGenerating,
}: GenerationProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Simulate step progression
  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      setElapsedSeconds(0);
      return;
    }

    setCurrentStep(0);
    setElapsedSeconds(0);

    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 4000);

    const secondTimer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(stepTimer);
      clearInterval(secondTimer);
    };
  }, [isGenerating]);

  // When completed, jump to last step
  useEffect(() => {
    if (completedCount > 0 && completedCount >= totalCount) {
      setCurrentStep(STEPS.length - 1);
    }
  }, [completedCount, totalCount]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      background: '#1a1a2e',
      borderRadius: 20,
      padding: 32,
      border: '1px solid #2a2a40',
      boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <span style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#e8e8f0',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}>
          {isGenerating ? '正在生成中...' : '生成完成'}
        </span>
        {isGenerating && (
          <span style={{
            fontSize: 14,
            color: '#7536d5',
            fontWeight: 600,
            fontFamily: "monospace",
          }}>
            {formatTime(elapsedSeconds)}
          </span>
        )}
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStep && isGenerating;
          const isDone = idx < currentStep || !isGenerating;

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: isDone
                  ? 'linear-gradient(135deg, #7536d5, #5a2db8)'
                  : isActive
                    ? 'rgba(117, 54, 213, 0.3)'
                    : '#2a2a40',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                transition: 'all 0.3s ease',
                boxShadow: isActive ? '0 0 12px rgba(117, 54, 213, 0.5)' : 'none',
                animation: isActive ? 'pulse 1.5s infinite' : 'none',
              }}>
                {isDone ? '✓' : step.icon}
              </div>
              <span style={{
                fontSize: 11,
                color: isActive ? '#7536d5' : isDone ? '#e8e8f0' : '#666',
                fontWeight: isActive ? 600 : 400,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                textAlign: 'center',
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Waveform animation */}
      {isGenerating && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          height: 40,
          marginBottom: 16,
        }}>
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 3,
                borderRadius: 2,
                background: 'linear-gradient(180deg, #7536d5, #5a2db8)',
                animation: `waveBar 1.2s ease-in-out ${i * 0.05}s infinite alternate`,
                height: '100%',
                transform: `scaleY(${0.2 + Math.random() * 0.3})`,
              }}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: 6,
        background: 'rgba(117, 54, 213, 0.15)',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #7536d5, #5a2db8)',
          borderRadius: 3,
          width: isGenerating
            ? `${Math.min(((currentStep + 1) / STEPS.length) * 90, 90)}%`
            : '100%',
          transition: 'width 1s ease',
        }} />
        {isGenerating && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            animation: 'shimmer 2s infinite',
          }} />
        )}
      </div>

      {isGenerating && (
        <p style={{
          fontSize: 12,
          color: '#9ca3af',
          marginTop: 16,
          textAlign: 'center',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}>
          AI 正在为您创作音乐，通常需要 15-60 秒...
        </p>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes waveBar {
          0% { transform: scaleY(0.2); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
