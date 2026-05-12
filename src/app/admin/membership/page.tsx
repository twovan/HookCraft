'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  tier: string;
  billingCycle: string;
  startDate: string;
  expiryDate: string;
  autoRenew: boolean;
  status: string;
}

interface MembershipStats {
  totalPaid: number;
  proCount: number;
  businessCount: number;
  monthlyRevenue: number;
}

export default function AdminMembershipPage() {
  const [data, setData] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MembershipStats>({ totalPaid: 0, proCount: 0, businessCount: 0, monthlyRevenue: 0 });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await fetch(`/api/admin/membership?${params.toString()}`);
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

  const filterConfigs: FilterConfig[] = [
    {
      key: 'tier', type: 'select', placeholder: '会员等级',
      options: [
        { label: 'Pro', value: 'pro' },
        { label: 'Business', value: 'business' },
      ],
    },
    {
      key: 'status', type: 'select', placeholder: '状态',
      options: [
        { label: '活跃', value: 'active' },
        { label: '即将到期', value: 'expiring' },
        { label: '已过期', value: 'expired' },
      ],
    },
  ];

  const tierConfigs = [
    { tier: 'Free', price: '¥0/月', features: ['每月 3 次生成', '基础模板', '标准音质'], color: '#6b7280' },
    { tier: 'Pro', price: '¥99/月', features: ['每月 50 次生成', '全部模板', '高清音质', '商用授权'], color: '#3b82f6' },
    { tier: 'Business', price: '¥299/月', features: ['无限生成', '全部模板', '无损音质', '商用授权', '优先支持'], color: '#8b5cf6' },
  ];

  const columns: Column<Member>[] = [
    {
      key: 'name',
      title: '用户',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1f2937' }}>{row.name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{row.email}</div>
        </div>
      ),
    },
    {
      key: 'tier',
      title: '等级',
      render: (row) => (
        <Tag label={row.tier === 'pro' ? 'Pro' : 'Business'} color={row.tier === 'pro' ? 'blue' : 'purple'} />
      ),
    },
    {
      key: 'billingCycle',
      title: '计费周期',
      render: (row) => <span>{row.billingCycle === 'yearly' ? '年付' : '月付'}</span>,
    },
    {
      key: 'startDate',
      title: '开始日期',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {row.startDate ? new Date(row.startDate).toLocaleDateString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'expiryDate',
      title: '到期日期',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'autoRenew',
      title: '自动续费',
      render: (row) => (
        <Tag label={row.autoRenew ? '是' : '否'} color={row.autoRenew ? 'green' : 'gray'} />
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (row) => {
        const statusMap: Record<string, { label: string; color: 'green' | 'orange' | 'red' | 'gray' }> = {
          active: { label: '活跃', color: 'green' },
          expiring: { label: '即将到期', color: 'orange' },
          expired: { label: '已过期', color: 'red' },
        };
        const s = statusMap[row.status] || { label: row.status, color: 'gray' as const };
        return <Tag label={s.label} color={s.color} />;
      },
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="付费会员总数" value={stats.totalPaid} icon="💎" iconColor="blue" />
        <StatCard label="Pro 会员" value={stats.proCount} icon="⭐" iconColor="green" />
        <StatCard label="Business 会员" value={stats.businessCount} icon="🏢" iconColor="purple" />
        <StatCard label="月度会员收入" value={`¥${(stats.monthlyRevenue / 100).toFixed(0)}`} icon="💰" iconColor="orange" />
      </div>

      {/* Tier Configuration Cards */}
      <div style={tierGridStyle}>
        {tierConfigs.map((tc) => (
          <div key={tc.tier} style={tierCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: tc.color }}>{tc.tier}</h4>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{tc.price}</span>
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#6b7280', lineHeight: 2 }}>
              {tc.features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        ))}
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
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
  marginBottom: 16,
};

const tierGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  marginBottom: 16,
};

const tierCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
};
