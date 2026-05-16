'use client';

import { useState, useEffect, useCallback } from 'react';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';

interface LogItem {
  id: string;
  operatorName: string;
  operationType: string;
  operationDescription: string;
  targetType: string;
  targetId: string;
  ipAddress: string;
  createdAt: string;
}

export default function AdminLogsPage() {
  const [data, setData] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      setData(result.data || []);
      setTotal(result.total || 0);
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
      key: 'type', type: 'select', placeholder: '操作类型',
      options: [
        { label: '用户操作', value: 'user' },
        { label: '内容管理', value: 'content' },
        { label: '交易操作', value: 'transaction' },
        { label: '系统操作', value: 'system' },
        { label: 'AI 操作', value: 'ai' },
      ],
    },
    { key: 'operator', type: 'search', placeholder: '搜索操作人' },
  ];

  const typeColorMap: Record<string, { label: string; color: 'blue' | 'green' | 'orange' | 'purple' | 'red' }> = {
    user: { label: '用户', color: 'blue' },
    content: { label: '内容', color: 'green' },
    transaction: { label: '交易', color: 'orange' },
    system: { label: '系统', color: 'purple' },
    ai: { label: 'AI', color: 'red' },
  };

  const columns: Column<LogItem>[] = [
    {
      key: 'createdAt',
      title: '时间',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {new Date(row.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'operatorName',
      title: '操作人',
      render: (row) => <span style={{ fontWeight: 500 }}>{row.operatorName}</span>,
    },
    {
      key: 'operationType',
      title: '类型',
      render: (row) => {
        const t = typeColorMap[row.operationType] || { label: row.operationType, color: 'gray' as const };
        return <Tag label={t.label} color={t.color} />;
      },
    },
    {
      key: 'operationDescription',
      title: '操作描述',
      render: (row) => <span style={{ fontSize: 13 }}>{row.operationDescription}</span>,
    },
    {
      key: 'target',
      title: '目标对象',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {row.targetType ? `${row.targetType}:${row.targetId?.slice(0, 8) || ''}` : '-'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      title: 'IP 地址',
      render: (row) => <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{row.ipAddress || '-'}</span>,
    },
  ];

  return (
    <div>
      {/* Filters */}
      <FilterBar
        filters={filterConfigs}
        values={filters}
        onChange={handleFilterChange}
        actions={
          <button
            onClick={() => {
              const params = new URLSearchParams();
              Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
              window.open(`/api/admin/logs/export?${params.toString()}`, '_blank');
            }}
            style={exportBtnStyle}
          >
            导出日志
          </button>
        }
      />

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
  );
}

const exportBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  whiteSpace: 'nowrap',
};
