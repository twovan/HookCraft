'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HistoryList from '@/components/history/HistoryList';

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

type TimeRange = '7d' | '30d' | 'all';

export default function CreationsPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>('30d');
  const [expandedBatchId, setExpandedBatchId] = useState<string | undefined>(undefined);
  const [expandedVersions, setExpandedVersions] = useState<VersionDetail[] | undefined>(undefined);

  useEffect(() => {
    fetchBatches();
  }, [range]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/batches?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(undefined);
      setExpandedVersions(undefined);
      return;
    }

    setExpandedBatchId(batchId);
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedVersions(data.versions || []);
      }
    } catch {
      setExpandedVersions([]);
    }
  };

  const handleReCreate = (batchId: string) => {
    const batch = batches.find((b) => b.batchId === batchId);
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

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', padding: '48px 24px' }}>
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
              onClick={() => setRange(opt.value)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: range === opt.value ? 'none' : '1px solid #E5E5E5',
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
          <HistoryList
            batches={batches}
            onExpand={handleExpand}
            onReCreate={handleReCreate}
            expandedBatchId={expandedBatchId}
            expandedVersions={expandedVersions}
          />
        )}
      </div>
    </div>
  );
}
