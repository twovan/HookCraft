'use client';

import { useEffect, useState } from 'react';
import { TIER_CONFIGS } from '@/config/tierConfig';

interface PriceConfig {
  tier: string;
  name?: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

const ORDERED_TIERS = ['free', 'pro', 'business'] as const;

const TIER_LABELS: Record<string, string> = {
  free: '免费版 Free',
  pro: '专业版 Pro',
  business: '商业版 Business',
};

function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function normalizePricingConfig(pricing: PriceConfig[]): PriceConfig[] {
  const pricingByTier = new Map(pricing.map((price) => [price.tier, price]));

  return ORDERED_TIERS.map((tier) => {
    const existing = pricingByTier.get(tier);
    const defaults = TIER_CONFIGS[tier];

    return {
      tier,
      name: existing?.name?.trim() || defaults.name,
      monthlyPrice: existing?.monthlyPrice ?? defaults.monthlyPrice,
      yearlyPrice: existing?.yearlyPrice ?? defaults.yearlyPrice,
    };
  });
}

export default function AdminPricingPage() {
  const [pricing, setPricing] = useState<PriceConfig[]>([]);
  const [editPricing, setEditPricing] = useState<PriceConfig[]>([]);
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
      const res = await fetch('/api/admin/config/pricing');
      const data = await res.json();
      const normalizedPricing = normalizePricingConfig(data.pricing || []);
      setPricing(normalizedPricing);
      setEditPricing(normalizedPricing);
    } catch {
      // silent
    }
    setLoading(false);
  }

  function handleEdit(tier: string, field: 'name' | 'monthlyPrice' | 'yearlyPrice', value: string | number) {
    setEditPricing((prev) =>
      prev.map((p) => (p.tier === tier ? { ...p, [field]: value } : p))
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const pricingToSave = editPricing.map((price) => ({
        ...price,
        name: price.name?.trim() || TIER_CONFIGS[price.tier as keyof typeof TIER_CONFIGS]?.name || price.tier,
      }));
      const res = await fetch('/api/admin/config/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing: pricingToSave, operatorId: 'admin-001' }),
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
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>会员价格配置</div>
        </div>
        <div style={{ padding: '24px 32px', color: '#888' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <div style={topbar}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>会员价格配置</div>
          <div style={{ fontSize: 12, color: '#999' }}>管理 / 会员价格</div>
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {saved && (
          <div style={successBanner}>✅ 配置已保存，将在 5 秒内生效</div>
        )}

        <div style={card}>
          <div style={cardHeader}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>会员价格</span>
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
                  <th style={th}>套餐名称</th>
                  <th style={th}>月付价格</th>
                  <th style={th}>年付价格</th>
                  {editing && <th style={th}>新套餐名称</th>}
                  {editing && <th style={th}>新月付价格（分）</th>}
                  {editing && <th style={th}>新年付价格（分）</th>}
                </tr>
              </thead>
              <tbody>
                {pricing.map((p) => (
                  <tr key={p.tier}>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{TIER_LABELS[p.tier] || p.tier}</span>
                    </td>
                    <td style={td}>{p.name || TIER_LABELS[p.tier] || p.tier}</td>
                    <td style={td}>{formatPrice(p.monthlyPrice)}/月</td>
                    <td style={td}>{formatPrice(p.yearlyPrice)}/年</td>
                    {editing && (
                      <>
                        <td style={td}>
                          <input
                            type="text"
                            value={editPricing.find((e) => e.tier === p.tier)?.name ?? ''}
                            onChange={(e) =>
                              handleEdit(p.tier, 'name', e.target.value)
                            }
                            style={{ ...formInput, width: 180 }}
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="number"
                            min={0}
                            value={editPricing.find((e) => e.tier === p.tier)?.monthlyPrice ?? 0}
                            onChange={(e) =>
                              handleEdit(p.tier, 'monthlyPrice', parseInt(e.target.value) || 0)
                            }
                            style={formInput}
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="number"
                            min={0}
                            value={editPricing.find((e) => e.tier === p.tier)?.yearlyPrice ?? 0}
                            onChange={(e) =>
                              handleEdit(p.tier, 'yearlyPrice', parseInt(e.target.value) || 0)
                            }
                            style={formInput}
                          />
                        </td>
                      </>
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
                    setEditPricing(pricing);
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
