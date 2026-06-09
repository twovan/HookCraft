'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import SyncedLyrics from '@/components/studio/SyncedLyrics';
import { resolveDownloadErrorMessage } from '@/lib/download/downloadErrorMessage';

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
  stemCacheModes?: string[];
  stemJobId?: string | null;
  basicStemJobId?: string | null;
  proStemJobId?: string | null;
  stemEditSavedAt?: string | null;
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
  stemCacheModes?: string[];
  stemJobId?: string | null;
  basicStemJobId?: string | null;
  proStemJobId?: string | null;
  stemEditSavedAt?: string | null;
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
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
      // Keep the optimistic title; rename failures do not block playback.
    }
  };

  const handleDownload = async (taskId: string) => {
    setDownloadingTaskId(taskId);
    setDownloadError(null);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setDownloadError(resolveDownloadErrorMessage(payload, res.status));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creation-${taskId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('网络异常，下载请求没有发出或已中断，请稍后重试。');
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

  const formatEditSavedAt = (dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBatchTitle = (batch: BatchSummary) => {
    const songId = batch.taskId || batch.batchId;
    return batchNames[songId] || batch.title || batch.templateName || '未命名歌曲';
  };

  const getBatchSummary = (batch: BatchSummary) => {
    if (batch.templateName) return batch.templateName;
    return batch.promptSummary || '未填写描述';
  };

  if (batches.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={emptyMarkStyle}>作品库为空</div>
        <p style={{ fontSize: 15, margin: 0 }}>暂无创作记录</p>
        <span style={{ display: 'block', marginTop: 8, color: 'var(--hc-muted)', fontSize: 13 }}>
          生成完成后的作品会出现在这里。
        </span>
        <Link href="/studio" style={emptyActionStyle}>
          去工作台创作
        </Link>
      </div>
    );
  }

  return (
    <div className="history-list-grid" style={gridStyle(showDetail)}>
      <section style={listPanelStyle}>
        <div className="history-list-header" style={listHeaderStyle}>
          <div>
            <div style={{ color: 'var(--hc-text)', fontSize: 16, fontWeight: 900 }}>
              创作记录({batches.length})
            </div>
            <div style={{ color: 'var(--hc-muted)', fontSize: 12, marginTop: 3 }}>按生成时间排序</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={miniBadgeStyle}>最近记录</span>
            <span style={miniBadgeStyle}>点击查看详情</span>
          </div>
        </div>

        <div className="history-list-scroll" style={{ maxHeight: showDetail ? '76vh' : 'none', overflowY: showDetail ? 'auto' : 'visible' }}>
          {batches.map((batch) => {
            const songId = batch.taskId || batch.batchId;
            const isActive = expandedTaskId === songId;
            const isFailed = batch.status === 'failed';
            const title = getBatchTitle(batch);

            return (
              <article
                key={songId}
                onClick={() => !isFailed && onExpand(songId, batch.batchId)}
                className="history-row"
                style={{
                  ...rowStyle,
                  background: isActive ? 'rgba(206, 255, 53, 0.08)' : 'transparent',
                  borderColor: isActive ? 'rgba(206, 255, 53, 0.26)' : 'transparent',
                  cursor: isFailed ? 'default' : 'pointer',
                  opacity: isFailed ? 0.82 : 1,
                }}
              >
                <div style={{ ...coverStyle, borderColor: isFailed ? 'rgba(255, 90, 61, 0.5)' : 'rgba(206, 255, 53, 0.24)' }}>
                  <span>{isFailed ? '异常' : '作品'}</span>
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
                    <div className="history-title-row" style={titleRowStyle}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title}
                      </span>
                      {isFailed && <span style={failedBadgeStyle}>生成异常，额度已退回</span>}
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
                          重命名
                        </button>
                      )}
                    </div>
                  )}

                  <div style={metaStyle}>{formatDate(batch.createdAt)}</div>
                  <div style={summaryStyle}>
                    {batch.templateName ? `使用模版名称：${batch.templateName}` : getBatchSummary(batch)}
                  </div>
                  {isFailed && (
                    <div style={failedMessageStyle}>
                      {batch.errorMessage || '生成过程中出现错误，请调整内容后重试。'}
                    </div>
                  )}
                </div>

                <div className="history-row-actions" style={rowActionsStyle} onClick={(e) => e.stopPropagation()}>
                  {!isFailed && <span style={durationPillStyle}>{formatDuration(batch.durationSeconds || undefined)}</span>}
                  {!isFailed && (
                    <button type="button" onClick={() => onReCreate(songId)} style={smallActionStyle}>
                      重新创作
                    </button>
                  )}
                  {batch.canEditSong && batch.taskId && (
                    <>
                      {batch.hasStemCache && (
                        <span style={stemCacheBadgeStyle(resolveStemCacheBadgeTone(batch.stemCacheModes))}>
                          {formatStemCacheBadge(batch.stemCacheModes)}
                        </span>
                      )}
                      {batch.stemEditSavedAt && (
                        <span style={stemEditSavedBadgeStyle}>
                          最近保存 {formatEditSavedAt(batch.stemEditSavedAt)}
                        </span>
                      )}
                      <Link href={buildStemEditorHref(batch.taskId)} style={editSongLinkStyle}>
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
                      style={{ ...smallActionStyle, color: '#ff8b76' }}
                    >
                      删除
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {showDetail && expandedBatch && (
        <aside className="history-detail-panel" style={detailPanelStyle}>
          <div style={detailHeaderStyle}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--hc-text)' }}>
                {getBatchTitle(expandedBatch)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--hc-muted)', marginTop: 4 }}>
                {formatDate(expandedBatch.createdAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onExpand(expandedBatch.taskId || expandedBatch.batchId, expandedBatch.batchId)}
              style={closeButtonStyle}
              title="关闭详情"
            >
              ×
            </button>
          </div>

          {expandedBatchDetail?.prompt && !expandedBatchDetail.templateName && (
            <div style={promptBoxStyle}>{expandedBatchDetail.prompt}</div>
          )}

          {downloadError && (
            <div style={downloadErrorStyle} role="alert">
              {downloadError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(expandedVersions || []).map((version) => {
              const isSelected = version.status === 'selected';
              return (
                <div
                  key={version.taskId}
                  style={{
                    ...versionCardStyle,
                    borderColor: isSelected ? 'rgba(206, 255, 53, 0.42)' : 'var(--hc-line)',
                  }}
                >
                  <div style={versionHeaderStyle}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--hc-text)' }}>
                        {version.title || `版本 ${version.versionNumber}`}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={durationPillStyle}>{formatDuration(version.durationSeconds)}</span>
                        {isSelected && <span style={selectedBadgeStyle}>已选</span>}
                        {(version.styleTags || []).slice(0, 3).map((tag) => (
                          <span key={tag} style={tagStyle}>{tag}</span>
                        ))}
                        {version.hasStemCache && (
                          <span style={stemCacheBadgeStyle(resolveStemCacheBadgeTone(version.stemCacheModes))}>
                            {formatStemCacheBadge(version.stemCacheModes)}
                          </span>
                        )}
                        {version.stemEditSavedAt && (
                          <span style={stemEditSavedBadgeStyle}>
                            最近保存 {formatEditSavedAt(version.stemEditSavedAt)}
                          </span>
                        )}
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
                      ref={(el) => {
                        if (el) audioRefs.current[version.taskId] = el;
                      }}
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
                    <div style={{ marginTop: 12, color: 'var(--hc-muted)', fontSize: 13 }}>音频加载中...</div>
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
      <HistoryListStyles />
    </div>
  );
}

function buildStemEditorHref(taskId: string) {
  const params = new URLSearchParams({ generationTaskId: taskId });
  return `/studio/stem-editor?${params.toString()}`;
}

function formatStemCacheBadge(modes?: string[]) {
  const hasBasic = modes?.includes('basic') === true;
  const hasPro = modes?.includes('pro') === true;

  if (hasBasic && hasPro) return '基础+高级已缓存';
  if (hasBasic) return '基础分轨已缓存';
  if (hasPro) return '高级分轨已缓存';
  return '分轨已缓存';
}

function resolveStemCacheBadgeTone(modes?: string[]): 'basic' | 'pro' | 'both' | 'legacy' {
  const hasBasic = modes?.includes('basic') === true;
  const hasPro = modes?.includes('pro') === true;

  if (hasBasic && hasPro) return 'both';
  if (hasBasic) return 'basic';
  if (hasPro) return 'pro';
  return 'legacy';
}

const gridStyle = (showDetail: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: showDetail ? 'minmax(0, 1fr) minmax(360px, 420px)' : 'minmax(0, 1fr)',
  gap: 18,
  alignItems: 'start',
});

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  padding: '80px 20px',
  color: 'var(--hc-muted)',
  background: 'rgba(24, 26, 34, 0.86)',
  border: '1px solid var(--hc-line)',
  borderRadius: 'var(--hc-radius-lg)',
  boxShadow: 'var(--hc-shadow)',
};

const emptyMarkStyle: CSSProperties = {
  display: 'inline-flex',
  marginBottom: 12,
  border: '1px solid rgba(206, 255, 53, 0.28)',
  borderRadius: 999,
  padding: '6px 10px',
  color: 'var(--hc-lime)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '.08em',
};

const emptyActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 18,
  minHeight: 38,
  borderRadius: 999,
  padding: '0 16px',
  background: 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))',
  color: '#08090c',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 900,
};

const listPanelStyle: CSSProperties = {
  background: 'rgba(24, 26, 34, 0.88)',
  border: '1px solid var(--hc-line)',
  borderRadius: 'var(--hc-radius-lg)',
  overflow: 'hidden',
  boxShadow: 'var(--hc-shadow)',
};

const listHeaderStyle: CSSProperties = {
  minHeight: 64,
  padding: '14px 18px',
  borderBottom: '1px solid var(--hc-line)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
};

const miniBadgeStyle: CSSProperties = {
  border: '1px solid var(--hc-line)',
  background: 'rgba(255,255,255,.03)',
  color: 'var(--hc-muted)',
  borderRadius: 999,
  padding: '6px 9px',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const rowStyle: CSSProperties = {
  minHeight: 86,
  padding: '14px 18px',
  borderBottom: '1px solid rgba(255,255,255,.06)',
  borderLeft: '1px solid transparent',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  transition: 'background 0.18s ease, border-color 0.18s ease',
};

const coverStyle: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 12,
  flexShrink: 0,
  background: 'linear-gradient(135deg, rgba(206,255,53,.18), rgba(82,214,198,.10) 46%, rgba(255,90,61,.12))',
  border: '1px solid rgba(206,255,53,.24)',
  display: 'grid',
  placeItems: 'center',
  color: 'var(--hc-lime)',
};

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--hc-text)',
  fontSize: 14,
  fontWeight: 900,
  minWidth: 0,
};

const metaStyle: CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  marginTop: 4,
};

const summaryStyle: CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  marginTop: 4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rowActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const durationPillStyle: CSSProperties = {
  borderRadius: 999,
  background: 'rgba(255,255,255,.06)',
  border: '1px solid var(--hc-line)',
  color: 'var(--hc-text)',
  padding: '4px 9px',
  fontSize: 12,
  lineHeight: 1,
};

const smallActionStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--hc-text)',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  padding: '4px 2px',
};

