'use client';

import { useEffect, useState } from 'react';

interface CostRule {
  operation: string;
  cost: number;
  description: string;
}

const OP_LABELS: Record<string, string> = {
  preview: 'Preview 预览试听（30 秒）',
  full_demo_short: '完整 Demo（短版）',
  full_demo_long: '完整 Demo（长版）',
  premium_singer: '高级歌手声模（额外消耗）',
  export_wav: 'WAV 高品质导出',
  export_stems: '分轨导出',
};

export default function AdminCostRulesPage() {
  const [rules, setRules] = useState<CostRule[]>([]);
  const [editRules, setEditRules] = useState<CostRule[]>([]);
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
      const res = await fetch('/api/admin/config/cost-rules');
      const data = await res.json();
      setRules(data.costRules || []);
      setEditRules(data.costRules || []);
    } catch {
      // silent
    }
    setLoading(false);
  }

  function handleEdit(operation: string, cost: number) {
    setEditRules((prev) =>
      prev.map((r) => (r.operation === operation ? { ...r, cost } : r))
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config/cost-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costRules: editRules, operatorId: 'admin-001' }),
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
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>消耗规则配置</div>
        </div>
        <div style={{ padding: '24px 32px', color: '#888' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <div style={topbar}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>消耗规则配置</div>
          <div style={{ fontSize: 12, color: '#999' }}>管理 / 消耗规则</div>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {saved && (
          <div style={successBanner}>✅ 配置已保存，将在 5 秒内生效</div>
        )}

        <div style={card}>
          <div style={cardHeader}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Credits 消耗规则</span>
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
                  <th style={th}>操作类型</th>
                  <th style={th}>描述</th>
                  <th style={th}>消耗 Credits</th>
                  {editing && <th style={th}>新值</th>}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.operation}>
                    <td style={td}>
                      <span style={tag}>{r.operation}</span>
                    </td>
                    <td style={td}>{OP_LABELS[r.operation] || r.description}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{r.cost}</span> Credits
                    </td>
                    {editing && (
                      <td style={td}>
                        <input
                          type="number"
                          min={0}
                          value={editRules.find((e) => e.operation === r.operation)?.cost ?? 0}
                          onChange={(e) => handleEdit(r.operation, parseInt(e.target.value) || 0)}
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
                    setEditRules(rules);
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

const tag: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 500,
  background: '#e8f4fd',
  color: '#2196f3',
};

const formInput: React.CSSProperties = {
  width: 100,
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
