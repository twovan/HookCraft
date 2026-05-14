'use client';

import { useState } from 'react';
import AudioPlayerInline from '@/components/studio/AudioPlayerInline';

interface BatchSummary {
  batchId: string;
  createdAt: string;
  templateName?: string;
  promptSummary?: string;
  generationType: 'preview' | 'full_demo';
  versionCount: number;
  selectedVersionId?: string;
  status: string;
}

interface VersionDetail {
  taskId: string;
  versionNumber: number;
  status: string;
  audioUrl?: string;
  lyrics?: string;
  durationSeconds?: number;
  creditsConsumed: number;
  createdAt: string;
}

interface HistoryListProps {
  batches: BatchSummary[];
  onExpand: (batchId: string) => void;
  onReCreate: (batchId: string) => void;
  expandedBatchId?: string;
  expandedVersions?: VersionDetail[];
}

export default function HistoryList({
  batches,
  onExpand,
  onReCreate,
  expandedBatchId,
  expandedVersions,
}: HistoryListProps) {
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [batchNames, setBatchNames] = useState<Record<string, string>>({});

  const handleDownload = async (taskId: string) => {
    setDownloadingTaskId(taskId);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `creation-${taskId}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Handle error
    } finally {
      setDownloadingTaskId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (batches.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#999',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🎵</div>
        <p style={{ fontSize: 15 }}>暂无创作记录</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {batches.map((batch) => {
        const isExpanded = expandedBatchId === batch.batchId;

        return (
          <div
            key={batch.batchId}
            style={{
              background: 'white',
              borderRadius: 16,
              border: '1px solid #f0ebe4',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Batch summary row */}
            <div
              onClick={() => onExpand(batch.batchId)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #F5E6D3, #FDFBF7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}>
                  🎵
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingBatchId === batch.batchId ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => {
                        if (editName.trim()) setBatchNames((prev) => ({ ...prev, [batch.batchId]: editName.trim() }));
                        setEditingBatchId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editName.trim()) setBatchNames((prev) => ({ ...prev, [batch.batchId]: editName.trim() }));
                          setEditingBatchId(null);
                        }
                        if (e.key === 'Escape') setEditingBatchId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        fontSize: 14, fontWeight: 600, color: '#2D2D2D',
                        border: '1px solid #D4A574', borderRadius: 6, padding: '2px 8px',
                        outline: 'none', width: '100%', maxWidth: 300,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                  ) : (
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#2D2D2D', marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span>{batchNames[batch.batchId] || batch.templateName || batch.promptSummary || '自定义创作'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBatchId(batch.batchId);
                          setEditName(batchNames[batch.batchId] || batch.templateName || batch.promptSummary || '');
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#999', padding: 0 }}
                        title="重命名"
                      >✏️</button>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {formatDate(batch.createdAt)} · {batch.generationType === 'preview' ? 'Preview' : 'Full Demo'} · {batch.versionCount} 个版本
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {batch.selectedVersionId && (
                  <span style={{
                    padding: '4px 10px',
                    background: '#F0FFF4',
                    color: '#22c55e',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 8,
                  }}>
                    已选中
                  </span>
                )}
                <span style={{
                  fontSize: 12,
                  color: '#999',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  display: 'inline-block',
                }}>
                  ▼
                </span>
              </div>
            </div>

            {/* Expanded versions */}
            {isExpanded && expandedVersions && (
              <div style={{
                borderTop: '1px solid #f0ebe4',
                padding: '16px 20px',
                background: '#FDFBF7',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {expandedVersions.map((version) => {
                    const isSelected = version.status === 'selected';
                    const isArchived = version.status === 'archived';

                    return (
                      <div
                        key={version.taskId}
                        style={{
                          padding: '12px 16px',
                          background: 'white',
                          borderRadius: 12,
                          border: isSelected ? '1px solid #D4A574' : '1px solid #f0ebe4',
                        }}
                      >
                        {/* Version header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: version.audioUrl ? 8 : 0 }}>
                          {/* Play button */}
                          {version.audioUrl && (
                            <AudioPlayerInline
                              audioUrl={version.audioUrl}
                              isPlaying={playingTaskId === version.taskId}
                              onPlay={() => setPlayingTaskId(version.taskId)}
                              onPause={() => setPlayingTaskId(null)}
                            />
                          )}

                          {/* Version info */}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#2D2D2D' }}>
                              版本 {version.versionNumber}
                            </span>
                            <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
                              {formatDuration(version.durationSeconds)}
                            </span>
                          </div>

                          {/* Status tag */}
                          {isSelected && (
                            <span style={{ padding: '3px 8px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, borderRadius: 6 }}>已选中</span>
                          )}
                          {isArchived && (
                            <span style={{ padding: '3px 8px', background: '#F5F5F5', color: '#999', fontSize: 11, fontWeight: 600, borderRadius: 6 }}>未选中</span>
                          )}
                        </div>

                        {/* Audio timeline */}
                        {version.audioUrl && (
                          <div style={{ marginTop: 8 }}>
                            <audio
                              controls
                              src={version.audioUrl}
                              style={{ width: '100%', height: 32, borderRadius: 8 }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Re-create button */}
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <button
                    onClick={() => onReCreate(batch.batchId)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 20,
                      border: '1px solid #D4A574',
                      background: 'transparent',
                      color: '#D4A574',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    重新创作
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
