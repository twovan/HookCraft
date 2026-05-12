'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/admin/StatCard';
import Tag from '@/components/admin/Tag';

interface DashboardData {
  totalUsers: number;
  monthlyRevenue: number;
  totalTemplates: number;
  monthlyCreditsConsumed: number;
  recentOrders: {
    orderNumber: string;
    userName: string;
    templateName: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
  membershipDistribution: { tier: string; count: number; percentage: number }[];
  topTemplates: { name: string; category: string; price: number; salesCount: number }[];
  recentActivity: { type: string; description: string; time: string }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueTab, setRevenueTab] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || '请求失败');
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <span style={{ color: '#6b7280', fontSize: 14 }}>加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12 }}>
        <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
        <button onClick={fetchDashboard} style={retryButtonStyle}>重试</button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      {/* Stats Cards */}
      <div style={statsGridStyle}>
        <StatCard
          label="总用户数"
          value={data.totalUsers.toLocaleString()}
          icon="👥"
          iconColor="blue"
          change={{ value: '12%', direction: 'up' }}
        />
        <StatCard
          label="本月收入"
          value={`¥${(data.monthlyRevenue / 100).toLocaleString()}`}
          icon="💰"
          iconColor="green"
          change={{ value: '8%', direction: 'up' }}
        />
        <StatCard
          label="模板总数"
          value={data.totalTemplates.toLocaleString()}
          icon="🎵"
          iconColor="purple"
          change={{ value: '5%', direction: 'up' }}
        />
        <StatCard
          label="本月 Credits 消耗"
          value={data.monthlyCreditsConsumed.toLocaleString()}
          icon="⚡"
          iconColor="orange"
          change={{ value: '15%', direction: 'up' }}
        />
      </div>

      {/* Revenue Trend + Recent Orders */}
      <div style={twoColStyle}>
        {/* Revenue Trend */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>收入趋势</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['day', 'week', 'month'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRevenueTab(tab)}
                  style={{
                    ...tabButtonStyle,
                    background: revenueTab === tab ? '#D4A574' : '#f3f4f6',
                    color: revenueTab === tab ? '#fff' : '#6b7280',
                  }}
                >
                  {tab === 'day' ? '日' : tab === 'week' ? '周' : '月'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {/* Placeholder revenue chart bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {[65, 45, 80, 55, 90, 70, 85].map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: '100%',
                    height: `${h}%`,
                    background: 'linear-gradient(180deg, #D4A574 0%, rgba(212,165,116,0.3) 100%)',
                    borderRadius: 4,
                    minHeight: 8,
                  }} />
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>
                    {revenueTab === 'day' ? `${i + 1}h` : revenueTab === 'week' ? ['一', '二', '三', '四', '五', '六', '日'][i] : `W${i + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>最近订单</span>
          </div>
          <div style={{ padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>订单号</th>
                  <th style={thStyle}>用户</th>
                  <th style={thStyle}>金额</th>
                  <th style={thStyle}>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>暂无订单</td>
                  </tr>
                ) : (
                  data.recentOrders.map((order, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{order.orderNumber}</td>
                      <td style={tdStyle}>{order.userName}</td>
                      <td style={tdStyle}>¥{(order.amount / 100).toFixed(2)}</td>
                      <td style={tdStyle}>
                        <Tag
                          label={order.status === 'completed' ? '已完成' : order.status === 'pending' ? '处理中' : order.status}
                          color={order.status === 'completed' ? 'green' : order.status === 'pending' ? 'orange' : 'gray'}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Membership Distribution + Top Templates + Recent Activity */}
      <div style={threeColStyle}>
        {/* Membership Distribution */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>会员分布</span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {data.membershipDistribution.map((item) => (
              <div key={item.tier} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{item.tier}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{item.count} 人 ({item.percentage}%)</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${item.percentage}%`,
                    background: item.tier === 'Free' ? '#9ca3af' : item.tier === 'Pro' ? '#D4A574' : '#8b5cf6',
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Templates */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>热门模板 TOP 5</span>
          </div>
          <div style={{ padding: '12px 24px' }}>
            {data.topTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>暂无数据</div>
            ) : (
              data.topTemplates.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i < data.topTemplates.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <span style={{ width: 24, fontSize: 14, fontWeight: 700, color: i < 3 ? '#D4A574' : '#9ca3af' }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.category}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>¥{(t.price / 100).toFixed(0)}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.salesCount} 销量</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>最近动态</span>
          </div>
          <div style={{ padding: '16px 24px' }}>
            {data.recentActivity.map((activity, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < data.recentActivity.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: activity.type === 'user' ? '#3b82f6' : activity.type === 'template' ? '#8b5cf6' : activity.type === 'order' ? '#22c55e' : activity.type === 'ai' ? '#f59e0b' : '#6b7280',
                  marginTop: 5,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#374151' }}>{activity.description}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {new Date(activity.time).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
  marginBottom: 24,
};

const twoColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr',
  gap: 16,
  marginBottom: 24,
};

const threeColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
  overflow: 'hidden',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  borderBottom: '1px solid #f3f4f6',
};

const tabButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  border: 'none',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  borderBottom: '1px solid #f3f4f6',
  background: '#fafafa',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: 13,
  color: '#374151',
};

const retryButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
