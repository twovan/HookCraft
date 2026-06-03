'use client';

import { useState, useEffect } from 'react';
import {
  DEFAULT_STUDIO_TAB_SETTINGS,
  STUDIO_TAB_OPTIONS,
  type StudioTab,
  type StudioTabSettings,
} from '@/config/studioTabs';
import {
  DEFAULT_STEM_EDITOR_FEATURE_SETTINGS,
  normalizeStemEditorFeatureSettings,
  type StemEditorFeatureSettings,
} from '@/config/stemEditorFeatures';

interface BasicSettings {
  platformName: string;
  platformDescription: string;
  contactEmail: string;
  icpNumber: string;
}

interface TransactionSettings {
  commissionRate: number;
  minWithdrawalAmount: number;
  settlementCycleDays: number;
  enabledPaymentMethods: string[];
}

interface AISettings {
  modelVersion: string;
  maxConcurrentGenerations: number;
  generationTimeoutSeconds: number;
  creditsResetSchedule: string;
}

interface ReviewSettings {
  trustedProducerAutoApprove: boolean;
  aiContentSafetyPreCheck: boolean;
  reviewTimeoutReminderHours: number;
  notificationMethods: string[];
}

const STEM_EDITOR_FEATURE_GROUPS = [
  {
    group: 'modes',
    title: 'Entry and modes',
    items: [
      ['basicEditor', 'Basic editor'],
      ['proEditor', 'Pro editor'],
      ['showCreditConfirm', 'Credit confirmation'],
      ['allowUpgradeFromBasic', 'Upgrade from basic'],
      ['allowForceRefresh', 'Allow re-analysis'],
    ],
  },
  {
    group: 'stems',
    title: 'Stem separation',
    items: [
      ['separateVocal', '2 tracks: vocal + instrumental'],
      ['splitStem', '12 stem groups result'],
    ],
  },
  {
    group: 'editing',
    title: 'Editing tools',
    items: [
      ['splitClip', 'Split clip'],
      ['deleteClip', 'Delete clip'],
      ['copyCutPaste', 'Copy / cut / paste'],
      ['clipDrag', 'Clip drag'],
      ['crossTrackDrag', 'Cross-track drag'],
      ['snap', 'Snap'],
      ['zoom', 'Timeline zoom'],
      ['trim', 'Trim in / out'],
      ['fade', 'Fade in / out'],
      ['pan', 'Pan'],
      ['muteRanges', 'Mute selection'],
      ['loopPreview', 'Loop preview'],
    ],
  },
  {
    group: 'advanced',
    title: 'Advanced production',
    items: [
      ['addTrack', 'Add empty track'],
      ['importAudio', 'Import custom audio'],
      ['recording', 'Live recording'],
      ['recordingDeviceSelect', 'Recording device'],
      ['recordingChannelSelect', 'Recording channel'],
      ['recordingInputLevel', 'Input level'],
      ['recordingMonitoring', 'Monitoring'],
      ['trackRename', 'Track rename'],
      ['trackColor', 'Track color'],
      ['trackReorder', 'Track reorder'],
      ['trackViewFilter', 'Track filter'],
      ['trackDensity', 'Track density'],
      ['shortcutHelp', 'Shortcut help'],
    ],
  },
  {
    group: 'export',
    title: 'Export permissions',
    items: [
      ['mp3Mix', 'Export mix MP3'],
      ['mp3Stems', 'Export stems MP3'],
      ['wavMix', 'Export mix WAV'],
      ['wavStems', 'Export stems WAV'],
      ['soloOnly', 'Solo-only export'],
      ['advancedExportModes', 'Advanced export modes'],
      ['exportHistory', 'Export history'],
    ],
  },
] as const;

