'use client';

import { useEffect, useState } from 'react';

interface CreditQuota {
  tier: string;
  monthlyCredits: number;
}

interface ChangeLog {
  id: string;
  operatorName: string;
  configType: string;
  description: string;
  changedAt: string;
}

const TIER_LABELS: Record<string, string> = {
  free: '免费版（Preview 次数）',
  pro: '专业版（Credits）',
  business: '商业版（Credits）',
};

export default function AdminCreditsQuotaPage() {
  const [quotas, setQuotas] = useState<CreditQuota[]>([]);
  const [editQuotas, setEditQuotas] = useState<CreditQuota[]>([]);
  const [history, setHistory] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [quotaRes, historyRes] = await Promise.all([
        fetch('/api/admin/config/quota'),
        fetch('/api/admin/config/changelog?limit=10'),
      ]);
      const quotaData = await quotaRes.json();
      const historyData = await historyRes.json();
      setQuotas(quotaData.creditQuotas || []);
      setEditQuotas(quotaData.creditQuotas || []);
      setHistory(
        (historyData.history || []).filter(
          (h: ChangeLog) => h.configType === 'credit_quota'
        )
      );
    } catch {
      // silent
    }
    setLoading(false);
  }

  function handleEdit(tier: string, value: number) {
    setEditQuotas((prev) =>
      prev.map((q) => (q.tier === tier ? { ...q, monthlyCredits: value } : q))
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config/quota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditQuotas: editQuotas, operatorId: 'admin-001' }),
      });
      if (res.ok) {
        setSaved(true);
        setEditing(false);
        await fetchData();
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // silent
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={pageContainer}>
        <div style={topbar}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>等级配额配置</div>
        </div>
        <div style={{ padding: '24px 32px', color: '#888' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <div style={topbar}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>等级配额配置</div>
          <div style={{ fontSize: 12, color: '#999' }}>管理 / Credits 配额</div>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {saved && (
          <div style={successBanner}>✅ 配置已保存，将在 5 秒内生效</div>
        )}

        {/* Current Config Card */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>当前配额配置</span>
            {!editing && (
              <button style={btnPrimary} onClick={() => setEditing(true)}>
                编辑配置
              </button>
            )}
          </div>
          <div style={cardBody}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>等级</th>
                  <th style={th}>月度配额</th>
                  {editing && <th style={th}>新值</th>}
                </tr>
              </thead>
              <tbody>
                {quotas.map((q) => (
                  <tr key={q.tier}>
                    <td style={td}>{TIER_LABELS[q.tier] || q.tier}</td>
                    <td style={td}>
                      {q.tier === 'free'
                        ? `${q.monthlyCredits} 次 Preview/月`
                        : `${q.monthlyCredits} Credits/月`}
                    </td>
                    {editing && (
                      <td style={td}>
                        <input
                          type="number"
                          min={0}
                          value={editQuotas.find((e) => e.tier === q.tier)?.monthlyCredits ?? 0}
                          onChange={(e) => handleEdit(q.tier, parseInt(e.target.value) || 0)}
                          style={formInput}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {editing && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button
                  style={btnSecondary}
                  onClick={() => {
                    setEditing(false);
                    setEditQuotas(quotas);
                  }}
                >
                  取消
                </button>
                <button style={btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存配置'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Change History */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>变更历史</span>
          </div>
          <div style={cardBody}>
            {history.length === 0 ? (
              <div style={{ color: '#ccc', textAlign: 'center', padding: 40 }}>暂无变更记录</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>操作人</th>
                    <th style={th}>描述</th>
                    <th style={th}>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td style={td}>{h.operatorName}</td>
                      <td style={td}>{h.description}</td>
                      <td style={td}>{new Date(h.changedAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const pageContainer: React.CSSProperties = { minHeight: '100vh' };

const topbar: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: '#fff',
  height: 60,
  display: 'flex',
  alignItems: 'center',
  padding: '0 32px',
  borderBottom: '1px solid #e8e8e8',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  marginBottom: 24,
};

const cardHeader: React.CSSProperties = {
  padding: '18px 24px',
  borderBottom: '1px solid #f0f0f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const cardBody: React.CSSProperties = { padding: '20px 24px' };

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: '1px solid #f0f0f0',
  background: '#fafafa',
};

const td: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #f5f5f5',
  fontSize: 13,
  verticalAlign: 'middle',
};

const formInput: React.CSSProperties = {
  width: 120,
  padding: '8px 12px',
  border: '1px solid #e0e0e0',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  background: '#D4A574',
  color: '#fff',
  fontFamily: 'inherit',
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: '#f5f5f5',
  color: '#555',
};

const successBanner: React.CSSProperties = {
  padding: '12px 20px',
  background: '#e8f8f0',
  color: '#27ae60',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 20,
};