const editSongLinkStyle: CSSProperties = {
  border: '1px solid rgba(206, 255, 53, 0.34)',
  background: 'rgba(206, 255, 53, 0.1)',
  color: 'var(--hc-lime)',
  borderRadius: 999,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

function stemCacheBadgeStyle(tone: 'basic' | 'pro' | 'both' | 'legacy'): CSSProperties {
  const palette = {
    basic: {
      border: 'rgba(72, 201, 255, 0.46)',
      background: 'linear-gradient(135deg, rgba(47, 129, 247, 0.16), rgba(82, 214, 198, 0.11))',
      color: '#8bdcff',
      shadow: '0 0 18px rgba(72, 201, 255, 0.12)',
    },
    pro: {
      border: 'rgba(206, 255, 53, 0.44)',
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(206, 255, 53, 0.12))',
      color: '#e7ff72',
      shadow: '0 0 18px rgba(206, 255, 53, 0.14)',
    },
    both: {
      border: 'rgba(142, 211, 255, 0.48)',
      background: 'linear-gradient(90deg, rgba(47, 129, 247, 0.18), rgba(82, 214, 198, 0.10) 46%, rgba(206, 255, 53, 0.16))',
      color: '#f0ffad',
      shadow: '0 0 20px rgba(82, 214, 198, 0.12), 0 0 18px rgba(206, 255, 53, 0.10)',
    },
    legacy: {
      border: 'rgba(82, 214, 198, 0.34)',
      background: 'rgba(82, 214, 198, 0.10)',
      color: 'var(--hc-cyan)',
      shadow: 'none',
    },
  }[tone];

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
    borderRadius: 999,
    padding: '4px 9px',
    fontSize: 11,
    fontWeight: 950,
    lineHeight: 1,
    letterSpacing: 0,
    whiteSpace: 'nowrap',
    boxShadow: palette.shadow,
  };
}

