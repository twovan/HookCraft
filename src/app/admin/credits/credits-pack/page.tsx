'use client';

import { useEffect, useState } from 'react';

interface CreditsPack {
  id: string;
  credits: number;
  price: number;
  businessDiscount: number;
}

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export default function AdminCreditsPackPage() {
  const [packs, setPacks] = useState<CreditsPack[]>([]);
  const [editPacks, setEditPacks] = useState<CreditsPack[]>([]);
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
      const res = await fetch('/api/admin/config/credits-pack');
      const data = await res.json();
      setPacks(data.creditsPacks || []);
      setEditPacks(data.creditsPacks || []);
    } catch {
      // silent
    }
    setLoading(false);
  }

  function handleEdit(id: string, field: keyof CreditsPack, value: number) {
    setEditPacks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config/credits-pack', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditsPacks: editPacks, operatorId: 'admin-001' }),
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
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Credits Pack 配置</div>
        </div>
        <div style={{ padding: '24px 32px', color: '#888' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <div style={topbar}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>Credits Pack 配置</div>
          <div style={{ fontSize: 12, color: '#999' }}>管理 / Credits Pack</div>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {saved && (
          <div style={successBanner}>✅ 配置已保存，将在 5 秒内生效</div>
        )}

        <div style={card}>
          <div style={cardHeader}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>充值包规格</span>
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
                  <th style={th}>包 ID</th>
                  <th style={th}>Credits 数量</th>
                  <th style={th}>价格</th>
                  <th style={th}>Business 折扣</th>
                  <th style={th}>Business 价格</th>
                  {editing && <th style={th}>操作</th>}
                </tr>
              </thead>
              <tbody>
                {(editing ? editPacks : packs).map((p) => (
                  <tr key={p.id}>
                    <td style={td}>
                      <span style={tag}>{p.id}</span>
                    </td>
                    <td style={td}>
                      {editing ? (
                        <input
                          type="number"
                          min={1}
                          value={p.credits}
                          onChange={(e) => handleEdit(p.id, 'credits', parseInt(e.target.value) || 0)}
                          style={formInput}
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{p.credits} Credits</span>
                      )}
                    </td>
                    <td style={td}>
                      {editing ? (
                        <input
                          type="number"
                          min={0}
                          value={p.price}
                          onChange={(e) => handleEdit(p.id, 'price', parseInt(e.target.value) || 0)}
                          style={formInput}
                        />
                      ) : (
                        formatPrice(p.price)
                      )}
                    </td>
                    <td style={td}>
                      {editing ? (
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={p.businessDiscount}
                          onChange={(e) =>
                            handleEdit(p.id, 'businessDiscount', parseFloat(e.target.value) || 0)
                          }
                          style={{ ...formInput, width: 80 }}
                        />
                      ) : (
                        <span style={discountTag}>{(p.businessDiscount * 10).toFixed(0)} 折</span>
                      )}
                    </td>
                    <td style={td}>
                      {formatPrice(Math.round(p.price * p.businessDiscount))}
                    </td>
                    {editing && <td style={td}>—</td>}
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
                    setEditPacks(packs);
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
  background: '#f0e8fd',
  color: '#9b59b6',
};

const discountTag: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 500,
  background: '#e8f8f0',
  color: '#27ae60',
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
