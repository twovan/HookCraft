'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

interface DailyTrendPoint {
  date: string;
  label: string;
  consumed: number;
}

export default function AdminCreditsPage() {
  const [stats, setStats] = useState<CreditsStats>({ totalIssued: 0, totalConsumed: 0, consumptionRate: 0, exhaustedCount: 0, daysUntilReset: 0 });
  const [tierBreakdown, setTierBreakdown] = useState<TierBreakdown[]>([]);
  const [exhaustedUsers, setExhaustedUsers] = useState<ExhaustedUser[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendPoint[]>([]);
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
      setDailyTrend(result.dailyTrend || []);
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
  const maxDailyConsumed = Math.max(...dailyTrend.map((day) => day.consumed), 1);

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

      <div style={quickActionsStyle}>
        <Link href="/admin/credits/pricing" style={quickActionStyle}>
          <span style={quickActionTitleStyle}>会员价格配置</span>
          <span style={quickActionDescStyle}>调整月付、年付和套餐价格</span>
        </Link>
        <Link href="/admin/credits/cost-rules" style={quickActionStyle}>
          <span style={quickActionTitleStyle}>消耗规则配置</span>
          <span style={quickActionDescStyle}>设置生成、编辑、导出的 Credits 扣除</span>
        </Link>
        <Link href="/admin/credits/credits-pack" style={quickActionStyle}>
          <span style={quickActionTitleStyle}>充值包配置</span>
          <span style={quickActionDescStyle}>管理额外购买 Credits 的档位和折扣</span>
        </Link>
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

      {/* Daily Consumption Trend */}
      <div style={{ ...tierCardStyle, marginTop: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>每日消耗趋势</h3>
        {dailyTrend.some((day) => day.consumed > 0) ? (
          <div style={trendChartStyle}>
            {dailyTrend.map((day) => (
              <div key={day.date} style={trendBarItemStyle}>
                <div style={trendValueStyle}>{day.consumed}</div>
                <div style={trendBarTrackStyle}>
                  <div
                    style={{
                      ...trendBarFillStyle,
                      height: `${Math.max((day.consumed / maxDailyConsumed) * 100, day.consumed > 0 ? 8 : 0)}%`,
                    }}
                  />
                </div>
                <div style={trendLabelStyle}>{day.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={trendEmptyStyle}>近 7 天暂无 Credits 消耗</div>
        )}
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

const quickActionsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  marginBottom: 16,
};

const quickActionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  padding: '14px 16px',
  borderRadius: 10,
  background: '#fff',
  border: '1px solid rgba(212,165,116,0.28)',
  textDecoration: 'none',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const quickActionTitleStyle: React.CSSProperties = {
  color: '#1f2937',
  fontSize: 14,
  fontWeight: 700,
};

const quickActionDescStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 12,
  lineHeight: 1.5,
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

const trendChartStyle: React.CSSProperties = {
  height: 150,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 14,
  alignItems: 'end',
  padding: '6px 4px 0',
};

const trendBarItemStyle: React.CSSProperties = {
  minWidth: 0,
  height: '100%',
  display: 'grid',
  gridTemplateRows: '20px 1fr 18px',
  gap: 6,
  justifyItems: 'center',
};

const trendValueStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '20px',
};

const trendBarTrackStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 46,
  height: '100%',
  display: 'flex',
  alignItems: 'flex-end',
  borderRadius: 8,
  background: '#f3f4f6',
  overflow: 'hidden',
};

const trendBarFillStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '8px 8px 0 0',
  background: 'linear-gradient(180deg, #E2B784 0%, #D4A574 100%)',
  transition: 'height 0.3s ease',
};

const trendLabelStyle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: 11,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
};

const trendEmptyStyle: React.CSSProperties = {
  height: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#9ca3af',
  fontSize: 13,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  color: '#D4A574',
  whiteSpace: 'nowrap',
};