const stemEditSavedBadgeStyle: CSSProperties = {
  border: '1px solid rgba(206, 255, 53, 0.28)',
  background: 'rgba(206, 255, 53, 0.08)',
  color: 'var(--hc-lime)',
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const iconButtonStyle: CSSProperties = {
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--hc-muted)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 800,
  padding: '3px 5px',
};

const editInputStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: 'var(--hc-text)',
  background: '#0d0f14',
  border: '1px solid var(--hc-lime)',
  borderRadius: 8,
  padding: '6px 9px',
  outline: 'none',
  width: '100%',
  maxWidth: 360,
};

const detailPanelStyle: CSSProperties = {
  background: 'rgba(24, 26, 34, 0.9)',
  border: '1px solid var(--hc-line)',
  borderRadius: 'var(--hc-radius-lg)',
  padding: 18,
  position: 'sticky',
  top: 24,
  maxHeight: '82vh',
  overflowY: 'auto',
  boxShadow: 'var(--hc-shadow)',
};

const detailHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  paddingBottom: 14,
  borderBottom: '1px solid var(--hc-line)',
  marginBottom: 14,
};

const closeButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  border: '1px solid var(--hc-line)',
  borderRadius: 999,
  background: 'rgba(255,255,255,.04)',
  color: 'var(--hc-muted)',
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
};

