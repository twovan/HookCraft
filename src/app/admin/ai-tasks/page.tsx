'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';

interface TaskItem {
  id: string;
  userId: string;
  userName: string;
  styleTag: string;
  duration: number;
  status: string;
  elapsedTime: number;
  createdAt: string;
}

interface TaskStats {
  dailyCredits: number;
  activeTasks: number;
  successRate: number;
  avgDuration: number;
}

interface StyleItem {
  style: string;
  count: number;
  percentage: number;
}

interface FailureItem {
  reason: string;
  count: number;
  percentage: number;
}

export default function AdminAITasksPage() {
  const [data, setData] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TaskStats>({ dailyCredits: 0, activeTasks: 0, successRate: 100, avgDuration: 0 });
  const [popularStyles, setPopularStyles] = useState<StyleItem[]>([]);
  const [failureReasons, setFailureReasons] = useState<FailureItem[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await fetch(`/api/admin/ai-tasks?${params.toString()}`);
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      setData(result.data || []);
      setTotal(result.total || 0);
      if (result.stats) setStats(result.stats);
      setPopularStyles(result.popularStyles || []);
      setFailureReasons(result.failureReasons || []);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const filterConfigs: FilterConfig[] = [
    {
      key: 'status', type: 'select', placeholder: '任务状态',
      options: [
        { label: '生成中', value: 'generating' },
        { label: '已完成', value: 'completed' },
        { label: '失败', value: 'failed' },
        { label: '等待中', value: 'pending' },
      ],
    },
  ];

  const columns: Column<TaskItem>[] = [
    {
      key: 'id',
      title: '任务ID',
      render: (row) => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{row.id.slice(0, 8)}...</span>,
    },
    { key: 'userName', title: '用户' },
    { key: 'styleTag', title: '风格/种子' },
    {
      key: 'duration',
      title: '时长',
      render: (row) => <span>{row.duration}s</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (row) => {
        const statusMap: Record<string, { label: string; color: 'green' | 'orange' | 'red' | 'blue' | 'gray' }> = {
          completed: { label: '已完成', color: 'green' },
          generating: { label: '生成中', color: 'blue' },
          failed: { label: '失败', color: 'red' },
          pending: { label: '等待中', color: 'orange' },
        };
        const s = statusMap[row.status] || { label: row.status, color: 'gray' as const };
        return (
          <span style={row.status === 'generating' ? pulsingStyle : undefined}>
            <Tag label={s.label} color={s.color} />
          </span>
        );
      },
    },
    {
      key: 'elapsedTime',
      title: '耗时',
      render: (row) => <span>{row.elapsedTime > 0 ? `${row.elapsedTime}s` : '-'}</span>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {new Date(row.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Stats */}
        <div style={statsGridStyle}>
          <StatCard label="今日消耗积分" value={stats.dailyCredits} icon="🔥" iconColor="orange" />
          <StatCard label="正在生成" value={stats.activeTasks} icon="⚡" iconColor="blue" />
          <StatCard label="成功率" value={`${stats.successRate}%`} icon="✅" iconColor="green" />
          <StatCard label="平均耗时" value={`${stats.avgDuration}s`} icon="⏱️" iconColor="purple" />
        </div>

        {/* Filters */}
        <FilterBar filters={filterConfigs} values={filters} onChange={handleFilterChange} />

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
      </div>

      {/* Right sidebar */}
      <div style={{ width: 280, flexShrink: 0 }}>
        {/* Popular Styles */}
        <div style={sidebarCardStyle}>
          <h4 style={sidebarTitleStyle}>🎵 热门风格</h4>
          {popularStyles.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>暂无数据</div>
          ) : (
            popularStyles.map((s, i) => (
              <div key={i} style={sidebarItemStyle}>
                <span style={{ fontSize: 13, color: '#374151' }}>{s.style}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{s.count}次</span>
                  <span style={{ fontSize: 11, color: '#D4A574', fontWeight: 600 }}>{s.percentage}%</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Failure Reasons */}
        <div style={{ ...sidebarCardStyle, marginTop: 16 }}>
          <h4 style={sidebarTitleStyle}>⚠️ 失败原因统计</h4>
          {failureReasons.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>暂无失败记录</div>
          ) : (
            failureReasons.map((f, i) => (
              <div key={i} style={sidebarItemStyle}>
                <span style={{ fontSize: 12, color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.reason}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{f.count}</span>
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{f.percentage}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
  marginBottom: 16,
};

const sidebarCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
};

const sidebarTitleStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 14,
  fontWeight: 600,
  color: '#1f2937',
};

const sidebarItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid #f3f4f6',
};

const pulsingStyle: React.CSSProperties = {
  display: 'inline-block',
  animation: 'pulse 2s ease-in-out infinite',
};
