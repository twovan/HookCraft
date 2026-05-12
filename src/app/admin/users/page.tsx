'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormModal from '@/components/admin/FormModal';

interface UserItem {
  id: string;
  email: string;
  name: string;
  tier: string;
  status: string;
  registeredAt: string;
  purchaseCount: number;
  creditsUsed: number;
  creditsTotal: number;
}

interface UserStats {
  totalUsers: number;
  todayNew: number;
  activeUsers: number;
  paidUsers: number;
}

interface UserDetail {
  user: any;
  membership: any;
  credits: any;
  payments: any[];
  tasks: any[];
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({ totalUsers: 0, todayNew: 0, activeUsers: 0, paidUsers: 0 });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 10;

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; action: 'disable' | 'enable' } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await fetch(`/api/admin/users?${params.toString()}`);
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

  function openDisable(id: string, name: string, currentStatus: string) {
    const action = currentStatus === 'active' ? 'disable' : 'enable';
    setConfirmTarget({ id, name, action });
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/admin/users/${confirmTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmTarget.action }),
      });
      if (!res.ok) throw new Error('操作失败');
      setConfirmOpen(false);
      setConfirmTarget(null);
      fetchData();
    } catch {
      alert('操作失败，请重试');
    } finally {
      setConfirming(false);
    }
  }

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
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
    { key: 'search', type: 'search', placeholder: '搜索用户名/邮箱' },
    {
      key: 'tier', type: 'select', placeholder: '会员等级',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Pro', value: 'pro' },
        { label: 'Business', value: 'business' },
      ],
    },
    {
      key: 'status', type: 'select', placeholder: '状态',
      options: [
        { label: '正常', value: 'active' },
        { label: '已禁用', value: 'disabled' },
      ],
    },
  ];

  const tierMap: Record<string, { label: string; color: 'green' | 'blue' | 'purple' | 'gray' }> = {
    free: { label: 'Free', color: 'gray' },
    pro: { label: 'Pro', color: 'blue' },
    business: { label: 'Business', color: 'purple' },
  };

  const columns: Column<UserItem>[] = [
    {
      key: 'name',
      title: '用户',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1f2937' }}>{row.name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{row.id.slice(0, 8)}...</div>
        </div>
      ),
    },
    { key: 'email', title: '邮箱' },
    {
      key: 'tier',
      title: '会员等级',
      render: (row) => {
        const t = tierMap[row.tier] || tierMap.free;
        return <Tag label={t.label} color={t.color} />;
      },
    },
    {
      key: 'registeredAt',
      title: '注册时间',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {new Date(row.registeredAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'credits',
      title: 'AI 用量',
      render: (row) => (
        <span style={{ fontSize: 12 }}>
          {row.creditsUsed}/{row.creditsTotal}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (row) => (
        <Tag
          label={row.status === 'active' ? '正常' : '已禁用'}
          color={row.status === 'active' ? 'green' : 'red'}
        />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => openDetail(row.id)} style={{ ...actionBtnStyle, color: '#2563eb' }}>详情</button>
          <button
            onClick={() => openDisable(row.id, row.name, row.status)}
            style={{ ...actionBtnStyle, color: row.status === 'active' ? '#dc2626' : '#16a34a' }}
          >
            {row.status === 'active' ? '禁用' : '启用'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="总用户数" value={stats.totalUsers} icon="👥" iconColor="blue" />
        <StatCard label="今日新增" value={stats.todayNew} icon="🆕" iconColor="green" />
        <StatCard label="7日活跃" value={stats.activeUsers} icon="📈" iconColor="orange" />
        <StatCard label="付费用户" value={stats.paidUsers} icon="💎" iconColor="purple" />
      </div>

      {/* Filters */}
      <FilterBar
        filters={filterConfigs}
        values={filters}
        onChange={handleFilterChange}
        actions={
          <button
            onClick={() => window.open('/api/admin/users/export', '_blank')}
            style={exportBtnStyle}
          >
            导出数据
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTarget?.action === 'disable' ? '确认禁用用户' : '确认启用用户'}
        description={
          confirmTarget?.action === 'disable'
            ? `确定要禁用用户"${confirmTarget?.name}"吗？禁用后该用户将无法登录。`
            : `确定要启用用户"${confirmTarget?.name}"吗？`
        }
        variant={confirmTarget?.action === 'disable' ? 'danger' : 'info'}
        confirmLabel={confirmTarget?.action === 'disable' ? '禁用' : '启用'}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        loading={confirming}
      />

      {/* Detail Modal */}
      <FormModal
        open={detailOpen}
        title="用户详情"
        onClose={() => { setDetailOpen(false); setDetailData(null); }}
        onSubmit={() => setDetailOpen(false)}
        submitLabel="关闭"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>加载中...</div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h4 style={sectionTitleStyle}>基本信息</h4>
              <div style={infoGridStyle}>
                <div><span style={infoLabelStyle}>邮箱:</span> {detailData.user.email}</div>
                <div><span style={infoLabelStyle}>昵称:</span> {detailData.user.name}</div>
                <div><span style={infoLabelStyle}>注册时间:</span> {new Date(detailData.user.registeredAt).toLocaleString('zh-CN')}</div>
                <div><span style={infoLabelStyle}>最后登录:</span> {detailData.user.lastSignIn ? new Date(detailData.user.lastSignIn).toLocaleString('zh-CN') : '-'}</div>
              </div>
            </div>
            <div>
              <h4 style={sectionTitleStyle}>会员信息</h4>
              <div style={infoGridStyle}>
                <div><span style={infoLabelStyle}>等级:</span> {detailData.membership?.tier || 'free'}</div>
                <div><span style={infoLabelStyle}>状态:</span> {detailData.membership?.status || '-'}</div>
              </div>
            </div>
            <div>
              <h4 style={sectionTitleStyle}>积分信息</h4>
              <div style={infoGridStyle}>
                <div><span style={infoLabelStyle}>已用:</span> {detailData.credits?.monthly_used || 0}</div>
                <div><span style={infoLabelStyle}>总额:</span> {detailData.credits?.monthly_limit || 0}</div>
              </div>
            </div>
            {detailData.payments.length > 0 && (
              <div>
                <h4 style={sectionTitleStyle}>最近购买</h4>
                {detailData.payments.slice(0, 5).map((p: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    {new Date(p.created_at).toLocaleDateString('zh-CN')} - ¥{(p.amount / 100).toFixed(2)} - {p.status}
                  </div>
                ))}
              </div>
            )}
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

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#1f2937',
  margin: '0 0 8px 0',
};

const infoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  fontSize: 13,
  color: '#374151',
};

const infoLabelStyle: React.CSSProperties = {
  color: '#6b7280',
  fontWeight: 500,
};