const promptBoxStyle: CSSProperties = {
  borderRadius: 12,
  background: 'rgba(8, 9, 12, 0.54)',
  border: '1px solid var(--hc-line)',
  color: 'var(--hc-muted)',
  fontSize: 12,
  lineHeight: 1.7,
  padding: 12,
  marginBottom: 14,
};

const versionCardStyle: CSSProperties = {
  border: '1px solid var(--hc-line)',
  borderRadius: 14,
  padding: 14,
  background: 'rgba(8, 9, 12, 0.44)',
};

const versionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
};

const downloadButtonStyle: CSSProperties = {
  border: '1px solid var(--hc-line)',
  background: 'rgba(255,255,255,.05)',
  color: 'var(--hc-text)',
  borderRadius: 999,
  padding: '7px 11px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
};

const downloadErrorStyle: CSSProperties = {
  border: '1px solid rgba(255, 90, 61, 0.34)',
  borderRadius: 12,
  background: 'rgba(255, 90, 61, 0.1)',
  color: '#ffb09f',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.5,
  padding: '10px 12px',
  marginBottom: 14,
};

const selectedBadgeStyle: CSSProperties = {
  borderRadius: 999,
  background: 'rgba(206, 255, 53, 0.12)',
  border: '1px solid rgba(206, 255, 53, 0.3)',
  color: 'var(--hc-lime)',
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 900,
};

const tagStyle: CSSProperties = {
  borderRadius: 999,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid var(--hc-line)',
  color: 'var(--hc-muted)',
  padding: '3px 8px',
  fontSize: 11,
};

const noLyricsStyle: CSSProperties = {
  marginTop: 12,
  padding: '12px 0 0',
  color: 'var(--hc-muted)',
  fontSize: 12,
};

const failedBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '2px 8px',
  background: 'rgba(255, 90, 61, 0.12)',
  border: '1px solid rgba(255, 90, 61, 0.34)',
  color: '#ff8b76',
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const failedMessageStyle: CSSProperties = {
  marginTop: 6,
  color: '#ff8b76',
  fontSize: 12,
  lineHeight: 1.5,
};

function HistoryListStyles() {
  return (
    <style>{`
      @media (max-width: 920px) {
        .history-list-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .history-list-scroll {
          max-height: none !important;
          overflow: visible !important;
        }

        .history-detail-panel {
          position: static !important;
          max-height: none !important;
        }
      }

      @media (max-width: 720px) {
        .history-list-header {
          align-items: stretch !important;
          flex-direction: column !important;
        }

        .history-list-header > div:last-child {
          justify-content: flex-start !important;
        }

        .history-row {
          align-items: stretch !important;
          flex-direction: column !important;
          gap: 12px !important;
        }

        .history-row > div:nth-child(2) {
          width: 100% !important;
        }

        .history-title-row {
          align-items: flex-start !important;
          flex-wrap: wrap !important;
        }

        .history-title-row > span:first-child {
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .history-row-actions {
          justify-content: flex-start !important;
          width: 100% !important;
        }
      }
    `}</style>
  );
}
