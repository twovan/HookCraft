'use client';

import { useState } from 'react';
import type { VersionResult } from '@/types/generation';
import VersionCard from './VersionCard';

interface VersionPanelProps {
  batchId: string;
  versions: VersionResult[];
  selectedVersionId?: string;
  onSelect: (taskId: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export default function VersionPanel({
  batchId,
  versions,
  selectedVersionId,
  onSelect,
  onConfirm,
  isLoading,
}: VersionPanelProps) {
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);

  const handlePlay = (taskId: string) => {
    setPlayingTaskId(taskId);
  };

  const handlePause = () => {
    setPlayingTaskId(null);
  };

  return (
    <section style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <span style={eyebrowStyle}>Generated Takes</span>
          <h3 style={titleStyle}>选择版本</h3>
        </div>
        <span style={batchStyle}>批次 ID: {batchId.slice(0, 8)}...</span>
      </div>

      <div style={gridStyle}>
        {versions.map((version) => (
          <VersionCard
            key={version.taskId}
            version={version}
            isSelected={selectedVersionId === version.taskId}
            isPlaying={playingTaskId === version.taskId}
            onPlay={() => handlePlay(version.taskId)}
            onPause={handlePause}
            onSelect={() => onSelect(version.taskId)}
          />
        ))}
      </div>

      <button
        onClick={onConfirm}
        disabled={!selectedVersionId || isLoading}
        style={{
          ...confirmButtonStyle,
          background: selectedVersionId
            ? 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))'
            : 'rgba(255,255,255,.07)',
          color: selectedVersionId ? '#08090c' : 'var(--hc-muted)',
          cursor: selectedVersionId && !isLoading ? 'pointer' : 'not-allowed',
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? '确认中...' : '确认选择'}
      </button>
    </section>
  );
}

const containerStyle: React.CSSProperties = {
  border: '1px solid var(--hc-line)',
  borderRadius: 'var(--hc-radius-lg)',
  padding: 24,
  background: 'rgba(24,26,34,.88)',
  boxShadow: 'var(--hc-shadow)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 20,
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
  margin: 0,
  color: 'var(--hc-text)',
  fontSize: 20,
  fontWeight: 950,
};

const batchStyle: React.CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
  marginBottom: 18,
};

const confirmButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 24px',
  borderRadius: 999,
  border: 'none',
  fontSize: 15,
  fontWeight: 950,
  transition: 'all .2s ease',
};
