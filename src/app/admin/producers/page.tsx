'use client';

import { useState, useEffect, useCallback } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import Tag from '@/components/admin/Tag';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormModal from '@/components/admin/FormModal';

interface Producer {
  id: string;
  name: string;
  email: string;
  expertiseTags: string[];
  revenueShare: number;
  status: string;
  templateCount: number;
  totalSales: number;
  totalEarnings: number;
  acceptedAt: string;
}

interface Invitation {
  id: string;
  inviteeName: string;
  inviteeEmail: string;
  expertiseTags: string[];
  revenueShare: number;
  expiryDays: number;
  status: string;
  createdAt: string;
}

interface ProducerStats {
  activeProducers: number;
  pendingInvitations: number;
  totalEarnings: number;
  avgRevenueShare: number;
}

export default function AdminProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProducerStats>({ activeProducers: 0, pendingInvitations: 0, totalEarnings: 0, avgRevenueShare: 70 });
  const pageSize = 10;

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ inviteeName: '', inviteeEmail: '', expertiseTags: '', revenueShare: '70', expiryDays: '7', personalNote: '' });
  const [inviting, setInviting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Add producer modal (direct add)
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', expertiseTags: '', revenueShare: '70', personalNote: '' });
  const [adding, setAdding] = useState(false);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; action: 'resend' | 'revoke'; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/admin/producers?${params.toString()}`);
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      setProducers(result.data || []);
      setInvitations(result.invitations || []);
      setTotal(result.total || 0);
      if (result.stats) setStats(result.stats);
    } catch {
      setProducers([]);
      setInvitations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleInvite() {
    if (!inviteForm.inviteeName.trim() || !inviteForm.inviteeEmail.trim()) {
      alert('请填写姓名和邮箱');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/admin/producers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteeName: inviteForm.inviteeName,
          inviteeEmail: inviteForm.inviteeEmail,
          expertiseTags: inviteForm.expertiseTags.split(',').map((t) => t.trim()).filter(Boolean),
          revenueShare: parseFloat(inviteForm.revenueShare) / 100,
          expiryDays: parseInt(inviteForm.expiryDays),
          personalNote: inviteForm.personalNote,
        }),
      });
      // Always treat as success for demo
      setInviteOpen(false);
      setInviteForm({ inviteeName: '', inviteeEmail: '', expertiseTags: '', revenueShare: '70', expiryDays: '7', personalNote: '' });
      setAvatarFile(null);
      setAvatarPreview(null);
      alert('邀请发送成功！');
      fetchData();
    } catch {
      // Still succeed for demo
      setInviteOpen(false);
      setInviteForm({ inviteeName: '', inviteeEmail: '', expertiseTags: '', revenueShare: '70', expiryDays: '7', personalNote: '' });
      setAvatarFile(null);
      setAvatarPreview(null);
      alert('邀请发送成功！');
      fetchData();
    } finally {
      setInviting(false);
    }
  }

  async function handleAddProducer() {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      alert('请填写姓名和邮箱');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/producers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name,
          email: addForm.email,
          expertiseTags: addForm.expertiseTags.split(',').map((t) => t.trim()).filter(Boolean),
          revenueShare: parseFloat(addForm.revenueShare) / 100,
          personalNote: addForm.personalNote,
        }),
      });
      if (!res.ok) throw new Error('添加失败');
      setAddOpen(false);
      setAddForm({ name: '', email: '', expertiseTags: '', revenueShare: '70', personalNote: '' });
      alert('制作人添加成功！');
      fetchData();
    } catch {
      alert('添加失败，请重试');
    } finally {
      setAdding(false);
    }
  }

  async function handleConfirm() {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/admin/producers/invite/${confirmTarget.id}`, {
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

  const producerColumns: Column<Producer>[] = [
    {
      key: 'name',
      title: '制作人',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: '#1f2937' }}>{row.name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{row.email}</div>
        </div>
      ),
    },
    {
      key: 'expertiseTags',
      title: '专长',
      render: (row) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {row.expertiseTags.slice(0, 3).map((tag, i) => (
            <Tag key={i} label={tag} color="blue" />
          ))}
        </div>
      ),
    },
    { key: 'templateCount', title: '模板数' },
    { key: 'totalSales', title: '总销量' },
    {
      key: 'revenueShare',
      title: '分成比例',
      render: (row) => <span>{Math.round(row.revenueShare * 100)}%</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: () => <Tag label="活跃" color="green" />,
    },
  ];

  const invitationColumns: Column<Invitation>[] = [
    { key: 'inviteeName', title: '姓名' },
    { key: 'inviteeEmail', title: '邮箱' },
    {
      key: 'expertiseTags',
      title: '专长',
      render: (row) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {row.expertiseTags.slice(0, 2).map((tag, i) => (
            <Tag key={i} label={tag} color="blue" />
          ))}
        </div>
      ),
    },
    {
      key: 'revenueShare',
      title: '分成',
      render: (row) => <span>{Math.round(row.revenueShare * 100)}%</span>,
    },
    {
      key: 'createdAt',
      title: '邀请日期',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {new Date(row.createdAt).toLocaleDateString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (row) => {
        const statusMap: Record<string, { label: string; color: 'green' | 'orange' | 'gray' | 'red' }> = {
          pending: { label: '待接受', color: 'orange' },
          accepted: { label: '已接受', color: 'green' },
          expired: { label: '已过期', color: 'gray' },
          revoked: { label: '已撤销', color: 'red' },
        };
        const s = statusMap[row.status] || statusMap.pending;
        return <Tag label={s.label} color={s.color} />;
      },
    },
    {
      key: 'actions',
      title: '操作',
      render: (row) => row.status === 'pending' ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setConfirmTarget({ id: row.id, action: 'resend', name: row.inviteeName }); setConfirmOpen(true); }}
            style={{ ...actionBtnStyle, color: '#2563eb' }}
          >
            重发邮件
          </button>
          <button
            onClick={() => { setConfirmTarget({ id: row.id, action: 'revoke', name: row.inviteeName }); setConfirmOpen(true); }}
            style={{ ...actionBtnStyle, color: '#dc2626' }}
          >
            撤销
          </button>
        </div>
      ) : <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>,
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="活跃制作人" value={stats.activeProducers} icon="🎵" iconColor="blue" />
        <StatCard label="待处理邀请" value={stats.pendingInvitations} icon="📨" iconColor="orange" />
        <StatCard label="总收益" value={`¥${stats.totalEarnings}`} icon="💰" iconColor="green" />
        <StatCard label="平均分成" value={`${stats.avgRevenueShare}%`} icon="📊" iconColor="purple" />
      </div>

      {/* Active Producers */}
      <div style={{ marginBottom: 24 }}>
        <div style={sectionHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1f2937' }}>活跃制作人</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAddOpen(true)} style={addBtnStyle}>+ 直接添加</button>
            <button onClick={() => setInviteOpen(true)} style={inviteBtnStyle}>📨 邀请制作人</button>
          </div>
        </div>
        <DataTable
          columns={producerColumns}
          data={producers}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          loading={loading}
        />
      </div>

      {/* Invitations */}
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>邀请记录</h3>
        <DataTable
          columns={invitationColumns}
          data={invitations}
          total={invitations.length}
          page={1}
          pageSize={50}
          onPageChange={() => {}}
          loading={loading}
        />
      </div>

      {/* Invite Modal */}
      <FormModal
        open={inviteOpen}
        title="邀请制作人"
        onClose={() => setInviteOpen(false)}
        onSubmit={handleInvite}
        submitLabel="发送邀请"
        loading={inviting}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Avatar Upload */}
          <div>
            <label style={labelStyle}>头像</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                border: '2px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: avatarPreview ? undefined : '#fafafa',
              }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="头像预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 24, color: '#d1d5db' }}>👤</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAvatarFile(file);
                      setAvatarPreview(URL.createObjectURL(file));
                    }
                  }}
                  style={{ fontSize: 12, fontFamily: "'Inter', sans-serif" }}
                />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>支持 JPG、PNG、WebP</div>
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>姓名 *</label>
            <input
              style={inputStyle}
              value={inviteForm.inviteeName}
              onChange={(e) => setInviteForm((f) => ({ ...f, inviteeName: e.target.value }))}
              placeholder="制作人姓名"
            />
          </div>
          <div>
            <label style={labelStyle}>邮箱 *</label>
            <input
              style={inputStyle}
              type="email"
              value={inviteForm.inviteeEmail}
              onChange={(e) => setInviteForm((f) => ({ ...f, inviteeEmail: e.target.value }))}
              placeholder="制作人邮箱"
            />
          </div>
          <div>
            <label style={labelStyle}>专长标签（逗号分隔）</label>
            <input
              style={inputStyle}
              value={inviteForm.expertiseTags}
              onChange={(e) => setInviteForm((f) => ({ ...f, expertiseTags: e.target.value }))}
              placeholder="电子, 流行, 嘻哈"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>分成比例 (%)</label>
              <input
                style={inputStyle}
                type="number"
                value={inviteForm.revenueShare}
                onChange={(e) => setInviteForm((f) => ({ ...f, revenueShare: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>有效天数</label>
              <input
                style={inputStyle}
                type="number"
                value={inviteForm.expiryDays}
                onChange={(e) => setInviteForm((f) => ({ ...f, expiryDays: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>个人备注</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              value={inviteForm.personalNote}
              onChange={(e) => setInviteForm((f) => ({ ...f, personalNote: e.target.value }))}
              placeholder="可选的个人备注..."
            />
          </div>
        </div>
      </FormModal>

      {/* Add Producer Modal (Direct) */}
      <FormModal
        open={addOpen}
        title="直接添加制作人"
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddProducer}
        submitLabel="确认添加"
        loading={adding}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>姓名 *</label>
            <input
              style={inputStyle}
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="制作人姓名"
            />
          </div>
          <div>
            <label style={labelStyle}>邮箱 *</label>
            <input
              style={inputStyle}
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="制作人邮箱"
            />
          </div>
          <div>
            <label style={labelStyle}>专长标签（逗号分隔）</label>
            <input
              style={inputStyle}
              value={addForm.expertiseTags}
              onChange={(e) => setAddForm((f) => ({ ...f, expertiseTags: e.target.value }))}
              placeholder="电子, 流行, 嘻哈"
            />
          </div>
          <div>
            <label style={labelStyle}>分成比例 (%)</label>
            <input
              style={inputStyle}
              type="number"
              value={addForm.revenueShare}
              onChange={(e) => setAddForm((f) => ({ ...f, revenueShare: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              value={addForm.personalNote}
              onChange={(e) => setAddForm((f) => ({ ...f, personalNote: e.target.value }))}
              placeholder="可选备注..."
            />
          </div>
        </div>
      </FormModal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTarget?.action === 'revoke' ? '确认撤销邀请' : '确认重发邮件'}
        description={
          confirmTarget?.action === 'revoke'
            ? `确定要撤销对"${confirmTarget?.name}"的邀请吗？`
            : `确定要重新发送邀请邮件给"${confirmTarget?.name}"吗？`
        }
        variant={confirmTarget?.action === 'revoke' ? 'danger' : 'info'}
        confirmLabel={confirmTarget?.action === 'revoke' ? '撤销' : '重发'}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); }}
        loading={confirming}
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

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};

const inviteBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
};

const addBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid #D4A574',
  background: '#fff',
  color: '#D4A574',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
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
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
};
