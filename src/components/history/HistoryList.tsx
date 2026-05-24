'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import SyncedLyrics from '@/components/studio/SyncedLyrics';

interface BatchSummary {
  batchId: string;
  taskId?: string;
  versionNumber?: number;
  createdAt: string;
  title?: string | null;
  templateName?: string;
  promptSummary?: string;
  generationType: 'preview' | 'full_demo';
  versionCount: number;
  selectedVersionId?: string;
  status: string;
  errorMessage?: string | null;
  refundedCredits?: number;
  durationSeconds?: number | null;
  lyrics?: string | null;
  authorName?: string | null;
  styleTags?: string[];
  canEditSong?: boolean;
  hasStemCache?: boolean;
  stemJobId?: string | null;
}

interface VersionDetail {
  taskId: string;
  versionNumber: number;
  status: string;
  audioUrl?: string;
  lyrics?: string;
  durationSeconds?: number;
  creditsConsumed: number;
  errorMessage?: string;
  createdAt: string;
  title?: string | null;
  authorName?: string | null;
  styleTags?: string[];
  canEditSong?: boolean;
  hasStemCache?: boolean;
  stemJobId?: string | null;
}

interface HistoryListProps {
  batches: BatchSummary[];
  onExpand: (taskId: string, batchId?: string) => void;
  onReCreate: (taskId: string) => void;
  onDelete?: (batchId: string) => void;
  expandedBatchId?: string;
  expandedTaskId?: string;
  expandedVersions?: VersionDetail[];
  expandedBatchDetail?: { templateName?: string; prompt?: string };
}

