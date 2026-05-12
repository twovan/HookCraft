'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import Tag from '@/components/admin/Tag';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface ReviewItem {
  id: string;
  name: string;
  description: string;
  submitter: string;
  type: string;
  submittedAt: string;
  category: string;
  genre_tags: string[];
}

interface ReviewStats {
  pending: number;
  todayReviewed: number;
  avgDuration: string;
}

export default function AdminReviewPage() {
  const [data, setData] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats>({ pending: 0, todayReviewed: 0, avgDuration: '-' });
  const [activeTab, setActiveTab] = useState<string>('');
  const pageSize = 10;

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approve' | 'reject'; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (activeTab) params.set('type', activeTab);

      const res = await fetch(`/api/admin/review?${params.toString()}`);
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      setData(result.data || []);
      setTotal(result.total || 0);
      if (result.stats) setStats(result.stats);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openConfirm(id: string, action: 'approve' | 'reject', name: string) {
    setConfirmAction({ id, action, name });
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!confirmAction) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/admin/review/${confirmAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmAction.action }),
      });
      if (!res.ok) throw new Error('操作失败');
      setConfirmOpen(false);
      setConfirmAction(null);
      fetchData();
    } catch {
      alert('操作失败，请重试');
    } finally {
      setConfirming(false);
    }
  }

  const columns: Column<ReviewItem>[] = [
    {
      key: 'name',
      title: '内容名称',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1f2937' }}>{row.name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{row.description?.slice(0, 40) || '无描述'}</div>
        </div>
      ),
    },
    {
      key: 'submitter',
      title: '提交者',
      render: (row) => <span>{row.submitter}</span>,
    },
    {
      key: 'type',
      title: '类型',
      render: (row) => (
        <Tag
          label={row.type === 'template' ? '模板上传' : 'AI 发布'}
          color={row.type === 'template' ? 'blue' : 'purple'}
        />
      ),
    },
    {
      key: 'submittedAt',
      title: '提交时间',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {row.submittedAt ? new Date(row.submittedAt).toLocaleString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...actionBtnStyle, color: '#2563eb' }}>试听</button>
          <button onClick={() => openConfirm(row.id, 'approve', row.name)} style={{ ...actionBtnStyle, color: '#16a34a' }}>通过</button>
          <button onClick={() => openConfirm(row.id, 'reject', row.name)} style={{ ...actionBtnStyle, color: '#dc2626' }}>拒绝</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="待审核" value={stats.pending} icon="📋" iconColor="orange" />
        <StatCard label="今日已审" value={stats.todayReviewed} icon="✅" iconColor="green" />
        <StatCard label="平均审核时长" value={stats.avgDuration} icon="⏱️" iconColor="blue" />
      </div>

      {/* Filter Tabs */}
      <div style={tabsContainerStyle}>
        <button
          onClick={() => { setActiveTab(''); setPage(1); }}
          style={{ ...tabStyle, ...(activeTab === '' ? activeTabStyle : {}) }}
        >
          全部
        </button>
        <button
          onClick={() => { setActiveTab('template'); setPage(1); }}
          style={{ ...tabStyle, ...(activeTab === 'template' ? activeTabStyle : {}) }}
        >
          模板上传
        </button>
        <button
          onClick={() => { setActiveTab('ai_publish'); setPage(1); }}
          style={{ ...tabStyle, ...(activeTab === 'ai_publish' ? activeTabStyle : {}) }}
        >
          AI 发布
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        loading={loading}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmAction?.action === 'approve' ? '确认通过' : '确认拒绝'}
        description={
          confirmAction?.action === 'approve'
            ? `确定要通过"${confirmAction?.name}"的审核吗？通过后内容将发布上线。`
            : `确定要拒绝"${confirmAction?.name}"吗？拒绝后提交者将收到通知。`
        }
        variant={confirmAction?.action === 'approve' ? 'info' : 'danger'}
        confirmLabel={confirmAction?.action === 'approve' ? '通过' : '拒绝'}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
        loading={confirming}
      />
    </div>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  marginBottom: 16,
};

const tabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '12px 20px',
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
  marginBottom: 16,
};

const tabStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: '#6b7280',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
};

const activeTabStyle: React.CSSProperties = {
  background: '#D4A574',
  color: '#fff',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  whiteSpace: 'nowrap',
};
