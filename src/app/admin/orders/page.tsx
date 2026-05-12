'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';
import FormModal from '@/components/admin/FormModal';

interface OrderItem {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  type: string;
  productName: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface OrderStats {
  totalOrders: number;
  monthlyAmount: number;
  pendingRefunds: number;
  avgOrderValue: number;
}

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats>({ totalOrders: 0, monthlyAmount: 0, pendingRefunds: 0, avgOrderValue: 0 });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 10;

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
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
  }, [page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      setDetailData(result);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const filterConfigs: FilterConfig[] = [
    { key: 'search', type: 'search', placeholder: '搜索订单号/用户' },
    {
      key: 'type', type: 'select', placeholder: '订单类型',
      options: [
        { label: '模板购买', value: 'template' },
        { label: '会员订阅', value: 'membership' },
        { label: '积分包', value: 'credits_pack' },
      ],
    },
    {
      key: 'status', type: 'select', placeholder: '状态',
      options: [
        { label: '已完成', value: 'completed' },
        { label: '处理中', value: 'processing' },
        { label: '已退款', value: 'refunded' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
  ];

  const columns: Column<OrderItem>[] = [
    {
      key: 'orderNumber',
      title: '订单号',
      render: (row) => <span style={{ fontWeight: 500, fontSize: 12 }}>{row.orderNumber}</span>,
    },
    {
      key: 'userName',
      title: '用户',
      render: (row) => <span>{row.userName}</span>,
    },
    {
      key: 'type',
      title: '类型',
      render: (row) => {
        const typeMap: Record<string, { label: string; color: 'blue' | 'purple' | 'orange' }> = {
          template: { label: '模板购买', color: 'blue' },
          membership: { label: '会员订阅', color: 'purple' },
          credits_pack: { label: '积分包', color: 'orange' },
        };
        const t = typeMap[row.type] || { label: row.type, color: 'blue' as const };
        return <Tag label={t.label} color={t.color} />;
      },
    },
    {
      key: 'productName',
      title: '商品',
      render: (row) => <span style={{ fontSize: 12 }}>{row.productName}</span>,
    },
    {
      key: 'amount',
      title: '金额',
      render: (row) => <span style={{ fontWeight: 600 }}>¥{(row.amount / 100).toFixed(2)}</span>,
    },
    {
      key: 'paymentMethod',
      title: '支付方式',
      render: (row) => <span style={{ fontSize: 12 }}>{row.paymentMethod}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (row) => {
        const statusMap: Record<string, { label: string; color: 'green' | 'orange' | 'red' | 'gray' }> = {
          completed: { label: '已完成', color: 'green' },
          processing: { label: '处理中', color: 'orange' },
          refunded: { label: '已退款', color: 'red' },
          cancelled: { label: '已取消', color: 'gray' },
        };
        const s = statusMap[row.status] || { label: row.status, color: 'gray' as const };
        return <Tag label={s.label} color={s.color} />;
      },
    },
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
      key: 'actions',
      title: '操作',
      render: (row) => (
        <button onClick={() => openDetail(row.id)} style={actionBtnStyle}>详情</button>
      ),
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="总订单数" value={stats.totalOrders} icon="📦" iconColor="blue" />
        <StatCard label="月交易额" value={`¥${(stats.monthlyAmount / 100).toFixed(0)}`} icon="💰" iconColor="green" />
        <StatCard label="待退款" value={stats.pendingRefunds} icon="🔄" iconColor="orange" />
        <StatCard label="平均订单额" value={`¥${(stats.avgOrderValue / 100).toFixed(0)}`} icon="📊" iconColor="purple" />
      </div>

      {/* Filters */}
      <FilterBar
        filters={filterConfigs}
        values={filters}
        onChange={handleFilterChange}
        actions={
          <button
            onClick={() => window.open('/api/admin/orders/export', '_blank')}
            style={exportBtnStyle}
          >
            导出订单
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

      {/* Detail Modal */}
      <FormModal
        open={detailOpen}
        title="订单详情"
        onClose={() => { setDetailOpen(false); setDetailData(null); }}
        onSubmit={() => setDetailOpen(false)}
        submitLabel="关闭"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>加载中...</div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={detailGridStyle}>
              <div><span style={detailLabelStyle}>订单号:</span> {detailData.order.orderNumber}</div>
              <div><span style={detailLabelStyle}>用户ID:</span> {detailData.order.userId?.slice(0, 12)}...</div>
              <div><span style={detailLabelStyle}>类型:</span> {detailData.order.type}</div>
              <div><span style={detailLabelStyle}>商品:</span> {detailData.order.productName}</div>
              <div><span style={detailLabelStyle}>金额:</span> ¥{(detailData.order.amount / 100).toFixed(2)}</div>
              <div><span style={detailLabelStyle}>支付方式:</span> {detailData.order.paymentMethod}</div>
              <div><span style={detailLabelStyle}>状态:</span> {detailData.order.status}</div>
              <div><span style={detailLabelStyle}>创建时间:</span> {new Date(detailData.order.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>加载失败</div>
        )}
      </FormModal>
    </div>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
  marginBottom: 16,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  color: '#2563eb',
  whiteSpace: 'nowrap',
};

const exportBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  whiteSpace: 'nowrap',
};

const detailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  fontSize: 13,
  color: '#374151',
};

const detailLabelStyle: React.CSSProperties = {
  color: '#6b7280',
  fontWeight: 500,
};
