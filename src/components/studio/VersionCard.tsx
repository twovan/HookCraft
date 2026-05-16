'use client';

import type { VersionResult } from '@/types/generation';
import AudioPlayerInline from './AudioPlayerInline';

interface VersionCardProps {
  version: VersionResult;
  isSelected: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSelect: () => void;
}

export default function VersionCard({
  version,
  isSelected,
  isPlaying,
  onPlay,
  onPause,
  onSelect,
}: VersionCardProps) {
  const isFailed = version.status === 'failed' || version.status === 'safety_blocked';
  const hasAudio = !!version.audioUrl;

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    background: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    border: isSelected
      ? '2px solid #7536d5'
      : '1px solid #2a2a40',
    boxShadow: isSelected
      ? '0 4px 20px rgba(117, 54, 213, 0.2)'
      : '0 2px 12px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.2s ease',
    opacity: isFailed ? 0.6 : 1,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    background: 'rgba(200, 200, 200, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  };

  const versionLabelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: '#e8e8f0',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };

  const durationStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#999',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };

  const wavePreviewStyle: React.CSSProperties = {
    height: 40,
    background: 'rgba(117, 54, 213, 0.15)',
    borderRadius: 8,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '0 12px',
    overflow: 'hidden',
  };

  const selectButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 20,
    border: isSelected ? 'none' : '1px solid #7536d5',
    background: isSelected
      ? 'linear-gradient(135deg, #7536d5, #5a2db8)'
      : 'transparent',
    color: isSelected ? 'white' : '#7536d5',
    fontSize: 13,
    fontWeight: 600,
    cursor: isFailed ? 'not-allowed' : 'pointer',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={cardStyle}>
      {isFailed && (
        <div style={overlayStyle}>
          <span style={{
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 12,
            color: '#C53030',
            fontWeight: 600,
          }}>
            {version.error?.message || '生成失败'}
          </span>
        </div>
      )}

      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={versionLabelStyle}>版本 {version.versionNumber}</span>
          {isSelected && (
            <span style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#7536d5',
              color: 'white',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              ✓
            </span>
          )}
        </div>
        <span style={durationStyle}>{formatDuration(version.durationSeconds)}</span>
      </div>

      {/* Wave preview placeholder */}
      <div style={wavePreviewStyle}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 30,
              borderRadius: 2,
              background: isPlaying
                ? 'linear-gradient(180deg, #7536d5 0%, #5a2db8 100%)'
                : 'rgba(117, 54, 213, 0.4)',
              transform: `scaleY(${0.3 + Math.random() * 0.7})`,
              transformOrigin: 'bottom center',
              transition: 'transform 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Player */}
      {hasAudio && !isFailed && (
        <div style={{ marginBottom: 12 }}>
          <AudioPlayerInline
            audioUrl={version.audioUrl!}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onPause={onPause}
          />
        </div>
      )}

      {/* Select button */}
      <button
        onClick={onSelect}
        disabled={isFailed}
        style={selectButtonStyle}
      >
        {isSelected ? '✓ 已选择' : '选择此版本'}
      </button>
    </div>
  );
}
