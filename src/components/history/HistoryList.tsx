'use client';

import { useState } from 'react';
import AudioPlayerInline from '@/components/studio/AudioPlayerInline';
import SyncedLyrics from '@/components/studio/SyncedLyrics';

interface BatchSummary {
  batchId: string;
  createdAt: string;
  title?: string;
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
  onDelete?: (batchId: string) => void;
  expandedBatchId?: string;
  expandedVersions?: VersionDetail[];
  expandedBatchDetail?: { templateName?: string; prompt?: string };
}

export default function HistoryList({
  batches,
  onExpand,
  onReCreate,
  onDelete,
  expandedBatchId,
  expandedVersions,
  expandedBatchDetail,
}: HistoryListProps) {
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [batchNames, setBatchNames] = useState<Record<string, string>>({});
  const [audioTimes, setAudioTimes] = useState<Record<string, number>>({});

  const saveName = async (batchId: string, name: string) => {
    if (!name.trim()) return;
    setBatchNames((prev) => ({ ...prev, [batchId]: name.trim() }));
    setEditingBatchId(null);
    try {
      await fetch(`/api/batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name.trim() }),
      });
    } catch { /* silently fail */ }
  };

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
        color: '#6b7280',
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
              background: '#1a1a2e',
              borderRadius: 16,
              border: '1px solid #2a2a40',
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
                  background: 'linear-gradient(135deg, rgba(117, 54, 213, 0.15), #0d0d14)',
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
                      onBlur={() => saveName(batch.batchId, editName)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(batch.batchId, editName);
                        if (e.key === 'Escape') setEditingBatchId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        fontSize: 14, fontWeight: 600, color: '#e8e8f0',
                        border: '1px solid #7536d5', borderRadius: 6, padding: '2px 8px',
                        outline: 'none', width: '100%', maxWidth: 300,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                  ) : (
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#e8e8f0', marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span>{batchNames[batch.batchId] || batch.title || batch.templateName || batch.promptSummary || '自定义创作'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBatchId(batch.batchId);
                          setEditName(batchNames[batch.batchId] || batch.title || batch.templateName || batch.promptSummary || '');
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280', padding: 0 }}
                        title="重命名"
                      >✏️</button>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {formatDate(batch.createdAt)} · {batch.generationType === 'preview' ? 'Preview' : 'Full Demo'} · {batch.versionCount} 个版本
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {batch.selectedVersionId && (
                  <span style={{
                    padding: '4px 10px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: '#22c55e',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 8,
                  }}>
                    已选中
                  </span>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('确定要删除这个创作吗？删除后无法恢复。')) {
                        onDelete(batch.batchId);
                      }
                    }}
                    title="删除"
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#ccc',
                      padding: '4px',
                      borderRadius: 4,
                      transition: 'color 0.2s',
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
                  >
                    🗑️
                  </button>
                )}
                <span style={{
                  fontSize: 12,
                  color: '#6b7280',
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
                borderTop: '1px solid #2a2a40',
                padding: '16px 20px',
                background: '#0d0d14',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 20 }}>
                  {/* Left: Creation Info */}
                  <div style={{
                    background: '#1a1a2e',
                    borderRadius: 12,
                    padding: 16,
                    border: '1px solid #2a2a40',
                    alignSelf: 'start',
                  }}>
                    <h4 style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#e8e8f0',
                      margin: '0 0 12px 0',
                      fontFamily: "'Inter', sans-serif",
                    }}>
                      创作信息
                    </h4>
                    {(expandedBatchDetail?.templateName || expandedBatchDetail?.prompt) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {expandedBatchDetail.templateName && (
                          <div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>使用模板</div>
                            <div style={{ fontSize: 13, color: '#e8e8f0', fontWeight: 500 }}>
                              🎵 {expandedBatchDetail.templateName}
                            </div>
                          </div>
                        )}
                        {expandedBatchDetail.prompt && (
                          <div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>提示词</div>
                            <div style={{
                              fontSize: 13,
                              color: '#9ca3af',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}>
                              ✏️ {expandedBatchDetail.prompt}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        自由创作（无模板/提示词）
                      </div>
                    )}
                  </div>

                  {/* Right: Versions with players and lyrics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {expandedVersions.map((version) => {
                      const isSelected = version.status === 'selected';

                      return (
                        <div
                          key={version.taskId}
                          style={{
                            padding: '12px 16px',
                            background: '#1a1a2e',
                            borderRadius: 12,
                            border: isSelected ? '1px solid #7536d5' : '1px solid #2a2a40',
                          }}
                        >
                          {/* Version label */}
                          <div style={{
                            fontSize: 11,
                            color: '#6b7280',
                            marginBottom: 8,
                            fontWeight: 500,
                          }}>
                            版本 {version.versionNumber}
                            {isSelected && (
                              <span style={{
                                marginLeft: 8,
                                padding: '2px 6px',
                                background: 'rgba(34, 197, 94, 0.1)',
                                color: '#22c55e',
                                fontSize: 10,
                                fontWeight: 600,
                                borderRadius: 4,
                              }}>
                                已选中
                              </span>
                            )}
                          </div>

                          {/* Audio player */}
                          {version.audioUrl ? (
                            <audio
                              controls
                              src={version.audioUrl}
                              onTimeUpdate={(e) =>
                                setAudioTimes((prev) => ({
                                  ...prev,
                                  [version.taskId]: (e.target as HTMLAudioElement).currentTime,
                                }))
                              }
                              onPlay={() => setPlayingTaskId(version.taskId)}
                              onPause={() => {
                                if (playingTaskId === version.taskId) setPlayingTaskId(null);
                              }}
                              style={{ width: '100%', height: 32, borderRadius: 8 }}
                            />
                          ) : (
                            <div style={{ fontSize: 13, color: '#6b7280' }}>音频加载中...</div>
                          )}

                          {/* Lyrics */}
                          {version.lyrics && (
                            <div style={{ marginTop: 10 }}>
                              <SyncedLyrics
                                lyrics={version.lyrics}
                                currentTime={audioTimes[version.taskId] || 0}
                                isPlaying={playingTaskId === version.taskId}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ marginTop: 16, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  {onDelete && (
                    <button
                      onClick={() => {
                        if (window.confirm('确定要删除这个创作吗？删除后无法恢复。')) {
                          onDelete(batch.batchId);
                        }
                      }}
                      style={{
                        padding: '8px 20px',
                        borderRadius: 20,
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        background: 'transparent',
                        color: '#ef4444',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      删除
                    </button>
                  )}
                  <button
                    onClick={() => onReCreate(batch.batchId)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 20,
                      border: '1px solid #7536d5',
                      background: 'transparent',
                      color: '#7536d5',
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
