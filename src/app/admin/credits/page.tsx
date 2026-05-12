'use client';

import { useState, useEffect } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import Tag from '@/components/admin/Tag';

interface CreditsStats {
  totalIssued: number;
  totalConsumed: number;
  consumptionRate: number;
  exhaustedCount: number;
  daysUntilReset: number;
}

interface TierBreakdown {
  tier: string;
  users: number;
  monthlyQuota: number;
  totalIssued: number;
  totalConsumed: number;
  avgUsage: number;
  consumptionRate: number;
}

interface ExhaustedUser {
  userId: string;
  userName: string;
  email: string;
  tier: string;
  creditsUsed: number;
  creditsTotal: number;
  exhaustedAt: string;
}

export default function AdminCreditsPage() {
  const [stats, setStats] = useState<CreditsStats>({ totalIssued: 0, totalConsumed: 0, consumptionRate: 0, exhaustedCount: 0, daysUntilReset: 0 });
  const [tierBreakdown, setTierBreakdown] = useState<TierBreakdown[]>([]);
  const [exhaustedUsers, setExhaustedUsers] = useState<ExhaustedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/credits');
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      setStats(result.stats);
      setTierBreakdown(result.tierBreakdown || []);
      setExhaustedUsers(result.exhaustedUsers || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const tierLabels: Record<string, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
  };

  const exhaustedColumns: Column<ExhaustedUser>[] = [
    {
      key: 'userName',
      title: '用户',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1f2937' }}>{row.userName}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{row.email || row.userId.slice(0, 12)}</div>
        </div>
      ),
    },
    {
      key: 'tier',
      title: '等级',
      render: (row) => {
        const colorMap: Record<string, 'gray' | 'blue' | 'purple'> = { free: 'gray', pro: 'blue', business: 'purple' };
        return <Tag label={tierLabels[row.tier] || row.tier} color={colorMap[row.tier] || 'gray'} />;
      },
    },
    {
      key: 'credits',
      title: '积分使用',
      render: (row) => (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {row.creditsUsed}/{row.creditsTotal}
        </span>
      ),
    },
    {
      key: 'exhaustedAt',
      title: '耗尽日期',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {row.exhaustedAt ? new Date(row.exhaustedAt).toLocaleDateString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: () => (
        <button style={actionBtnStyle}>发送升级邀请</button>
      ),
    },
  ];

  if (loading) {
    return <div style={{ padding: 24, color: '#6b7280' }}>加载中...</div>;
  }

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="月度总配额" value={stats.totalIssued} icon="📊" iconColor="blue" />
        <StatCard label="已消耗" value={`${stats.totalConsumed} (${stats.consumptionRate}%)`} icon="🔥" iconColor="orange" />
        <StatCard label="已耗尽用户" value={stats.exhaustedCount} icon="⚠️" iconColor="red" />
        <StatCard label="距下次重置" value={`${stats.daysUntilReset}天`} icon="🔄" iconColor="green" />
      </div>

      {/* Tier Usage Overview */}
      <div style={tierCardStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>等级用量概览</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tierBreakdown.map((tier) => (
            <div key={tier.tier} style={tierRowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 120 }}>
                <Tag label={tierLabels[tier.tier] || tier.tier} color={tier.tier === 'free' ? 'gray' : tier.tier === 'pro' ? 'blue' : 'purple'} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>{tier.users} 用户</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 12, color: '#6b7280', minWidth: 80 }}>
                  配额: {tier.monthlyQuota}/月
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', minWidth: 120 }}>
                  {tier.totalConsumed}/{tier.totalIssued}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', minWidth: 80 }}>
                  人均: {tier.avgUsage}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={progressBarBgStyle}>
                    <div style={{ ...progressBarFillStyle, width: `${Math.min(tier.consumptionRate, 100)}%` }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tier.consumptionRate > 80 ? '#ef4444' : '#D4A574', minWidth: 36 }}>
                    {tier.consumptionRate}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Consumption Trend (placeholder) */}
      <div style={{ ...tierCardStyle, marginTop: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>每日消耗趋势</h3>
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
          📈 趋势图表（数据加载中...）
        </div>
      </div>

      {/* Exhausted Users */}
      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>已耗尽积分用户</h3>
        <DataTable
          columns={exhaustedColumns}
          data={exhaustedUsers}
          total={exhaustedUsers.length}
          page={1}
          pageSize={20}
          onPageChange={() => {}}
          loading={false}
        />
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

const tierCardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
};

const tierRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '12px 0',
  borderBottom: '1px solid #f3f4f6',
};

const progressBarBgStyle: React.CSSProperties = {
  flex: 1,
  height: 8,
  background: '#f3f4f6',
  borderRadius: 4,
  overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  background: '#D4A574',
  borderRadius: 4,
  transition: 'width 0.3s ease',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
  color: '#D4A574',
  whiteSpace: 'nowrap',
};
