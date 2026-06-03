'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CreditOperationType } from '@/types/credits';

interface CostRule {
  operation: CreditOperationType;
  cost: number;
  description: string;
  actualCostCents?: number;
  profitMarginPercent?: number;
  suggestedCost?: number;
  enabled?: boolean;
}

const OP_LABELS: Partial<Record<CreditOperationType, string>> = {
  preview: 'Preview 试听创作',
  full_demo_short: '完整 Demo（短版）',
  full_demo_long: '完整 Demo（长版）',
  premium_singer: '高级声线加价',
  export_wav: 'WAV 导出',
  export_stems: '分轨导出',
  arrangement_generation: '上传音频生成编曲',
  cover_generation: 'AI 翻唱 / Upload Cover',
  add_instrumental: 'AI 加伴奏',
  stem_split: 'AI 分轨',
  ai_preprocess: 'AI 预处理 / 音频分析',
  purchase: '购买入账',
};

const CATEGORY_LABELS: Record<string, string> = {
  creation: '创作',
  edit: '编辑',
  export: '导出',
  system: '系统',
};

function getCategory(operation: CreditOperationType): keyof typeof CATEGORY_LABELS {
  if (['preview', 'full_demo_short', 'full_demo_long', 'premium_singer'].includes(operation)) return 'creation';
  if (['arrangement_generation', 'cover_generation', 'add_instrumental', 'stem_split', 'ai_preprocess'].includes(operation)) return 'edit';
  if (['export_wav', 'export_stems'].includes(operation)) return 'export';
  return 'system';
}

function suggestCredits(actualCostCents: number, profitMarginPercent: number, creditUnitPriceCents: number): number {
  if (actualCostCents <= 0 || creditUnitPriceCents <= 0) return 0;
  return Math.ceil((actualCostCents * (1 + profitMarginPercent / 100)) / creditUnitPriceCents);
}

