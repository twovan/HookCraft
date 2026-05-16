'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import Tag from '@/components/admin/Tag';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormModal from '@/components/admin/FormModal';

interface RevenueStats {
  totalRevenue: number;
  platformCommission: number;
  producerPayouts: number;
  pendingSettlements: number;
}

interface BreakdownItem {
  category: string;
  amount: number;
  percentage: number;
}

interface SettlementItem {
  id: string;
  settlementNumber: string;
  producerName: string;
  producerId: string;
  templateSalesAmount: number;
  platformCommission: number;
  settlementAmount: number;
  status: string;
  settlementDate: string;
  paidAt: string | null;
}

export default function AdminRevenuePage() {
  const [stats, setStats] = useState<RevenueStats>({ totalRevenue: 0, platformCommission: 0, producerPayouts: 0, pendingSettlements: 0 });
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [settlementsTotal, setSettlementsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  // Confirm dialog for payment confirmation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Settlement form modal
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ producerName: '', producerId: '', salesAmount: '', commission: '', settlementAmount: '' });
  const [formLoading, setFormLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [revenueRes, settlementsRes] = await Promise.all([
        fetch('/api/admin/revenue'),
        fetch(`/api/admin/revenue/settlements?page=${page}&pageSize=${pageSize}`),
      ]);

      if (revenueRes.ok) {
        const revenueData = await revenueRes.json();
        setStats(revenueData.stats);
        setBreakdown(revenueData.breakdown || []);
      }

      if (settlementsRes.ok) {
        const settlementsData = await settlementsRes.json();
        setSettlements(settlementsData.data || []);
        setSettlementsTotal(settlementsData.total || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleConfirmPayment() {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/admin/revenue/settlements/${confirmTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  async function handleCreateSettlement() {
    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/revenue/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producerId: formData.producerId,
          producerName: formData.producerName,
          templateSalesAmount: parseInt(formData.salesAmount) || 0,
          platformCommission: parseInt(formData.commission) || 0,
          settlementAmount: parseInt(formData.settlementAmount) || 0,
        }),
      });
      if (!res.ok) throw new Error('创建失败');
      setFormOpen(false);
      setFormData({ producerName: '', producerId: '', salesAmount: '', commission: '', settlementAmount: '' });
      fetchData();
    } catch {
      alert('创建结算失败，请重试');
    } finally {
      setFormLoading(false);
    }
  }

  const settlementColumns: Column<SettlementItem>[] = [
    { key: 'settlementNumber', title: '结算单号', render: (row) => <span style={{ fontWeight: 500, fontSize: 12 }}>{row.settlementNumber}</span> },
    { key: 'producerName', title: '制作人' },
    { key: 'settlementAmount', title: '结算金额', render: (row) => <span style={{ fontWeight: 600 }}>¥{(row.settlementAmount / 100).toFixed(2)}</span> },
    { key: 'templateSalesAmount', title: '模板销售额', render: (row) => <span>¥{(row.templateSalesAmount / 100).toFixed(2)}</span> },
    { key: 'platformCommission', title: '平台佣金', render: (row) => <span>¥{(row.platformCommission / 100).toFixed(2)}</span> },
    {
      key: 'status',
      title: '状态',
      render: (row) => (
        <Tag
          label={row.status === 'paid' ? '已打款' : '处理中'}
          color={row.status === 'paid' ? 'green' : 'orange'}
        />
      ),
    },
    {
      key: 'settlementDate',
      title: '结算日期',
      render: (row) => <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(row.settlementDate).toLocaleDateString('zh-CN')}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      render: (row) => row.status === 'processing' ? (
        <button
          onClick={() => { setConfirmTarget({ id: row.id, name: row.producerName }); setConfirmOpen(true); }}
          style={{ ...actionBtnStyle, color: '#16a34a' }}
        >
          确认打款
        </button>
      ) : <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>,
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="总收入" value={`¥${(stats.totalRevenue / 100).toFixed(0)}`} icon="💰" iconColor="blue" />
        <StatCard label="平台佣金" value={`¥${(stats.platformCommission / 100).toFixed(0)}`} icon="🏦" iconColor="green" />
        <StatCard label="制作人分成" value={`¥${(stats.producerPayouts / 100).toFixed(0)}`} icon="🎵" iconColor="purple" />
        <StatCard label="待结算" value={`¥${(stats.pendingSettlements / 100).toFixed(0)}`} icon="⏳" iconColor="orange" />
      </div>

      {/* Revenue Breakdown */}
      <div style={breakdownContainerStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>收入构成</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {breakdown.map((item) => (
            <div key={item.category} style={breakdownCardStyle}>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{item.category}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>¥{(item.amount / 100).toFixed(0)}</div>
              <div style={{ fontSize: 12, color: '#D4A574', marginTop: 4 }}>{item.percentage}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Settlements */}
      <div style={{ marginTop: 24 }}>
        <div style={sectionHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1f2937' }}>结算记录</h3>
          <button onClick={() => setFormOpen(true)} style={createBtnStyle}>发起结算</button>
        </div>
        <DataTable
          columns={settlementColumns}
          data={settlements}
          total={settlementsTotal}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          loading={loading}
        />
      </div>

      {/* Confirm Payment Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="确认打款"
        description={`确定要确认对"${confirmTarget?.name}"的打款吗？确认后状态将变为已打款。`}
        variant="info"
        confirmLabel="确认打款"
        onConfirm={handleConfirmPayment}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        loading={confirming}
      />

      {/* Create Settlement Modal */}
      <FormModal
        open={formOpen}
        title="发起结算"
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateSettlement}
        submitLabel="创建结算"
        loading={formLoading}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>制作人名称 *</label>
            <input style={inputStyle} value={formData.producerName} onChange={(e) => setFormData((f) => ({ ...f, producerName: e.target.value }))} placeholder="制作人名称" />
          </div>
          <div>
            <label style={labelStyle}>制作人ID *</label>
            <input style={inputStyle} value={formData.producerId} onChange={(e) => setFormData((f) => ({ ...f, producerId: e.target.value }))} placeholder="制作人ID" />
          </div>
          <div>
            <label style={labelStyle}>模板销售额（分）</label>
            <input style={inputStyle} type="number" value={formData.salesAmount} onChange={(e) => setFormData((f) => ({ ...f, salesAmount: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>平台佣金（分）</label>
            <input style={inputStyle} type="number" value={formData.commission} onChange={(e) => setFormData((f) => ({ ...f, commission: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>结算金额（分）</label>
            <input style={inputStyle} type="number" value={formData.settlementAmount} onChange={(e) => setFormData((f) => ({ ...f, settlementAmount: e.target.value }))} />
          </div>
        </div>
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

const breakdownContainerStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
};

const breakdownCardStyle: React.CSSProperties = {
  padding: '16px 20px',
  background: '#fafafa',
  borderRadius: 8,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};

const createBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  whiteSpace: 'nowrap',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  outline: 'none',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  boxSizing: 'border-box',
};
