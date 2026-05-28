'use client';

import { useState } from 'react';
import type { VersionResult } from '@/types/generation';
import AudioPlayerInline from './AudioPlayerInline';
import SyncedLyrics from './SyncedLyrics';

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
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <article
      style={{
        ...cardStyle,
        borderColor: isSelected ? 'rgba(206,255,53,.58)' : 'var(--hc-line)',
        boxShadow: isSelected ? '0 16px 38px rgba(206,255,53,.12)' : 'var(--hc-shadow)',
        opacity: isFailed ? 0.66 : 1,
      }}
    >
      {isFailed && (
        <div style={overlayStyle}>
          <span>{version.error?.message || '生成失败'}</span>
        </div>
      )}

      <div style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <span style={eyebrowStyle}>Version {version.versionNumber}</span>
          <strong style={versionLabelStyle}>版本 {version.versionNumber}</strong>
        </div>
        <span style={durationStyle}>{formatDuration(version.durationSeconds)}</span>
      </div>

      <div style={wavePreviewStyle} aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            style={{
              height: `${24 + ((i * 23) % 68)}%`,
              background: isPlaying
                ? 'linear-gradient(180deg, var(--hc-lime), var(--hc-cyan))'
                : 'rgba(206,255,53,.34)',
            }}
          />
        ))}
      </div>

      {hasAudio && !isFailed && (
        <div style={{ marginBottom: 12 }}>
          <AudioPlayerInline
            audioUrl={version.audioUrl!}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onPause={onPause}
            onTimeUpdate={setAudioCurrentTime}
          />
        </div>
      )}

      {hasAudio && !isFailed && version.lyrics && (
        <div style={{ marginBottom: 12 }}>
          <SyncedLyrics
            lyrics={version.lyrics}
            currentTime={audioCurrentTime}
            isPlaying={isPlaying}
          />
        </div>
      )}

      <button onClick={onSelect} disabled={isFailed} style={selectButtonStyle(isSelected, isFailed)}>
        {isSelected ? '已选择' : '选择此版本'}
      </button>
    </article>
  );
}

const cardStyle: React.CSSProperties = {
  position: 'relative',
  borderRadius: 16,
  padding: 18,
  border: '1px solid var(--hc-line)',
  background: 'rgba(24,26,34,.88)',
  transition: 'border-color .2s ease, box-shadow .2s ease, opacity .2s ease',
  overflow: 'hidden',
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 2,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 16,
  background: 'rgba(8,9,12,.72)',
  backdropFilter: 'blur(2px)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 12,
};

const eyebrowStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--hc-lime)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  marginBottom: 4,
};

const versionLabelStyle: React.CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 15,
  fontWeight: 950,
};

const durationStyle: React.CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const wavePreviewStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 10,
  marginBottom: 12,
  display: 'grid',
  gridTemplateColumns: 'repeat(24, 1fr)',
  alignItems: 'center',
  gap: 2,
  padding: '0 12px',
  overflow: 'hidden',
  border: '1px solid var(--hc-line)',
  background: 'rgba(8,9,12,.36)',
};

const selectButtonStyle = (isSelected: boolean, isFailed: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '11px 16px',
  borderRadius: 999,
  border: isSelected ? '1px solid transparent' : '1px solid rgba(206,255,53,.34)',
  background: isSelected
    ? 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))'
    : 'rgba(206,255,53,.08)',
  color: isSelected ? '#08090c' : 'var(--hc-lime)',
  fontSize: 13,
  fontWeight: 950,
  cursor: isFailed ? 'not-allowed' : 'pointer',
  transition: 'all .2s ease',
});
