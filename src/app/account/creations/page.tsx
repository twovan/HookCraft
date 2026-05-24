'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HistoryList from '@/components/history/HistoryList';

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
  createdAt: string;
  canEditSong?: boolean;
  hasStemCache?: boolean;
  stemJobId?: string | null;
}

type TimeRange = '7d' | '30d' | 'all';
const PAGE_SIZE = 20;

export default function CreationsPage() {
  const router = useRouter();
  const [expandParam] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('expand');
    }
    return null;
  });
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('30d');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedBatchId, setExpandedBatchId] = useState<string | undefined>(undefined);
  const [expandedTaskId, setExpandedTaskId] = useState<string | undefined>(undefined);
  const [expandedVersions, setExpandedVersions] = useState<VersionDetail[] | undefined>(undefined);
  const [expandedBatchDetail, setExpandedBatchDetail] = useState<{ templateName?: string; prompt?: string } | undefined>(undefined);

  useEffect(() => {
    fetchBatches();
  }, [range, page]);

  // Auto-expand only when generation redirects back with an explicit batch id.
  useEffect(() => {
    if (batches.length > 0 && expandParam && !expandedBatchId) {
      const matched = batches.find((batch) => batch.batchId === expandParam || batch.taskId === expandParam);
      handleExpand(matched?.taskId || expandParam, matched?.batchId || expandParam);
    }
  }, [expandParam, batches, expandedBatchId]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/batches?range=${range}&page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Handle error
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

  const handleExpand = async (taskId: string, batchId?: string) => {
    const targetBatchId = batchId || batches.find((b) => b.taskId === taskId)?.batchId || taskId;
    if (expandedTaskId === taskId) {
      setExpandedBatchId(undefined);
      setExpandedTaskId(undefined);
      setExpandedVersions(undefined);
      setExpandedBatchDetail(undefined);
      return;
    }

    setExpandedBatchId(targetBatchId);
    setExpandedTaskId(taskId);
    try {
      const res = await fetch(`/api/batches/${targetBatchId}`);
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

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14' }}>
      {/* Background */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(117, 54, 213,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(117, 54, 213,0.03) 0%, transparent 50%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1420, margin: '0 auto', padding: '48px 32px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: '#e8e8f0',
            marginBottom: 8,
          }}>
            我的创作
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
            查看您的所有 AI 音乐创作记录
          </p>
        </div>

        {/* Time range filter */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
        }}>
          {rangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleRangeChange(opt.value)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: range === opt.value ? 'none' : '1px solid #2a2a40',
                background: range === opt.value
                  ? 'linear-gradient(135deg, #7536d5, #5a2db8)'
                  : 'white',
                color: range === opt.value ? 'white' : '#9ca3af',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999', fontSize: 14 }}>
            加载中...
          </div>
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
              <div style={{
                marginTop: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: '#9ca3af',
                fontSize: 13,
              }}>
                <span>{pageStart}-{pageEnd} / {total}</span>
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  style={{
                    ...paginationButtonStyle,
                    opacity: page <= 1 ? 0.45 : 1,
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  上一页
                </button>
                <span style={{
                  minWidth: 58,
                  textAlign: 'center',
                  color: '#e8e8f0',
                  fontWeight: 600,
                }}>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  style={{
                    ...paginationButtonStyle,
                    opacity: page >= totalPages ? 0.45 : 1,
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const paginationButtonStyle: React.CSSProperties = {
  border: '1px solid #2a2a40',
  background: '#1b1f24',
  color: '#e8e8f0',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};
