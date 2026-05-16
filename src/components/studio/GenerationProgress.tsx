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
    background: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    border: '1px solid #2a2a40',
    boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
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
    color: '#e8e8f0',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };

  const countStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#7536d5',
    fontWeight: 600,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };

  const barContainerStyle: React.CSSProperties = {
    width: '100%',
    height: 8,
    background: 'rgba(117, 54, 213, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  };

  const barFillStyle: React.CSSProperties = {
    height: '100%',
    background: 'linear-gradient(90deg, #7536d5, #5a2db8)',
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
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
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
          AI 正在为您创作音乐，请稍候...
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