export default function HistoryList({
  batches,
  onExpand,
  onReCreate,
  onDelete,
  expandedBatchId,
  expandedTaskId,
  expandedVersions,
  expandedBatchDetail,
}: HistoryListProps) {
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [batchNames, setBatchNames] = useState<Record<string, string>>({});
  const [audioTimes, setAudioTimes] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const expandedBatch = batches.find((batch) => (batch.taskId || batch.batchId) === expandedTaskId);
  const showDetail = Boolean(expandedBatchId && expandedBatch && expandedVersions);

  const handleAudioPlay = (taskId: string) => {
    Object.entries(audioRefs.current).forEach(([id, el]) => {
      if (id !== taskId && el && !el.paused) el.pause();
    });
    setPlayingTaskId(taskId);
  };

  const saveName = async (taskId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBatchNames((prev) => ({ ...prev, [taskId]: trimmed }));
    setEditingBatchId(null);
    try {
      await fetch(`/api/versions/${taskId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
      // Keep the optimistic title; rename is non-critical for playback.
    }
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
    } finally {
      setDownloadingTaskId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
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
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getBatchTitle = (batch: BatchSummary) => {
    const songId = batch.taskId || batch.batchId;
    return batchNames[songId] || batch.title || batch.templateName || '未命名歌曲';
  };

  if (batches.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 38, marginBottom: 12, opacity: 0.55 }}>♪</div>
        <p style={{ fontSize: 15, margin: 0 }}>暂无创作记录</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showDetail ? 'minmax(0, 1fr) minmax(360px, 420px)' : 'minmax(0, 1fr)',
        gap: 18,
        alignItems: 'start',
      }}
    >
      <section style={listPanelStyle}>
        <div style={listHeaderStyle}>
          <div style={{ color: '#d7d7df', fontSize: 16, fontWeight: 600 }}>
            我的创作({batches.length})
          </div>
          <div style={{ display: 'flex', gap: 18, color: '#a1a1aa', fontSize: 13 }}>
            <span>状态 <strong style={{ color: '#e8e8f0' }}>全部</strong></span>
            <span>模型 <strong style={{ color: '#e8e8f0' }}>全部</strong></span>
          </div>
        </div>

        <div style={{ maxHeight: showDetail ? '76vh' : 'none', overflowY: showDetail ? 'auto' : 'visible' }}>
          {batches.map((batch) => {
            const songId = batch.taskId || batch.batchId;
            const isActive = expandedTaskId === songId;
            const isFailed = batch.status === 'failed';
            const title = getBatchTitle(batch);

            return (
              <div
                key={songId}
                onClick={() => !isFailed && onExpand(songId, batch.batchId)}
                style={{
                  ...rowStyle,
                  background: isActive ? 'rgba(212, 165, 116, 0.11)' : 'transparent',
                  cursor: isFailed ? 'default' : 'pointer',
                  opacity: isFailed ? 0.82 : 1,
                }}
              >
                <div style={{ ...coverStyle, borderColor: isFailed ? '#ff163b' : 'rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 22 }}>{isFailed ? '×' : '♪'}</span>
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  {editingBatchId === songId && !isFailed ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => saveName(songId, editName)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(songId, editName);
                        if (e.key === 'Escape') setEditingBatchId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={editInputStyle}
                    />
                  ) : (
                    <div style={titleRowStyle}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title}
                      </span>
                      {isFailed && <span style={failedBadgeStyle}>生成异常，积分已退回</span>}
                      {!isFailed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBatchId(songId);
                            setEditName(title);
                          }}
                          style={iconButtonStyle}
                          title="重命名"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  )}

                  <div style={metaStyle}>{formatDate(batch.createdAt)}</div>
                  <div style={summaryStyle}>
                    {batch.promptSummary || batch.templateName || '未填写描述'}
                  </div>
                  {isFailed && (
                    <div style={failedMessageStyle}>
                      {batch.errorMessage || '生成过程中出现错误，请调整内容后重试。'}
                    </div>
                  )}
                </div>

                <div style={rowActionsStyle} onClick={(e) => e.stopPropagation()}>
                  {!isFailed && (
                    <span style={durationPillStyle}>{formatDuration(batch.durationSeconds || undefined)}</span>
                  )}
                  {!isFailed && (
                    <button type="button" onClick={() => onReCreate(songId)} style={smallActionStyle}>
                      重新创作
                    </button>
                  )}
                  {batch.canEditSong && batch.taskId && (
                    <>
                      {batch.hasStemCache && <span style={stemCacheBadgeStyle}>分轨已缓存</span>}
                      <Link
                        href={buildStemEditorHref(batch.taskId, batch.stemJobId)}
                        style={editSongLinkStyle}
                      >
                        编辑歌曲
                      </Link>
                    </>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('确定要删除这个创作吗？删除后无法恢复。')) {
                          onDelete(batch.batchId);
                        }
                      }}
                      style={{ ...smallActionStyle, color: '#ef4444' }}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {showDetail && expandedBatch && (
        <aside style={detailPanelStyle}>
          <div style={detailHeaderStyle}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f0' }}>
                {getBatchTitle(expandedBatch)}
              </div>
              <div style={{ fontSize: 12, color: '#8f96a3', marginTop: 4 }}>
                {formatDate(expandedBatch.createdAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onExpand(expandedBatch.taskId || expandedBatch.batchId, expandedBatch.batchId)}
              style={closeButtonStyle}
            >
              ×
            </button>
          </div>

          {expandedBatchDetail?.prompt && (
            <div style={promptBoxStyle}>{expandedBatchDetail.prompt}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(expandedVersions || []).map((version) => {
              const isSelected = version.status === 'selected';
              return (
                <div
                  key={version.taskId}
                  style={{
                    ...versionCardStyle,
                    borderColor: isSelected ? '#D4A574' : '#2f3540',
                  }}
                >
                  <div style={versionHeaderStyle}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f4f5' }}>
                        {version.title || `版本 ${version.versionNumber}`}
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={durationPillStyle}>{formatDuration(version.durationSeconds)}</span>
                        {isSelected && <span style={selectedBadgeStyle}>已选</span>}
                        {(version.styleTags || []).slice(0, 3).map((tag) => (
                          <span key={tag} style={tagStyle}>{tag}</span>
                        ))}
                        {version.hasStemCache && <span style={stemCacheBadgeStyle}>分轨已缓存</span>}
                      </div>
                    </div>
                    {version.audioUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownload(version.taskId)}
                        disabled={downloadingTaskId === version.taskId}
                        style={downloadButtonStyle}
                      >
                        {downloadingTaskId === version.taskId ? '下载中' : '下载'}
                      </button>
                    )}
                  </div>

                  {version.audioUrl ? (
                    <audio
                      ref={(el) => { if (el) audioRefs.current[version.taskId] = el; }}
                      controls
                      src={version.audioUrl}
                      onTimeUpdate={(e) =>
                        setAudioTimes((prev) => ({
                          ...prev,
                          [version.taskId]: (e.target as HTMLAudioElement).currentTime,
                        }))
                      }
                      onPlay={() => handleAudioPlay(version.taskId)}
                      onPause={() => {
                        if (playingTaskId === version.taskId) setPlayingTaskId(null);
                      }}
                      style={{ width: '100%', height: 36, marginTop: 12 }}
                    />
                  ) : (
                    <div style={{ marginTop: 12, color: '#8f96a3', fontSize: 13 }}>音频加载中...</div>
                  )}

                  {version.lyrics ? (
                    <div style={{ marginTop: 14 }}>
                      <SyncedLyrics
                        lyrics={version.lyrics}
                        currentTime={audioTimes[version.taskId] || 0}
                        isPlaying={playingTaskId === version.taskId}
                      />
                    </div>
                  ) : (
                    <div style={noLyricsStyle}>暂无歌词</div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
}

function buildStemEditorHref(taskId: string, stemJobId?: string | null) {
  const params = new URLSearchParams({ generationTaskId: taskId });
  if (stemJobId) params.set('jobId', stemJobId);
  return `/studio/stem-editor?${params.toString()}`;
}

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  padding: '80px 20px',
  color: '#6b7280',
  background: '#1b1f24',
  border: '1px solid #2f3540',
  borderRadius: 16,
};

const listPanelStyle: CSSProperties = {
  background: '#1b1f24',
  border: '1px solid #2f3540',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: '0 18px 50px rgba(0,0,0,0.24)',
};

const listHeaderStyle: CSSProperties = {
  height: 58,
  padding: '0 18px',
  borderBottom: '1px solid #2f3540',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const rowStyle: CSSProperties = {
  minHeight: 82,
  padding: '13px 18px',
  borderBottom: '1px solid #2a3038',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  transition: 'background 0.18s ease',
};

const coverStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 10,
  flexShrink: 0,
  background: 'linear-gradient(135deg, #2a2042, #1d2735)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#D4A574',
};

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: '#f4f4f5',
  fontSize: 14,
  fontWeight: 700,
  minWidth: 0,
};

const metaStyle: CSSProperties = {
  color: '#8f96a3',
  fontSize: 12,
  marginTop: 3,
};

const summaryStyle: CSSProperties = {
  color: '#8f96a3',
  fontSize: 12,
  marginTop: 3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
};

const durationPillStyle: CSSProperties = {
  borderRadius: 999,
  background: '#252a31',
  color: '#c2c8d0',
  padding: '4px 9px',
  fontSize: 12,
  lineHeight: 1,
};

const smallActionStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#d8dce3',
  fontSize: 12,
  cursor: 'pointer',
  padding: '4px 2px',
};

const editSongLinkStyle: CSSProperties = {
  border: '1px solid rgba(117, 54, 213, 0.42)',
  background: 'rgba(117, 54, 213, 0.16)',
  color: '#dccdff',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const stemCacheBadgeStyle: CSSProperties = {
  border: '1px solid rgba(34, 197, 94, 0.34)',
  background: 'rgba(34, 197, 94, 0.12)',
  color: '#86efac',
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const iconButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#7d8490',
  cursor: 'pointer',
  fontSize: 12,
  padding: 0,
};

const editInputStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#e8e8f0',
  background: '#11151a',
  border: '1px solid #D4A574',
  borderRadius: 6,
  padding: '4px 8px',
  outline: 'none',
  width: '100%',
  maxWidth: 360,
};

const detailPanelStyle: CSSProperties = {
  background: '#1b1f24',
  border: '1px solid #2f3540',
  borderRadius: 16,
  padding: 18,
  position: 'sticky',
  top: 24,
  maxHeight: '82vh',
  overflowY: 'auto',
  boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
};

const detailHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  paddingBottom: 14,
  borderBottom: '1px solid #2f3540',
  marginBottom: 14,
};

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#8f96a3',
  fontSize: 26,
  lineHeight: 1,
  cursor: 'pointer',
};

const promptBoxStyle: CSSProperties = {
  borderRadius: 10,
  background: '#14181d',
  border: '1px solid #2f3540',
  color: '#aeb6c2',
  fontSize: 12,
  lineHeight: 1.7,
  padding: 12,
  marginBottom: 14,
};

const versionCardStyle: CSSProperties = {
  border: '1px solid #2f3540',
  borderRadius: 14,
  padding: 14,
  background: '#161a20',
};

const versionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
};

const downloadButtonStyle: CSSProperties = {
  border: '1px solid #3a414c',
  background: '#20252d',
  color: '#d8dce3',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};

const selectedBadgeStyle: CSSProperties = {
  borderRadius: 999,
  background: 'rgba(212, 165, 116, 0.16)',
  color: '#D4A574',
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 700,
};

const tagStyle: CSSProperties = {
  borderRadius: 999,
  background: '#252a31',
  color: '#D4A574',
  padding: '3px 8px',
  fontSize: 11,
};

const noLyricsStyle: CSSProperties = {
  marginTop: 12,
  padding: '12px 0 0',
  color: '#737b86',
  fontSize: 12,
};

const failedBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '2px 8px',
  background: 'rgba(239, 68, 68, 0.14)',
  border: '1px solid rgba(239, 68, 68, 0.32)',
  color: '#fca5a5',
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const failedMessageStyle: CSSProperties = {
  marginTop: 6,
  color: '#fca5a5',
  fontSize: 12,
  lineHeight: 1.5,
};
