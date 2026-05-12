'use client';

interface GenerationProgressProps {
  completedCount: number;
  totalCount: number;
  isGenerating: boolean;
}

export default function GenerationProgress({
  completedCount,
  totalCount,
  isGenerating,
}: GenerationProgressProps) {
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const containerStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 20,
    padding: 24,
    border: '1px solid #f0ebe4',
    boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: '#2D2D2D',
    fontFamily: "'Inter', sans-serif",
  };

  const countStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#D4A574',
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
  };

  const barContainerStyle: React.CSSProperties = {
    width: '100%',
    height: 8,
    background: '#F5E6D3',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  };

  const barFillStyle: React.CSSProperties = {
    height: '100%',
    background: 'linear-gradient(90deg, #D4A574, #C9A86A)',
    borderRadius: 4,
    width: `${progress}%`,
    transition: 'width 0.5s ease',
    position: 'relative',
  };

  const shimmerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: isGenerating
      ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
      : 'none',
    animation: isGenerating ? 'shimmer 1.5s infinite' : 'none',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>
          {isGenerating ? '正在生成中...' : '生成完成'}
        </span>
        <span style={countStyle}>
          {completedCount}/{totalCount}
        </span>
      </div>

      <div style={barContainerStyle}>
        <div style={barFillStyle}>
          <div style={shimmerStyle} />
        </div>
      </div>

      {isGenerating && (
        <p style={hintStyle}>
          AI 正在为您创作 {totalCount} 个版本，请稍候...
        </p>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