export default function AdminSettingsPage() {
  const [basic, setBasic] = useState<BasicSettings>({ platformName: '', platformDescription: '', contactEmail: '', icpNumber: '' });
  const [transaction, setTransaction] = useState<TransactionSettings>({ commissionRate: 30, minWithdrawalAmount: 100, settlementCycleDays: 30, enabledPaymentMethods: [] });
  const [ai, setAI] = useState<AISettings>({ modelVersion: '', maxConcurrentGenerations: 10, generationTimeoutSeconds: 300, creditsResetSchedule: '' });
  const [review, setReview] = useState<ReviewSettings>({ trustedProducerAutoApprove: false, aiContentSafetyPreCheck: true, reviewTimeoutReminderHours: 24, notificationMethods: [] });
  const [studioTabs, setStudioTabs] = useState<StudioTabSettings>(DEFAULT_STUDIO_TAB_SETTINGS);
  const [stemEditorFeatures, setStemEditorFeatures] = useState<StemEditorFeatureSettings>(DEFAULT_STEM_EDITOR_FEATURE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('请求失败');
      const data = await res.json();
      setBasic(data.basic);
      setTransaction(data.transaction);
      setAI(data.aiGeneration);
      setReview(data.review);
      setStudioTabs(data.studioTabs || DEFAULT_STUDIO_TAB_SETTINGS);
      setStemEditorFeatures(normalizeStemEditorFeatureSettings(data.stemEditorFeatures));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function saveSection(section: string, value: any) {
    setSaving(section);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || '保存失败');
      setToast('设置已保存');
      setTimeout(() => setToast(''), 3000);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      setSaving(null);
    }
  }

  function togglePaymentMethod(method: string) {
    setTransaction((prev) => ({
      ...prev,
      enabledPaymentMethods: prev.enabledPaymentMethods.includes(method)
        ? prev.enabledPaymentMethods.filter((m) => m !== method)
        : [...prev.enabledPaymentMethods, method],
    }));
  }

  function toggleNotification(method: string) {
    setReview((prev) => ({
      ...prev,
      notificationMethods: prev.notificationMethods.includes(method)
        ? prev.notificationMethods.filter((m) => m !== method)
        : [...prev.notificationMethods, method],
    }));
  }

  function toggleStudioTab(tab: StudioTab) {
    setStudioTabs((prev) => {
      const visibleTabs = prev.visibleTabs.includes(tab)
        ? prev.visibleTabs.filter((item) => item !== tab)
        : STUDIO_TAB_OPTIONS
          .map((item) => item.id)
          .filter((item) => item === tab || prev.visibleTabs.includes(item));
      const defaultTab = visibleTabs.includes(prev.defaultTab)
        ? prev.defaultTab
        : visibleTabs[0] || prev.defaultTab;

      return { visibleTabs, defaultTab };
    });
  }

  function toggleStemEditorFeature(
    tier: keyof StemEditorFeatureSettings,
    group: 'modes' | 'stems' | 'editing' | 'advanced' | 'export',
    key: string,
  ) {
    setStemEditorFeatures((prev) => {
      const tierSettings = prev[tier] as any;
      return normalizeStemEditorFeatureSettings({
        ...prev,
        [tier]: {
          ...tierSettings,
          [group]: {
            ...tierSettings[group],
            [key]: !tierSettings[group][key],
          },
        },
      });
    });
  }

  if (loading) {
    return <div style={{ padding: 24, color: '#6b7280' }}>加载中...</div>;
  }

  return (
    <div>
      {/* Toast */}
      {toast && <div style={toastStyle}>✅ {toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Basic Settings */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>基本设置</h3>
          <div style={formGroupStyle}>
            <label style={labelStyle}>平台名称</label>
            <input style={inputStyle} value={basic.platformName} onChange={(e) => setBasic((p) => ({ ...p, platformName: e.target.value }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>平台描述</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={basic.platformDescription} onChange={(e) => setBasic((p) => ({ ...p, platformDescription: e.target.value }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>联系邮箱</label>
            <input style={inputStyle} type="email" value={basic.contactEmail} onChange={(e) => setBasic((p) => ({ ...p, contactEmail: e.target.value }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>ICP 备案号</label>
            <input style={inputStyle} value={basic.icpNumber} onChange={(e) => setBasic((p) => ({ ...p, icpNumber: e.target.value }))} />
          </div>
          <button onClick={() => saveSection('basic', basic)} disabled={saving === 'basic'} style={saveBtnStyle}>
            {saving === 'basic' ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* Transaction Settings */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>交易设置</h3>
          <div style={formGroupStyle}>
            <label style={labelStyle}>平台佣金比例 (%)</label>
            <input style={inputStyle} type="number" value={transaction.commissionRate} onChange={(e) => setTransaction((p) => ({ ...p, commissionRate: parseInt(e.target.value) || 0 }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>最低提现金额 (元)</label>
            <input style={inputStyle} type="number" value={transaction.minWithdrawalAmount} onChange={(e) => setTransaction((p) => ({ ...p, minWithdrawalAmount: parseInt(e.target.value) || 0 }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>结算周期 (天)</label>
            <input style={inputStyle} type="number" value={transaction.settlementCycleDays} onChange={(e) => setTransaction((p) => ({ ...p, settlementCycleDays: parseInt(e.target.value) || 0 }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>支付方式</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['wechat', 'alipay', 'stripe', 'paypal'].map((method) => (
                <label key={method} style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={transaction.enabledPaymentMethods.includes(method)}
                    onChange={() => togglePaymentMethod(method)}
                  />
                  <span>{method === 'wechat' ? '微信支付' : method === 'alipay' ? '支付宝' : method === 'stripe' ? 'Stripe' : 'PayPal'}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={() => saveSection('transaction', transaction)} disabled={saving === 'transaction'} style={saveBtnStyle}>
            {saving === 'transaction' ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* AI Generation Settings */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>AI 生成设置</h3>
          <div style={formGroupStyle}>
            <label style={labelStyle}>AI 模型版本</label>
            <select style={inputStyle} value={ai.modelVersion} onChange={(e) => setAI((p) => ({ ...p, modelVersion: e.target.value }))}>
              <option value="v1.0">v1.0</option>
              <option value="v2.0">v2.0</option>
              <option value="v3.0-beta">v3.0-beta</option>
            </select>
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>最大并发生成数</label>
            <input style={inputStyle} type="number" value={ai.maxConcurrentGenerations} onChange={(e) => setAI((p) => ({ ...p, maxConcurrentGenerations: parseInt(e.target.value) || 0 }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>生成超时时间 (秒)</label>
            <input style={inputStyle} type="number" value={ai.generationTimeoutSeconds} onChange={(e) => setAI((p) => ({ ...p, generationTimeoutSeconds: parseInt(e.target.value) || 0 }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>积分重置周期</label>
            <input style={inputStyle} value={ai.creditsResetSchedule} onChange={(e) => setAI((p) => ({ ...p, creditsResetSchedule: e.target.value }))} placeholder="每月1日 00:00" />
          </div>
          <button onClick={() => saveSection('ai_generation', ai)} disabled={saving === 'ai_generation'} style={saveBtnStyle}>
            {saving === 'ai_generation' ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* Review Settings */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>审核设置</h3>
          <div style={formGroupStyle}>
            <label style={checkboxLabelStyle}>
              <input type="checkbox" checked={review.trustedProducerAutoApprove} onChange={(e) => setReview((p) => ({ ...p, trustedProducerAutoApprove: e.target.checked }))} />
              <span>信任制作人自动通过</span>
            </label>
          </div>
          <div style={formGroupStyle}>
            <label style={checkboxLabelStyle}>
              <input type="checkbox" checked={review.aiContentSafetyPreCheck} onChange={(e) => setReview((p) => ({ ...p, aiContentSafetyPreCheck: e.target.checked }))} />
              <span>AI 内容安全预检</span>
            </label>
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>审核超时提醒 (小时)</label>
            <input style={inputStyle} type="number" value={review.reviewTimeoutReminderHours} onChange={(e) => setReview((p) => ({ ...p, reviewTimeoutReminderHours: parseInt(e.target.value) || 0 }))} />
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>通知方式</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ key: 'in_app', label: '站内通知' }, { key: 'email', label: '邮件' }, { key: 'sms', label: '短信' }].map((m) => (
                <label key={m.key} style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={review.notificationMethods.includes(m.key)}
                    onChange={() => toggleNotification(m.key)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={() => saveSection('review', review)} disabled={saving === 'review'} style={saveBtnStyle}>
            {saving === 'review' ? '保存中...' : '保存设置'}
          </button>
        </div>
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Studio Tab 设置</h3>
          <div style={formGroupStyle}>
            <label style={labelStyle}>显示 Tab</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STUDIO_TAB_OPTIONS.map((tab) => (
                <label key={tab.id} style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={studioTabs.visibleTabs.includes(tab.id)}
                    onChange={() => toggleStudioTab(tab.id)}
                  />
                  <span>{tab.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={formGroupStyle}>
            <label style={labelStyle}>默认 Tab</label>
            <select
              style={inputStyle}
              value={studioTabs.defaultTab}
              onChange={(e) => setStudioTabs((prev) => ({ ...prev, defaultTab: e.target.value as StudioTab }))}
              disabled={studioTabs.visibleTabs.length === 0}
            >
              {STUDIO_TAB_OPTIONS
                .filter((tab) => studioTabs.visibleTabs.includes(tab.id))
                .map((tab) => (
                  <option key={tab.id} value={tab.id}>{tab.label}</option>
                ))}
            </select>
          </div>
          <button
            onClick={() => saveSection('studio_tabs', studioTabs)}
            disabled={saving === 'studio_tabs' || studioTabs.visibleTabs.length === 0}
            style={saveBtnStyle}
          >
            {saving === 'studio_tabs' ? '保存中...' : '保存设置'}
          </button>
        </div>
        <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
          <h3 style={cardTitleStyle}>Stem Editor Feature Switches</h3>
          <div style={editorMatrixStyle}>
            <div style={editorMatrixHeaderStyle}>Feature</div>
            <div style={editorMatrixHeaderStyle}>Plus / Basic</div>
            <div style={editorMatrixHeaderStyle}>Pro / Professional</div>
            {STEM_EDITOR_FEATURE_GROUPS.map((group) => (
              <div key={group.group} style={editorMatrixGroupStyle}>
                <div style={editorMatrixGroupTitleStyle}>{group.title}</div>
                {group.items.map(([key, label]) => (
                  <div key={`${group.group}-${key}`} style={editorMatrixRowStyle}>
                    <div>{label}</div>
                    {(['plus', 'pro'] as const).map((tier) => (
                      <label key={tier} style={editorMatrixCheckboxStyle}>
                        <input
                          type="checkbox"
                          checked={Boolean((stemEditorFeatures[tier] as any)[group.group][key])}
                          onChange={() => toggleStemEditorFeature(tier, group.group, key)}
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={editorMatrixActionsStyle}>
            <button
              onClick={() => setStemEditorFeatures(DEFAULT_STEM_EDITOR_FEATURE_SETTINGS)}
              disabled={saving === 'stem_editor_features'}
              style={secondaryBtnStyle}
            >
              Reset defaults
            </button>
            <button
              onClick={() => saveSection('stem_editor_features', stemEditorFeatures)}
              disabled={saving === 'stem_editor_features'}
              style={saveBtnStyle}
            >
              {saving === 'stem_editor_features' ? 'Saving...' : 'Save editor switches'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
};

const cardTitleStyle: React.CSSProperties = {
  margin: '0 0 16px 0',
  fontSize: 16,
  fontWeight: 600,
  color: '#1f2937',
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: 14,
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

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: '#374151',
  cursor: 'pointer',
};

const saveBtnStyle: React.CSSProperties = {
  marginTop: 8,
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

const secondaryBtnStyle: React.CSSProperties = {
  ...saveBtnStyle,
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #e5e7eb',
};

const editorMatrixStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1fr) 160px 160px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  overflow: 'hidden',
};

const editorMatrixHeaderStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: '#f9fafb',
  color: '#374151',
  fontSize: 13,
  fontWeight: 700,
  borderBottom: '1px solid #e5e7eb',
};

const editorMatrixGroupStyle: React.CSSProperties = {
  display: 'contents',
};

const editorMatrixGroupTitleStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '9px 12px',
  background: '#fff7ed',
  color: '#92400e',
  fontSize: 13,
  fontWeight: 700,
  borderTop: '1px solid #e5e7eb',
  borderBottom: '1px solid #e5e7eb',
};

const editorMatrixRowStyle: React.CSSProperties = {
  display: 'grid',
  gridColumn: '1 / -1',
  gridTemplateColumns: 'minmax(220px, 1fr) 160px 160px',
  alignItems: 'center',
  minHeight: 38,
  padding: '0 12px',
  borderBottom: '1px solid #f3f4f6',
  color: '#374151',
  fontSize: 13,
};

const editorMatrixCheckboxStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};

const editorMatrixActionsStyle: React.CSSProperties = {
  marginTop: 14,
  display: 'flex',
  gap: 10,
  justifyContent: 'flex-end',
};

const toastStyle: React.CSSProperties = {
  position: 'fixed',
  top: 80,
  right: 24,
  padding: '12px 20px',
  background: '#e8f8f0',
  color: '#16a34a',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  zIndex: 9999,
};