export default function AdminCostRulesPage() {
  const [rules, setRules] = useState<CostRule[]>([]);
  const [editRules, setEditRules] = useState<CostRule[]>([]);
  const [creditUnitPriceCents, setCreditUnitPriceCents] = useState(100);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const groupedRules = useMemo(() => {
    return editRules.reduce<Record<string, CostRule[]>>((groups, rule) => {
      const category = getCategory(rule.operation);
      groups[category] = groups[category] || [];
      groups[category].push(rule);
      return groups;
    }, {});
  }, [editRules]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config/cost-rules');
      const data = await res.json();
      const nextRules = (data.costRules || []).map((rule: CostRule) => ({
        ...rule,
        enabled: rule.enabled !== false,
      }));
      setRules(nextRules);
      setEditRules(nextRules);
    } finally {
      setLoading(false);
    }
  }

  function updateRule(operation: CreditOperationType, patch: Partial<CostRule>) {
    setEditRules((prev) =>
      prev.map((rule) => {
        if (rule.operation !== operation) return rule;
        const next = { ...rule, ...patch };
        next.suggestedCost = suggestCredits(
          next.actualCostCents || 0,
          next.profitMarginPercent || 0,
          creditUnitPriceCents,
        );
        return next;
      })
    );
  }

  function applyQuickPricing(operation: CreditOperationType) {
    const rule = editRules.find((item) => item.operation === operation);
    if (!rule) return;
    const suggested = suggestCredits(
      rule.actualCostCents || 0,
      rule.profitMarginPercent || 0,
      creditUnitPriceCents,
    );
    updateRule(operation, { cost: suggested, suggestedCost: suggested });
  }

  function applyAllQuickPricing() {
    setEditRules((prev) =>
      prev.map((rule) => {
        const suggested = suggestCredits(
          rule.actualCostCents || 0,
          rule.profitMarginPercent || 0,
          creditUnitPriceCents,
        );
        return suggested > 0 ? { ...rule, cost: suggested, suggestedCost: suggested } : rule;
      })
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/config/cost-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costRules: editRules }),
      });
      if (res.ok) {
        setSaved(true);
        setEditing(false);
        await fetchData();
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={pageContainer}>
        <div style={topbar}>
          <div style={title}>Credits 消耗规则</div>
        </div>
        <div style={{ padding: '24px 32px', color: '#888' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <div style={topbar}>
        <div>
          <div style={title}>AI 操作定价</div>
          <div style={subtitle}>按实际成本和利润率快速生成 Credits 定价</div>
        </div>
        {!editing && <button style={btnPrimary} onClick={() => setEditing(true)}>编辑配置</button>}
      </div>

      <div style={{ padding: '24px 32px' }}>
        {saved && <div style={successBanner}>配置已保存</div>}

        <div style={toolbar}>
          <label style={fieldLabel}>每 1 Credit 对应收入（分）</label>
          <input
            type="number"
            min={1}
            value={creditUnitPriceCents}
            disabled={!editing}
            onChange={(event) => setCreditUnitPriceCents(Math.max(1, Number(event.target.value) || 1))}
            style={smallInput}
          />
          {editing && <button style={btnSecondary} onClick={applyAllQuickPricing}>全部按利润率定价</button>}
        </div>

        {Object.entries(groupedRules).map(([category, items]) => (
          <section key={category} style={section}>
            <div style={sectionTitle}>{CATEGORY_LABELS[category] || category}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>操作</th>
                  <th style={th}>实际成本（分）</th>
                  <th style={th}>利润率</th>
                  <th style={th}>建议价</th>
                  <th style={th}>当前扣除</th>
                  <th style={th}>启用</th>
                  {editing && <th style={th}>操作</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((rule) => (
                  <tr key={rule.operation}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{OP_LABELS[rule.operation] || rule.operation}</div>
                      <div style={muted}>{rule.operation}</div>
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        min={0}
                        value={rule.actualCostCents || 0}
                        disabled={!editing}
                        onChange={(event) => updateRule(rule.operation, { actualCostCents: Number(event.target.value) || 0 })}
                        style={smallInput}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="number"
                        min={0}
                        value={rule.profitMarginPercent || 0}
                        disabled={!editing}
                        onChange={(event) => updateRule(rule.operation, { profitMarginPercent: Number(event.target.value) || 0 })}
                        style={smallInput}
                      />
                      <span style={muted}>%</span>
                    </td>
                    <td style={td}>{suggestCredits(rule.actualCostCents || 0, rule.profitMarginPercent || 0, creditUnitPriceCents)} Credits</td>
                    <td style={td}>
                      <input
                        type="number"
                        min={0}
                        value={rule.cost}
                        disabled={!editing}
                        onChange={(event) => updateRule(rule.operation, { cost: Number(event.target.value) || 0 })}
                        style={smallInput}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={rule.enabled !== false}
                        disabled={!editing || rule.operation === 'purchase'}
                        onChange={(event) => updateRule(rule.operation, { enabled: event.target.checked })}
                      />
                    </td>
                    {editing && (
                      <td style={td}>
                        <button style={btnSecondary} onClick={() => applyQuickPricing(rule.operation)}>应用建议价</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {editing && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
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
  );
}

const pageContainer: React.CSSProperties = { minHeight: '100vh', background: '#f7f8fa' };
const topbar: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: '#fff',
  minHeight: 60,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 32px',
  borderBottom: '1px solid #e8e8e8',
};
const title: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#1a1a2e' };
const subtitle: React.CSSProperties = { fontSize: 12, color: '#777', marginTop: 4 };
const toolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: '#fff',
  border: '1px solid #ececec',
  borderRadius: 8,
  padding: '14px 16px',
  marginBottom: 16,
};
const section: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ececec',
  borderRadius: 8,
  marginBottom: 16,
  overflow: 'hidden',
};
const sectionTitle: React.CSSProperties = { padding: '14px 16px', fontWeight: 700, borderBottom: '1px solid #f0f0f0' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 12, color: '#666', background: '#fafafa' };
const td: React.CSSProperties = { padding: '12px', borderTop: '1px solid #f5f5f5', fontSize: 13, verticalAlign: 'middle' };
const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#333' };
const muted: React.CSSProperties = { fontSize: 12, color: '#888', marginTop: 4 };
const smallInput: React.CSSProperties = { width: 96, padding: '7px 9px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 };
const btnPrimary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#1f2937',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: '#f3f4f6',
  color: '#111827',
  border: '1px solid #e5e7eb',
};
const successBanner: React.CSSProperties = {
  padding: '12px 16px',
  background: '#ecfdf5',
  color: '#047857',
  borderRadius: 8,
  marginBottom: 16,
};
