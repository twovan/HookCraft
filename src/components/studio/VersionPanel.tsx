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
    // Play mutex: stop any currently playing version
    setPlayingTaskId(taskId);
  };

  const handlePause = () => {
    setPlayingTaskId(null);
  };

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
    marginBottom: 20,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: '#e8e8f0',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 20,
  };

  const confirmButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 24px',
    borderRadius: 24,
    border: 'none',
    background: selectedVersionId
      ? 'linear-gradient(135deg, #7536d5, #5a2db8)'
      : '#E2E8F0',
    color: selectedVersionId ? 'white' : '#A0AEC0',
    fontSize: 15,
    fontWeight: 700,
    cursor: selectedVersionId && !isLoading ? 'pointer' : 'not-allowed',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    boxShadow: selectedVersionId
      ? '0 4px 16px rgba(117, 54, 213, 0.3)'
      : 'none',
    transition: 'all 0.2s ease',
    opacity: isLoading ? 0.7 : 1,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>选择版本</h3>
        <span style={{ fontSize: 12, color: '#999' }}>
          批次 ID: {batchId.slice(0, 8)}...
        </span>
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
        style={confirmButtonStyle}
      >
        {isLoading ? '确认中...' : '确认选择'}
      </button>
    </div>
  );
}
