'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import HistoryList from '@/components/history/HistoryList';
import { buildCreationsFetchKey } from '@/lib/history/creationsRefresh';

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
  createdAt: string;
  canEditSong?: boolean;
  hasStemCache?: boolean;
  stemCacheModes?: string[];
  stemJobId?: string | null;
  basicStemJobId?: string | null;
  proStemJobId?: string | null;
  stemEditSavedAt?: string | null;
}

type TimeRange = '7d' | '30d' | 'all';
const PAGE_SIZE = 20;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function CreationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const lastFetchKeyRef = useRef<string | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [expandParam] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('expand');
    }
    return null;
  });
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>('30d');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedBatchId, setExpandedBatchId] = useState<string | undefined>(undefined);
  const [expandedTaskId, setExpandedTaskId] = useState<string | undefined>(undefined);
  const [expandedVersions, setExpandedVersions] = useState<VersionDetail[] | undefined>(undefined);
  const [expandedBatchDetail, setExpandedBatchDetail] = useState<{ templateName?: string; prompt?: string } | undefined>(undefined);

  useEffect(() => {
    if (!authLoading) {
      setAuthTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthTimedOut(true), 1800);
    return () => window.clearTimeout(timer);
  }, [authLoading]);

  useEffect(() => {
    if (authLoading && !authTimedOut) return;
    if (!userId) {
      router.replace('/login?redirectTo=/account/creations');
      return;
    }
    fetchBatches();
  }, [authLoading, authTimedOut, userId, range, page, router]);

  useEffect(() => {
    if (!userId) return;
    if (batches.length > 0 && expandParam && !expandedBatchId) {
      const matched = batches.find((batch) => batch.batchId === expandParam || batch.taskId === expandParam);
      handleExpand(matched?.taskId || expandParam, matched?.batchId || expandParam);
    }
  }, [expandParam, batches, expandedBatchId, userId]);

  const fetchBatches = async (options?: { force?: boolean }) => {
    const fetchKey = buildCreationsFetchKey(userId, range, page);
    if (!fetchKey) return;
    if (!options?.force && lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetchWithTimeout(`/api/batches?range=${range}&page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
        setTotal(data.total || 0);
      } else {
        setBatches([]);
        setTotal(0);
        setFetchError('创作记录暂时无法同步，请稍后重试。');
      }
    } catch {
      setBatches([]);
      setTotal(0);
      setFetchError('网络连接不稳定，创作记录同步失败。');
    } finally {
      setLoading(false);
    }
  };

  const closeExpandedDetail = () => {
    setExpandedBatchId(undefined);
    setExpandedTaskId(undefined);
    setExpandedVersions(undefined);
    setExpandedBatchDetail(undefined);
  };

  const handleRangeChange = (nextRange: TimeRange) => {
    setRange(nextRange);
    setPage(1);
    closeExpandedDetail();
  };

  const handlePageChange = (nextPage: number) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const boundedPage = Math.min(Math.max(1, nextPage), totalPages);
    if (boundedPage === page) return;
    setPage(boundedPage);
    closeExpandedDetail();
  };

  const fetchExpandedDetail = async (taskId: string, batchId: string) => {
    try {
      const res = await fetchWithTimeout(`/api/batches/${batchId}`);
      if (res.ok) {
        const data = await res.json();
        const versions = data.versions || [];
        setExpandedVersions(versions.filter((version: VersionDetail) => version.taskId === taskId));
        setExpandedBatchDetail({
          templateName: data.batch?.templateName,
          prompt: data.batch?.promptSummary,
        });
      }
    } catch {
      setExpandedVersions([]);
      setExpandedBatchDetail(undefined);
    }
  };

  const handleExpand = async (taskId: string, batchId?: string) => {
    const targetBatchId = batchId || batches.find((b) => b.taskId === taskId)?.batchId || taskId;
    if (expandedTaskId === taskId) {
      closeExpandedDetail();
      return;
    }

    setExpandedBatchId(targetBatchId);
    setExpandedTaskId(taskId);
    await fetchExpandedDetail(taskId, targetBatchId);
  };

  useEffect(() => {
    if (!expandedBatchId || !expandedTaskId || !expandedVersions) return;

    const needsAudioRefresh = expandedVersions.some((version) =>
      !version.audioUrl && version.status !== 'failed'
    );
    if (!needsAudioRefresh) return;

    const timer = window.setInterval(() => {
      void fetchExpandedDetail(expandedTaskId, expandedBatchId);
      void fetchBatches({ force: true });
    }, 6000);

    return () => window.clearInterval(timer);
  }, [expandedBatchId, expandedTaskId, expandedVersions]);

  const handleReCreate = (taskId: string) => {
    const batch = batches.find((b) => b.taskId === taskId || b.batchId === taskId);
    if (batch) {
      const params = new URLSearchParams();
      if (batch.promptSummary) params.set('prompt', batch.promptSummary);
      router.push(`/studio?${params.toString()}`);
    } else {
      router.push('/studio');
    }
  };

  const rangeOptions: { value: TimeRange; label: string }[] = [
    { value: '7d', label: '7天' },
    { value: '30d', label: '30天' },
    { value: 'all', label: '全部' },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  if ((authLoading && !authTimedOut) || !user) {
    return (
      <main className="creations-page">
        <div className="creations-shell">
          <div className="loading-panel">
            <span>正在确认登录状态...</span>
            <div />
          </div>
        </div>
        <CreationsStyles />
      </main>
    );
  }

  return (
    <main className="creations-page">
      <div className="creations-shell">
        <header className="creations-header">
          <div>
            <span>创作档案</span>
            <h1>我的创作</h1>
            <p>查看、试听、重命名、下载或继续编辑你的 AI 音乐作品。</p>
          </div>
          <button type="button" className="hc-button hc-button-primary" onClick={() => router.push('/studio')}>
            新建创作
          </button>
        </header>

        <section className="creations-toolbar" aria-label="创作记录筛选">
          <div className="range-tabs">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRangeChange(opt.value)}
                className={range === opt.value ? 'active' : ''}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="summary-pill">
            {total > 0 ? `${pageStart}-${pageEnd} / ${total}` : '暂无记录'}
          </div>
        </section>

        {loading ? (
          <div className="loading-panel">
            <span>正在同步创作记录...</span>
            <div />
          </div>
        ) : fetchError ? (
          <section className="error-panel" aria-live="polite">
            <strong>同步失败</strong>
            <p>{fetchError}</p>
            <button type="button" className="hc-button hc-button-secondary" onClick={() => fetchBatches({ force: true })}>
              重新同步
            </button>
          </section>
        ) : (
          <>
            <HistoryList
              batches={batches}
              onExpand={handleExpand}
              onReCreate={handleReCreate}
              expandedBatchId={expandedBatchId}
              expandedTaskId={expandedTaskId}
              expandedVersions={expandedVersions}
              expandedBatchDetail={expandedBatchDetail}
            />
            {total > PAGE_SIZE && (
              <nav className="pagination" aria-label="创作记录分页">
                <button type="button" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                  上一页
                </button>
                <span>{page} / {totalPages}</span>
                <button type="button" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                  下一页
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      <CreationsStyles />
    </main>
  );
}

function CreationsStyles() {
  return (
    <style>{`
        .creations-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 12% 12%, rgba(206, 255, 53, 0.10), transparent 300px),
            radial-gradient(circle at 88% 24%, rgba(82, 214, 198, 0.08), transparent 340px),
            var(--hc-bg);
          color: var(--hc-text);
          padding: 42px 22px 72px;
        }

        .creations-shell {
          max-width: 1420px;
          margin: 0 auto;
        }

        .creations-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
          margin-bottom: 24px;
        }

        .creations-header span {
          color: var(--hc-lime);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .creations-header h1 {
          margin: 8px 0 8px;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1;
          letter-spacing: 0;
        }

        .creations-header p {
          margin: 0;
          color: var(--hc-muted);
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .creations-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
          border: 1px solid var(--hc-line);
          background: rgba(24, 26, 34, 0.72);
          border-radius: var(--hc-radius);
          padding: 10px;
        }

        .range-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .range-tabs button,
        .pagination button {
          border: 1px solid transparent;
          background: transparent;
          color: var(--hc-muted);
          border-radius: 999px;
          padding: 9px 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background .2s ease, color .2s ease, border-color .2s ease;
        }

        .range-tabs button.active {
          border-color: rgba(206, 255, 53, 0.36);
          background: rgba(206, 255, 53, 0.12);
          color: var(--hc-lime);
        }

        .summary-pill {
          color: var(--hc-muted);
          border: 1px solid var(--hc-line);
          background: rgba(255,255,255,.03);
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .loading-panel {
          border: 1px solid var(--hc-line);
          background: rgba(24, 26, 34, 0.86);
          border-radius: var(--hc-radius-lg);
          padding: 46px 26px;
          color: var(--hc-muted);
          text-align: center;
          box-shadow: var(--hc-shadow);
        }

        .loading-panel div {
          width: min(360px, 100%);
          height: 4px;
          margin: 18px auto 0;
          overflow: hidden;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,.08), var(--hc-lime), var(--hc-cyan), rgba(255,255,255,.08));
          background-size: 240% 100%;
          animation: creations-load 1.1s ease-in-out infinite alternate;
        }

        .error-panel {
          border: 1px solid rgba(255, 90, 61, 0.34);
          background: rgba(255, 90, 61, 0.08);
          border-radius: var(--hc-radius-lg);
          padding: 28px;
          color: var(--hc-text);
          box-shadow: var(--hc-shadow);
        }

        .error-panel strong {
          display: block;
          color: #ff9b87;
          font-size: 18px;
          margin-bottom: 8px;
        }

        .error-panel p {
          margin: 0 0 18px;
          color: var(--hc-muted);
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 18px;
          color: var(--hc-muted);
          font-size: 13px;
        }

        .pagination span {
          min-width: 58px;
          text-align: center;
          color: var(--hc-text);
          font-weight: 900;
        }

        .pagination button {
          border-color: var(--hc-line);
          background: rgba(24, 26, 34, 0.86);
          color: var(--hc-text);
        }

        .pagination button:disabled {
          cursor: not-allowed;
          opacity: .45;
        }

        @keyframes creations-load {
          from { background-position: 0% 50%; }
          to { background-position: 100% 50%; }
        }

        @media (max-width: 720px) {
          .creations-page {
            padding: 28px 14px 56px;
          }

          .creations-header,
          .creations-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .creations-header .hc-button,
          .summary-pill {
            width: 100%;
          }

          .range-tabs {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            width: 100%;
          }

          .range-tabs button {
            padding-inline: 10px;
          }

          .summary-pill {
            text-align: center;
          }
        }
      `}</style>
  );
}
