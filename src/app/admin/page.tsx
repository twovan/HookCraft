'use client';

import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import Tag from '@/components/admin/Tag';

type TrendPeriod = 'day' | 'week' | 'month';

interface DashboardData {
  generatedAt: string;
  totalUsers: number;
  monthlyRevenue: number;
  previousMonthlyRevenue: number;
  totalTemplates: number;
  monthlyCreditsConsumed: number;
  recentOrders: {
    orderNumber: string;
    userName: string;
    templateName: string;
    amount: number;
    status: string;
    statusLabel: string;
    createdAt: string;
  }[];
  membershipDistribution: { tier: string; count: number; percentage: number }[];
  topTemplates: { name: string; category: string; price: number; salesCount: number; status: string; statusLabel: string }[];
  recentActivity: { type: string; description: string; actor: string; time: string; status?: string }[];
  revenueTrend: { label: string; amount: number }[];
  aiQueue: {
    activeTasks: number;
    queuedTasks: number;
    completed24h: number;
    failed24h: number;
    successRate: number;
    avgDurationSeconds: number;
    avgDurationLabel: string;
    rows: {
      id: string;
      shortId: string;
      type: string;
      status: string;
      statusLabel: string;
      creditsConsumed: number;
      modelId: string;
      createdAt: string;
    }[];
  };
  reviewRisk: {
    pendingReviews: number;
    todayReviewed: number;
    avgReviewHours: number | null;
    newTemplatesToday: number;
    sensitivityPass24h: number;
    sensitivityRewrite24h: number;
    sensitivityBlock24h: number;
    highRiskWords: { word: string; category: string; hitCount: number; lastHitAt: string | null }[];
  };
}

const yuanFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 1,
});

function formatMoney(cents: number) {
  return yuanFormatter.format((cents || 0) / 100);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusColor(status: string): 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray' {
  if (['completed', 'selected', 'archived', 'published'].includes(status)) return 'green';
  if (['generating', 'building_prompt', 'post_processing', 'pending'].includes(status)) return 'blue';
  if (['review', 'rewrite', 'unpublished'].includes(status)) return 'orange';
  if (['failed', 'safety_blocked', 'rejected', 'block'].includes(status)) return 'red';
  if (['style_dna'].includes(status)) return 'purple';
  return 'gray';
}

function getActivityTone(type: string) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    ai: { color: '#2563eb', bg: '#eff6ff', label: 'AI' },
    risk: { color: '#dc2626', bg: '#fef2f2', label: '!' },
    order: { color: '#16a34a', bg: '#f0fdf4', label: '¥' },
    content: { color: '#d97706', bg: '#fff7ed', label: 'C' },
    user: { color: '#7c3aed', bg: '#f5f3ff', label: 'U' },
    system: { color: '#475569', bg: '#f1f5f9', label: 'S' },
  };
  return map[type] || map.system;
}

function EmptyState({ label }: { label: string }) {
  return <div style={emptyStyle}>{label}</div>;
}

function MetricCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta: string;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}) {
  const toneMap = {
    blue: { bg: '#eff6ff', color: '#2563eb' },
    green: { bg: '#f0fdf4', color: '#16a34a' },
    amber: { bg: '#fff7ed', color: '#d97706' },
    red: { bg: '#fef2f2', color: '#dc2626' },
    slate: { bg: '#f1f5f9', color: '#475569' },
  }[tone];

  return (
    <section style={metricCardStyle}>
      <div style={{ ...metricMarkStyle, background: toneMap.bg, color: toneMap.color }} />
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricMetaStyle}>{meta}</div>
    </section>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <h2 style={panelTitleStyle}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function QueueStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={queueStatCardStyle}>
      <strong style={queueStatValueStyle}>{value}</strong>
      <span style={queueStatLabelStyle}>{label}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revenueTab, setRevenueTab] = useState<TrendPeriod>('week');

  async function fetchDashboard(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch(`/api/admin/dashboard?trendPeriod=${revenueTab}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || '请求失败');
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, [revenueTab]);

  const maxRevenue = useMemo(() => Math.max(...(data?.revenueTrend || []).map((item) => item.amount), 1), [data]);
  const riskCount = (data?.reviewRisk.sensitivityRewrite24h || 0) + (data?.reviewRisk.sensitivityBlock24h || 0);

  if (loading) {
    return (
      <div style={loadingStateStyle}>
        <div style={loadingPulseStyle} />
        <span>正在加载真实运营数据...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={loadingStateStyle}>
        <span style={{ color: '#dc2626' }}>{error}</span>
        <button onClick={() => fetchDashboard()} style={primaryButtonStyle}>重试</button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={pageStyle}>
      <div style={controlStripStyle}>
        <div>
          <div style={eyebrowStyle}>AI Risk & Workflow Control Room</div>
          <div style={stripTitleStyle}>后台运行态总览</div>
        </div>
        <div style={stripRightStyle}>
          <span>数据源：Supabase 实时聚合</span>
          <span>更新时间：{formatDateTime(data.generatedAt)}</span>
          <button onClick={() => fetchDashboard(true)} disabled={refreshing} style={refreshButtonStyle}>
            {refreshing ? '刷新中' : '刷新'}
          </button>
        </div>
      </div>

      <div style={metricsGridStyle}>
        <MetricCard label="总用户数" value={data.totalUsers.toLocaleString()} meta="Supabase Auth 当前用户" tone="blue" />
        <MetricCard label="本月收入" value={formatMoney(data.monthlyRevenue)} meta={`上月 ${formatMoney(data.previousMonthlyRevenue)}`} tone="green" />
        <MetricCard label="模板总数" value={data.totalTemplates.toLocaleString()} meta={`今日新增 ${data.reviewRisk.newTemplatesToday}`} tone="amber" />
        <MetricCard label="月内 Credits 消耗" value={data.monthlyCreditsConsumed.toLocaleString()} meta="generation_tasks 当月汇总" tone="slate" />
        <MetricCard label="AI 生成成功率" value={`${data.aiQueue.successRate}%`} meta={`24h 完成 ${data.aiQueue.completed24h} / 失败 ${data.aiQueue.failed24h}`} tone={data.aiQueue.failed24h > 0 ? 'amber' : 'green'} />
        <MetricCard label="内容审核待处理" value={data.reviewRisk.pendingReviews.toLocaleString()} meta={`今日已审 ${data.reviewRisk.todayReviewed}`} tone={data.reviewRisk.pendingReviews > 0 ? 'amber' : 'green'} />
        <MetricCard label="敏感词风险" value={riskCount.toLocaleString()} meta={`24h 改写 ${data.reviewRisk.sensitivityRewrite24h} / 拦截 ${data.reviewRisk.sensitivityBlock24h}`} tone={riskCount > 0 ? 'red' : 'green'} />
      </div>

      <div style={topGridStyle}>
        <Panel
          title="收入趋势"
          action={(
            <div style={segmentedStyle}>
              {(['day', 'week', 'month'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRevenueTab(tab)}
                  style={{
                    ...segmentButtonStyle,
                    ...(revenueTab === tab ? segmentButtonActiveStyle : {}),
                  }}
                >
                  {tab === 'day' ? '近7天' : tab === 'week' ? '近7周' : '近7月'}
                </button>
              ))}
            </div>
          )}
        >
          <div style={chartWrapStyle}>
            {data.revenueTrend.map((item) => {
              const height = Math.max((item.amount / maxRevenue) * 100, item.amount > 0 ? 12 : 3);
              return (
                <div key={item.label} style={barColumnStyle}>
                  <span style={barValueStyle}>{item.amount > 0 ? formatMoney(item.amount).replace('¥', '') : ''}</span>
                  <div style={barTrackStyle}>
                    <div style={{ ...barStyle, height: `${height}%` }} />
                  </div>
                  <span style={barLabelStyle}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="AI 任务队列健康">
          <div style={queueStatsStyle}>
            <QueueStat value={data.aiQueue.queuedTasks} label="排队中" />
            <QueueStat value={data.aiQueue.activeTasks} label="处理中" />
            <QueueStat value={data.aiQueue.completed24h} label="24h 完成" />
            <QueueStat value={data.aiQueue.avgDurationLabel} label="平均耗时" />
          </div>
          <div style={compactTableWrapStyle}>
            {data.aiQueue.rows.length === 0 ? (
              <EmptyState label="暂无 AI 任务" />
            ) : (
              <table style={compactTableStyle}>
                <thead>
                  <tr>
                    <th style={compactThStyle}>任务</th>
                    <th style={compactThStyle}>模型</th>
                    <th style={compactThStyle}>状态</th>
                    <th style={compactThStyle}>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aiQueue.rows.map((task) => (
                    <tr key={task.id}>
                      <td style={compactTdStyle}>
                        <div style={strongCellStyle}>{task.type}</div>
                        <div style={mutedCellStyle}>#{task.shortId}</div>
                      </td>
                      <td style={compactTdStyle}>{task.modelId}</td>
                      <td style={compactTdStyle}><Tag label={task.statusLabel} color={getStatusColor(task.status)} /></td>
                      <td style={compactTdStyle}>{task.creditsConsumed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel title="内容审核与敏感词预警">
          <div style={riskListStyle}>
            <div style={riskRowStyle}><span>待审核内容</span><strong>{data.reviewRisk.pendingReviews}</strong></div>
            <div style={riskRowStyle}><span>今日已审核</span><strong>{data.reviewRisk.todayReviewed}</strong></div>
            <div style={riskRowStyle}><span>平均审核时长</span><strong>{data.reviewRisk.avgReviewHours === null ? '暂无样本' : `${data.reviewRisk.avgReviewHours}h`}</strong></div>
            <div style={riskRowStyle}><span>24h 通过检测</span><strong>{data.reviewRisk.sensitivityPass24h}</strong></div>
            <div style={riskRowStyle}><span>24h 改写/拦截</span><strong>{data.reviewRisk.sensitivityRewrite24h + data.reviewRisk.sensitivityBlock24h}</strong></div>
          </div>
          <div style={wordListStyle}>
            {data.reviewRisk.highRiskWords.length === 0 ? (
              <EmptyState label="暂无敏感词命中" />
            ) : data.reviewRisk.highRiskWords.map((word) => (
              <div key={`${word.category}-${word.word}`} style={wordRowStyle}>
                <div>
                  <div style={strongCellStyle}>{word.word}</div>
                  <div style={mutedCellStyle}>{word.category}</div>
                </div>
                <strong>{word.hitCount}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={middleGridStyle}>
        <Panel title="最近订单">
          {data.recentOrders.length === 0 ? (
            <EmptyState label="暂无订单" />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>订单号</th>
                  <th style={thStyle}>用户</th>
                  <th style={thStyle}>产品</th>
                  <th style={thStyle}>金额</th>
                  <th style={thStyle}>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.orderNumber}>
                    <td style={tdStyle}>{order.orderNumber}</td>
                    <td style={tdStyle}>{order.userName}</td>
                    <td style={tdStyle}>{order.templateName}</td>
                    <td style={tdStyle}>{formatMoney(order.amount)}</td>
                    <td style={tdStyle}><Tag label={order.statusLabel} color={getStatusColor(order.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="会员分布">
          <div style={memberWrapStyle}>
            {data.membershipDistribution.map((item) => (
              <div key={item.tier} style={memberRowStyle}>
                <div style={memberLabelStyle}>
                  <span>{item.tier}</span>
                  <strong>{item.count} 人</strong>
                </div>
                <div style={progressTrackStyle}>
                  <div style={{ ...progressStyle, width: `${item.percentage}%` }} />
                </div>
                <span style={memberPctStyle}>{item.percentage}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="热门模板 TOP 5">
          <div style={templateListStyle}>
            {data.topTemplates.length === 0 ? (
              <EmptyState label="暂无模板" />
            ) : data.topTemplates.map((template, index) => (
              <div key={`${template.name}-${index}`} style={templateRowStyle}>
                <span style={rankStyle}>{index + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={strongCellStyle}>{template.name}</div>
                  <div style={mutedCellStyle}>{template.category} · {template.statusLabel}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={strongCellStyle}>{formatMoney(template.price)}</div>
                  <div style={mutedCellStyle}>{template.salesCount} 销量</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="最近动态">
        {data.recentActivity.length === 0 ? (
          <EmptyState label="暂无动态" />
        ) : (
          <div style={activityListStyle}>
            {data.recentActivity.map((activity, index) => {
              const tone = getActivityTone(activity.type);
              return (
                <div key={`${activity.time}-${index}`} style={activityRowStyle}>
                  <span style={{ ...activityIconStyle, background: tone.bg, color: tone.color }}>{tone.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={activityDescriptionStyle}>{activity.description}</div>
                    <div style={mutedCellStyle}>{activity.actor}</div>
                  </div>
                  {activity.status && <Tag label={activity.status} color={getStatusColor(activity.status)} />}
                  <span style={activityTimeStyle}>{formatDateTime(activity.time)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const controlStripStyle: React.CSSProperties = {
  minHeight: 76,
  borderRadius: 8,
  background: 'linear-gradient(135deg, #111827 0%, #172033 58%, #0f2a3d 100%)',
  color: '#fff',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  border: '1px solid rgba(255,255,255,0.08)',
};

const eyebrowStyle: React.CSSProperties = {
  color: '#f2b46d',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
};

const stripTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  marginTop: 4,
};

const stripRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  color: 'rgba(255,255,255,0.68)',
  fontSize: 12,
};

const refreshButtonStyle: React.CSSProperties = {
  height: 32,
  padding: '0 14px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  cursor: 'pointer',
};

const metricsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 12,
};

const metricCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 16,
  minHeight: 116,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const metricMarkStyle: React.CSSProperties = {
  width: 28,
  height: 6,
  borderRadius: 999,
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: 700,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 25,
  lineHeight: 1,
  color: '#0f172a',
  fontWeight: 800,
};

const metricMetaStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 12,
  lineHeight: 1.4,
};

const topGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.15fr 1fr 0.75fr',
  gap: 16,
};

const middleGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.3fr 0.8fr 0.95fr',
  gap: 16,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  overflow: 'hidden',
};

const panelHeaderStyle: React.CSSProperties = {
  minHeight: 52,
  padding: '0 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #eef2f7',
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 15,
  fontWeight: 800,
};

const segmentedStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 3,
  background: '#f1f5f9',
  borderRadius: 6,
};

const segmentButtonStyle: React.CSSProperties = {
  height: 26,
  padding: '0 10px',
  border: 'none',
  borderRadius: 5,
  background: 'transparent',
  color: '#64748b',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const segmentButtonActiveStyle: React.CSSProperties = {
  background: '#fff',
  color: '#d97706',
  boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
};

const chartWrapStyle: React.CSSProperties = {
  height: 242,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: 14,
  padding: '22px 18px 16px',
};

const barColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 7,
  minWidth: 0,
};

const barTrackStyle: React.CSSProperties = {
  width: '100%',
  height: 170,
  background: '#f8fafc',
  borderRadius: 5,
  display: 'flex',
  alignItems: 'flex-end',
  overflow: 'hidden',
  border: '1px solid #eef2f7',
};

const barStyle: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(180deg, #f59e0b, #f8c07d)',
};

const barValueStyle: React.CSSProperties = {
  height: 16,
  color: '#64748b',
  fontSize: 11,
  fontWeight: 700,
};

const barLabelStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 11,
  fontWeight: 700,
};

const queueStatsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
  padding: 12,
};

const queueStatCardStyle: React.CSSProperties = {
  minHeight: 58,
  borderRadius: 7,
  border: '1px solid #eef2f7',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

const queueStatValueStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 18,
  lineHeight: 1,
};

const queueStatLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 11,
  fontWeight: 800,
};

const compactTableWrapStyle: React.CSSProperties = {
  borderTop: '1px solid #eef2f7',
};

const compactTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const compactThStyle: React.CSSProperties = {
  textAlign: 'left',
  color: '#64748b',
  fontSize: 11,
  fontWeight: 800,
  padding: '9px 12px',
  background: '#f8fafc',
};

const compactTdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderTop: '1px solid #eef2f7',
  color: '#334155',
};

const strongCellStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const mutedCellStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 11,
  marginTop: 3,
};

const riskListStyle: React.CSSProperties = {
  padding: '10px 16px',
};

const riskRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid #eef2f7',
  color: '#475569',
  fontSize: 13,
};

const wordListStyle: React.CSSProperties = {
  padding: '4px 16px 14px',
};

const wordRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid #f1f5f9',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 800,
  color: '#64748b',
  background: '#f8fafc',
  borderBottom: '1px solid #eef2f7',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: '#334155',
  borderBottom: '1px solid #eef2f7',
};

const memberWrapStyle: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const memberRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '90px 1fr 42px',
  alignItems: 'center',
  gap: 10,
};

const memberLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  color: '#475569',
  fontSize: 12,
};

const progressTrackStyle: React.CSSProperties = {
  height: 8,
  background: '#eef2f7',
  borderRadius: 999,
  overflow: 'hidden',
};

const progressStyle: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #f59e0b, #22c55e)',
};

const memberPctStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'right',
};

const templateListStyle: React.CSSProperties = {
  padding: '8px 16px',
};

const templateRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '11px 0',
  borderBottom: '1px solid #eef2f7',
};

const rankStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 5,
  background: '#fff7ed',
  color: '#d97706',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 12,
};

const activityListStyle: React.CSSProperties = {
  padding: '4px 16px 12px',
};

const activityRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr auto 112px',
  alignItems: 'center',
  gap: 12,
  minHeight: 46,
  borderBottom: '1px solid #eef2f7',
};

const activityIconStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 900,
};

const activityDescriptionStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const activityTimeStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  textAlign: 'right',
};

const emptyStyle: React.CSSProperties = {
  padding: 24,
  color: '#94a3b8',
  fontSize: 13,
  textAlign: 'center',
};

const loadingStateStyle: React.CSSProperties = {
  minHeight: 420,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  alignItems: 'center',
  justifyContent: 'center',
  color: '#64748b',
  fontSize: 14,
};

const loadingPulseStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: 'linear-gradient(135deg, #f59e0b, #2563eb)',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 6,
  border: 'none',
  background: '#d97706',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
