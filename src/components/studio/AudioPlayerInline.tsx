'use client';

import { useRef, useEffect } from 'react';

interface AudioPlayerInlineProps {
  audioUrl: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
}

export default function AudioPlayerInline({ audioUrl, isPlaying, onPlay, onPause }: AudioPlayerInlineProps) {
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

  const buttonStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: isPlaying
      ? 'linear-gradient(135deg, #D4A574, #C9A86A)'
      : '#F5E6D3',
    color: isPlaying ? 'white' : '#D4A574',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  return (
    <div style={containerStyle}>
      <button
        onClick={isPlaying ? onPause : onPlay}
        style={buttonStyle}
        aria-label={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={handleEnded}
        preload="metadata"
        style={{ display: 'none' }}
      />
    </div>
  );
}
