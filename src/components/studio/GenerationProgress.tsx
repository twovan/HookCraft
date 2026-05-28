'use client';

import { useState, useEffect } from 'react';

interface GenerationProgressProps {
  completedCount: number;
  totalCount: number;
  isGenerating: boolean;
}

const STEPS = [
  { label: '准备生成', code: '01' },
          { label: '构建提示词', code: '02' },
  { label: 'AI 创作中', code: '03' },
  { label: '后处理', code: '04' },
];

export default function GenerationProgress({
  completedCount,
  totalCount,
  isGenerating,
}: GenerationProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      setElapsedSeconds(0);
      return;
    }

    setCurrentStep(0);
    setElapsedSeconds(0);

    const stepTimer = window.setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 4000);

    const secondTimer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(secondTimer);
    };
  }, [isGenerating]);

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
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <span style={eyebrowStyle}>生成队列</span>
          <strong style={titleStyle}>{isGenerating ? '正在生成中...' : '生成完成'}</strong>
        </div>
        {isGenerating && <span style={timerStyle}>{formatTime(elapsedSeconds)}</span>}
      </div>

      <div style={stepsStyle}>
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStep && isGenerating;
          const isDone = idx < currentStep || !isGenerating;

          return (
            <div key={step.code} style={stepStyle}>
              <div
                style={{
                  ...stepDotStyle,
                  background: isDone
                    ? 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))'
                    : isActive
                      ? 'rgba(206,255,53,.16)'
                      : 'rgba(255,255,255,.05)',
                  borderColor: isActive || isDone ? 'rgba(206,255,53,.42)' : 'var(--hc-line)',
                  color: isDone ? '#08090c' : isActive ? 'var(--hc-lime)' : 'var(--hc-muted)',
                  animation: isActive ? 'progressPulse 1.5s infinite' : 'none',
                }}
              >
                {isDone ? '好' : step.code}
              </div>
              <span
                style={{
                  ...stepLabelStyle,
                  color: isActive ? 'var(--hc-lime)' : isDone ? 'var(--hc-text)' : 'var(--hc-muted)',
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {isGenerating && (
        <div style={waveStyle} aria-hidden="true">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: '100%',
                borderRadius: 999,
                background: 'linear-gradient(180deg, var(--hc-lime), rgba(82,214,198,.48))',
                height: `${22 + ((i * 19) % 66)}%`,
                animation: 'waveBar 1.1s ease-in-out infinite alternate',
                animationDelay: `${i * 0.045}s`,
              }}
            />
          ))}
        </div>
      )}

      <div style={trackStyle}>
        <div
          style={{
            ...barStyle,
            width: isGenerating
              ? `${Math.min(((currentStep + 1) / STEPS.length) * 90, 90)}%`
              : '100%',
          }}
        />
        {isGenerating && <span style={shimmerStyle} />}
      </div>

      {isGenerating && (
        <p style={hintStyle}>AI 正在为你创作音乐，通常需要 15-60 秒。</p>
      )}

      <style>{`
        @keyframes progressShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes progressPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(206,255,53,0); }
          50% { box-shadow: 0 0 24px rgba(206,255,53,.16); }
        }
        @keyframes waveBar {
          0% { transform: scaleY(.35); opacity: .55; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--hc-line)',
  borderRadius: 'var(--hc-radius-lg)',
  padding: 26,
  background: 'rgba(24,26,34,.88)',
  boxShadow: 'var(--hc-shadow)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 22,
};

const eyebrowStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--hc-lime)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  marginBottom: 6,
};

const titleStyle: React.CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 18,
  fontWeight: 950,
};

const timerStyle: React.CSSProperties = {
  color: 'var(--hc-lime)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 14,
  fontWeight: 900,
};

const stepsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
  marginBottom: 22,
};

const stepStyle: React.CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 8,
  minWidth: 0,
};

const stepDotStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: '1px solid var(--hc-line)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 10,
  fontWeight: 950,
  transition: 'all .25s ease',
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textAlign: 'center',
};

const waveStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(32, 1fr)',
  alignItems: 'center',
  gap: 3,
  height: 42,
  marginBottom: 16,
};

const trackStyle: React.CSSProperties = {
  width: '100%',
  height: 6,
  background: 'rgba(255,255,255,.08)',
  borderRadius: 999,
  overflow: 'hidden',
  position: 'relative',
};

const barStyle: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, var(--hc-lime), var(--hc-cyan))',
  borderRadius: 999,
  transition: 'width 1s ease',
};

const shimmerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent)',
  animation: 'progressShimmer 2s infinite',
};

const hintStyle: React.CSSProperties = {
  margin: '14px 0 0',
  color: 'var(--hc-muted)',
  fontSize: 12,
  textAlign: 'center',
};
