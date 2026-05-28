'use client';

import { useRef, useEffect } from 'react';

interface AudioPlayerInlineProps {
  audioUrl: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export default function AudioPlayerInline({
  audioUrl,
  isPlaying,
  onPlay,
  onPause,
  onTimeUpdate,
}: AudioPlayerInlineProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        onPause();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, onPause]);

  const handleEnded = () => {
    onPause();
  };

  const handleTimeUpdate = () => {
    if (onTimeUpdate && audioRef.current) {
      onTimeUpdate(audioRef.current.currentTime);
    }
  };

  return (
    <div style={containerStyle}>
      <button
        onClick={isPlaying ? onPause : onPlay}
        style={{
          ...buttonStyle,
          background: isPlaying
            ? 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))'
            : 'rgba(206,255,53,.12)',
          color: isPlaying ? '#08090c' : 'var(--hc-lime)',
          borderColor: isPlaying ? 'transparent' : 'rgba(206,255,53,.34)',
        }}
        aria-label={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        preload="metadata"
        style={{ display: 'none' }}
      />
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.3 3.2v9.6l7.2-4.8-7.2-4.8Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 3.2h2.2v9.6H4.5V3.2Zm4.8 0h2.2v9.6H9.3V3.2Z" fill="currentColor" />
    </svg>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const buttonStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  border: '1px solid rgba(206,255,53,.34)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  transition: 'all 0.2s ease',
  flexShrink: 0,
};
