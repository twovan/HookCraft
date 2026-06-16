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
import {
  DEFAULT_HOME_HERO_BACKGROUND_URL,
  normalizeHomepageHeroSettings,
  updateHomepageHeroHistory,
  type HomepageHeroSettings,
} from '@/lib/homepage/heroSettings';
import {
  CONTENT_PAGE_SLUGS,
  DEFAULT_CONTENT_PAGES,
  normalizeContentPagesSettings,
  type ContentPageSlug,
  type ContentPagesSettings,
} from '@/lib/contentPages';
import { compressImageForUpload, formatBytes } from '@/lib/image/browserCompression';

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
    title: '入口与模式',
    description: '控制基础编辑器和专业编辑器的入口，以及是否允许重新分析、升级引导和积分确认。',
    items: [
      ['basicEditor', '基础编辑器入口'],
      ['proEditor', '专业编辑器入口'],
      ['showCreditConfirm', '积分确认弹窗'],
      ['allowUpgradeFromBasic', '基础编辑器升级引导'],
      ['allowForceRefresh', '允许重新分析'],
    ],
  },
  {
    group: 'stems',
    title: '分轨能力',
    description: '控制云端分轨时的能力边界：基础编辑器为人声 + 伴奏，专业编辑器使用分析结果中的多分轨组。',
    items: [
      ['separateVocal', '2 轨分离：人声 + 伴奏'],
      ['splitStem', '多分轨分析结果'],
    ],
  },
  {
    group: 'editing',
    title: '基础剪辑',
    description: '控制每个编辑器面板内的高频剪辑操作；关闭后会同步影响按钮、快捷键和画布操作。',
    items: [
      ['playback', '播放与预听'],
      ['trackVolume', '轨道音量'],
      ['muteSolo', '静音 / 独奏'],
      ['splitClip', '切分片段'],
      ['deleteClip', '删除片段'],
      ['copyCutPaste', '复制 / 剪切 / 粘贴'],
      ['clipDrag', '片段拖拽'],
      ['crossTrackDrag', '跨轨拖拽'],
      ['snap', '磁吸对齐'],
      ['zoom', '时间线缩放'],
      ['trim', '入点 / 出点裁剪'],
      ['fade', '淡入 / 淡出'],
      ['pan', '声像调节'],
      ['previewSelection', '预听选区'],
      ['muteRanges', '静音选区'],
      ['followPlayhead', '跟随播放头'],
      ['loopPreview', '循环预听'],
      ['undoRedo', '撤销 / 重做'],
      ['autoSave', '自动保存工程'],
      ['localDraftRecovery', '本地草稿恢复'],
    ],
  },
  {
    group: 'advanced',
    title: '高级制作',
    description: '控制专业制作能力，适合需要自定义轨道、录音、轨道管理和高级视图的编辑器面板。',
    items: [
      ['addTrack', '添加空轨道'],
      ['importAudio', '导入自定义音频'],
      ['recording', '现场录音'],
      ['recordingDeviceSelect', '选择录音设备'],
      ['recordingChannelSelect', '选择录音声道'],
      ['recordingInputLevel', '输入电平显示'],
      ['recordingMonitoring', '录音监听'],
      ['trackRename', '轨道重命名'],
      ['trackColor', '轨道颜色'],
      ['trackReorder', '轨道排序'],
      ['trackViewFilter', '轨道视图筛选'],
      ['trackDensity', '轨道密度切换'],
      ['shortcutHelp', '快捷键帮助'],
    ],
  },
  {
    group: 'export',
    title: '导出权限',
    description: '基础编辑器通常只开放 MP3；专业编辑器可开放 WAV、独奏导出、高级导出模式和导出历史。',
    items: [
      ['mp3Mix', '导出混音 MP3'],
      ['mp3Stems', '批量导出分轨 MP3'],
      ['wavMix', '导出混音 WAV'],
      ['wavStems', '导出分轨 WAV'],
      ['soloOnly', '只导出独奏'],
      ['advancedExportModes', '高级导出模式'],
      ['exportHistory', '导出历史'],
    ],
  },
] as const;

const HERO_IMAGE_MAX_EDGE = 1920;
const HERO_IMAGE_TARGET_BYTES = 1200 * 1024;
const HERO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

async function compressHeroImage(file: File): Promise<File> {
  return compressImageForUpload(file, {
    maxEdge: HERO_IMAGE_MAX_EDGE,
    targetBytes: HERO_IMAGE_TARGET_BYTES,
    maxBytes: HERO_IMAGE_MAX_BYTES,
    outputName: 'homepage-hero.webp',
  });
}

function countEnabledFeatures(settings: StemEditorFeatureSettings[keyof StemEditorFeatureSettings]) {
  return STEM_EDITOR_FEATURE_GROUPS.reduce((total, group) => (
    total + group.items.filter(([key]) => Boolean((settings as any)[group.group][key])).length
  ), 0);
}

function getEditorPanelLabel(tier: keyof StemEditorFeatureSettings) {
  return tier === 'basicEditor' ? '基础编辑器' : '专业编辑器';
}

export default function AdminSettingsClient({ view = 'system' }: { view?: 'system' | 'editor' }) {
  const [basic, setBasic] = useState<BasicSettings>({ platformName: '', platformDescription: '', contactEmail: '', icpNumber: '' });
  const [transaction, setTransaction] = useState<TransactionSettings>({ commissionRate: 30, minWithdrawalAmount: 100, settlementCycleDays: 30, enabledPaymentMethods: [] });
  const [ai, setAI] = useState<AISettings>({ modelVersion: '', maxConcurrentGenerations: 10, generationTimeoutSeconds: 300, creditsResetSchedule: '' });
  const [review, setReview] = useState<ReviewSettings>({ trustedProducerAutoApprove: false, aiContentSafetyPreCheck: true, reviewTimeoutReminderHours: 24, notificationMethods: [] });
  const [homepageHero, setHomepageHero] = useState<HomepageHeroSettings>(normalizeHomepageHeroSettings(undefined));
  const [contentPages, setContentPages] = useState<ContentPagesSettings>(DEFAULT_CONTENT_PAGES);
  const [activeContentPage, setActiveContentPage] = useState<ContentPageSlug>('terms');
  const [heroUploadStatus, setHeroUploadStatus] = useState('');
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
      setHomepageHero(normalizeHomepageHeroSettings(data.homepageHero));
      setContentPages(normalizeContentPagesSettings(data.contentPages));
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

  async function uploadHeroBackground(file: File | undefined) {
    if (!file) return;
    setSaving('homepage_hero_upload');
    setHeroUploadStatus('正在压缩图片...');
    try {
      const compressed = await compressHeroImage(file);
      setHeroUploadStatus(`已压缩到 ${formatBytes(compressed.size)}，正在上传...`);
      const formData = new FormData();
      formData.append('heroImage', compressed);
      const res = await fetch('/api/admin/settings/homepage-hero/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || '上传失败');

      const next = updateHomepageHeroHistory(homepageHero, data.backgroundImageUrl);
      setHomepageHero(next);
      await saveSection('homepage_hero', next);
      setHeroUploadStatus(`上传完成：${formatBytes(compressed.size)}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '上传失败，请重试');
      setHeroUploadStatus('');
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

  function updateContentPage(
    slug: ContentPageSlug,
    field: 'eyebrow' | 'title' | 'summary' | 'updatedAt' | 'body',
    value: string,
  ) {
    setContentPages((prev) => ({
      ...prev,
      [slug]: {
        ...prev[slug],
        [field]: value,
      },
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
      {toast && <div style={toastStyle}>已保存：{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {view === 'system' && (
          <>
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
        <div style={heroManagerCardStyle}>
          <h3 style={cardTitleStyle}>首页视觉</h3>
          <div style={heroManagerLayoutStyle}>
            <div
              style={{
                ...heroPreviewStyle,
                backgroundImage: homepageHero.backgroundImageUrl.trim()
                  ? `${homepageHero.overlayEnabled ? 'linear-gradient(90deg, rgba(5,7,10,.88), rgba(5,7,10,.35)), ' : ''}url("${homepageHero.backgroundImageUrl.replace(/"/g, '\\"')}")`
                  : undefined,
              }}
            >
              <span>HOOKCRAFT ORIGINAL</span>
              <strong>华语音乐 AI Demo 工作站</strong>
              <small>首页首屏背景预览</small>
            </div>
            <div style={heroControlPanelStyle}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>首页首屏背景图 URL</label>
                <input
                  style={inputStyle}
                  value={homepageHero.backgroundImageUrl}
                  onChange={(e) => setHomepageHero((p) => ({ ...p, backgroundImageUrl: e.target.value }))}
                  placeholder="/home-hero-studio.webp 或 https://..."
                />
                <div style={hintStyle}>建议上传 1920px 宽左右的 WebP/JPG，优先压到 1MB 内，最大 5MB。上传会自动压缩为 WebP。</div>
              </div>
              <label style={heroToggleStyle}>
                <input
                  type="checkbox"
                  checked={homepageHero.overlayEnabled}
                  onChange={(e) => setHomepageHero((p) => ({ ...p, overlayEnabled: e.target.checked }))}
                />
                <span>
                  <strong>显示背景蒙层</strong>
                  <small>关闭后首页首屏直接展示原始背景图。</small>
                </span>
              </label>
              <div style={heroActionRowStyle}>
                <label style={heroUploadButtonStyle}>
                  {saving === 'homepage_hero_upload' ? '压缩上传中...' : '上传并压缩'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={saving === 'homepage_hero_upload'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void uploadHeroBackground(file);
                      e.currentTarget.value = '';
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setHomepageHero((p) => updateHomepageHeroHistory(p, DEFAULT_HOME_HERO_BACKGROUND_URL))}
                  style={{ ...secondaryBtnStyle, marginTop: 0 }}
                >
                  恢复默认图
                </button>
                <button
                  onClick={() => {
                    const next = updateHomepageHeroHistory(homepageHero, homepageHero.backgroundImageUrl);
                    setHomepageHero(next);
                    void saveSection('homepage_hero', next);
                  }}
                  disabled={saving === 'homepage_hero'}
                  style={{ ...saveBtnStyle, marginTop: 0 }}
                >
                  {saving === 'homepage_hero' ? '保存中...' : '保存首页视觉'}
                </button>
              </div>
              {heroUploadStatus && <div style={hintStyle}>{heroUploadStatus}</div>}
            </div>
          </div>
          <div style={heroHistorySectionStyle}>
            <div style={heroHistoryHeaderStyle}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>历史背景图</label>
              <span>最多保留 8 张，点击缩略图可恢复到预览，再保存生效。</span>
            </div>
            <div style={heroHistoryGridStyle}>
              {homepageHero.history.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setHomepageHero((p) => updateHomepageHeroHistory(p, url))}
                  style={{
                    ...heroHistoryButtonStyle,
                    borderColor: homepageHero.backgroundImageUrl === url ? '#D4A574' : '#e5e7eb',
                  }}
                  title={url}
                >
                  <span style={{ ...heroHistoryPreviewStyle, backgroundImage: `url("${url.replace(/"/g, '\\"')}")` }} />
                  <span style={heroHistoryMetaStyle}>
                    <strong>{url === DEFAULT_HOME_HERO_BACKGROUND_URL ? '默认图' : `历史 ${index + 1}`}</strong>
                    <small>{homepageHero.backgroundImageUrl === url ? '使用中' : '点击恢复'}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={contentManagerCardStyle}>
          <div style={contentManagerHeaderStyle}>
            <div>
              <p style={contentEyebrowStyle}>Content Pages</p>
              <h3 style={contentTitleStyle}>页脚内容页面</h3>
              <p style={contentDescriptionStyle}>
                管理页脚中的法律与支持页面。正文支持简单格式：使用 “## 标题” 分段，使用 “- ” 创建列表。
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setContentPages(DEFAULT_CONTENT_PAGES);
                setActiveContentPage('terms');
              }}
              disabled={saving === 'content_pages'}
              style={{ ...secondaryBtnStyle, marginTop: 0 }}
            >
              恢复默认文案
            </button>
          </div>

          <div style={contentEditorLayoutStyle}>
            <div style={contentPageListStyle}>
              {CONTENT_PAGE_SLUGS.map((slug) => {
                const page = contentPages[slug];
                const active = activeContentPage === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setActiveContentPage(slug)}
                    style={contentPageButtonStyle(active)}
                  >
                    <strong>{page.navTitle}</strong>
                    <span>{page.group === 'legal' ? '法律' : '支持'}</span>
                  </button>
                );
              })}
            </div>

            <div style={contentEditorPanelStyle}>
              <div style={contentFieldGridStyle}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>眉标</label>
                  <input
                    style={inputStyle}
                    value={contentPages[activeContentPage].eyebrow}
                    onChange={(e) => updateContentPage(activeContentPage, 'eyebrow', e.target.value)}
                  />
                </div>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>更新日期</label>
                  <input
                    style={inputStyle}
                    value={contentPages[activeContentPage].updatedAt}
                    onChange={(e) => updateContentPage(activeContentPage, 'updatedAt', e.target.value)}
                  />
                </div>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>页面标题</label>
                <input
                  style={inputStyle}
                  value={contentPages[activeContentPage].title}
                  onChange={(e) => updateContentPage(activeContentPage, 'title', e.target.value)}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>页面摘要</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 74, resize: 'vertical' }}
                  value={contentPages[activeContentPage].summary}
                  onChange={(e) => updateContentPage(activeContentPage, 'summary', e.target.value)}
                />
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>正文</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 320, resize: 'vertical', lineHeight: 1.7 }}
                  value={contentPages[activeContentPage].body}
                  onChange={(e) => updateContentPage(activeContentPage, 'body', e.target.value)}
                />
                <div style={hintStyle}>示例：## 使用说明；列表项以 - 开头。保存后会同步到前台对应页面。</div>
              </div>

              <div style={contentActionsStyle}>
                <a
                  href={`/${activeContentPage}`}
                  target="_blank"
                  rel="noreferrer"
                  style={contentPreviewLinkStyle}
                >
                  预览前台页面
                </a>
                <button
                  onClick={() => saveSection('content_pages', contentPages)}
                  disabled={saving === 'content_pages'}
                  style={{ ...saveBtnStyle, marginTop: 0 }}
                >
                  {saving === 'content_pages' ? '保存中...' : '保存内容页面'}
                </button>
              </div>
            </div>
          </div>
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
          </>
        )}
        {view === 'editor' && (
        <div style={editorManagerCardStyle}>
          <div style={editorManagerHeaderStyle}>
            <div>
              <p style={editorManagerEyebrowStyle}>Stem 编辑器权限</p>
              <h3 style={editorManagerTitleStyle}>编辑器功能开关</h3>
              <p style={editorManagerDescriptionStyle}>
                这里按编辑器面板控制入口、分轨方式、剪辑工具和导出权限。基础编辑器对应 Plus 用户，专业编辑器对应 Pro 用户；修改后会影响按钮、快捷键、右键菜单和导出模式。
              </p>
            </div>
            <div style={editorSummaryGridStyle}>
              <div style={editorSummaryCardStyle}>
                <span style={editorSummaryLabelStyle}>基础编辑器</span>
                <strong style={editorSummaryValueStyle}>{countEnabledFeatures(stemEditorFeatures.basicEditor)}</strong>
                <span style={editorSummaryMetaStyle}>Plus 用户 / 2 轨编辑 / MP3 导出</span>
              </div>
              <div style={editorSummaryCardStyle}>
                <span style={editorSummaryLabelStyle}>专业编辑器</span>
                <strong style={editorSummaryValueStyle}>{countEnabledFeatures(stemEditorFeatures.proEditor)}</strong>
                <span style={editorSummaryMetaStyle}>Pro 用户 / 分析结果分轨 / 完整工具</span>
              </div>
            </div>
          </div>

          <div style={editorTierLegendStyle}>
            <span style={editorTierPillStyle('#2563eb')}>基础编辑器：面向 Plus 用户，保留基础剪辑，限制高级制作和 WAV</span>
            <span style={editorTierPillStyle('#b45309')}>专业编辑器：面向 Pro 用户，默认开放当前完整编辑器能力</span>
          </div>

          <div style={editorFeatureGridStyle}>
            {STEM_EDITOR_FEATURE_GROUPS.map((group) => (
              <section key={group.group} style={editorFeatureGroupStyle}>
                <div style={editorFeatureGroupHeaderStyle}>
                  <div>
                    <h4 style={editorFeatureGroupTitleStyle}>{group.title}</h4>
                    <p style={editorFeatureGroupDescriptionStyle}>{group.description}</p>
                  </div>
                  <div style={editorFeatureGroupCountStyle}>
                    基础 {group.items.filter(([key]) => Boolean((stemEditorFeatures.basicEditor as any)[group.group][key])).length}
                    {' / '}
                    专业 {group.items.filter(([key]) => Boolean((stemEditorFeatures.proEditor as any)[group.group][key])).length}
                  </div>
                </div>
                <div style={editorFeatureRowsStyle}>
                  {group.items.map(([key, label]) => (
                    <div key={`${group.group}-${key}`} style={editorFeatureRowStyle}>
                      <span style={editorFeatureLabelStyle}>{label}</span>
                      {(['basicEditor', 'proEditor'] as const).map((tier) => {
                        const enabled = Boolean((stemEditorFeatures[tier] as any)[group.group][key]);
                        return (
                          <button
                            key={tier}
                            type="button"
                            aria-pressed={enabled}
                            onClick={() => toggleStemEditorFeature(tier, group.group, key)}
                            style={editorSwitchButtonStyle(enabled)}
                          >
                            <span style={editorSwitchDotStyle(enabled)} />
                            {getEditorPanelLabel(tier)}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div style={editorMatrixActionsStyle}>
            <button
              onClick={() => setStemEditorFeatures(DEFAULT_STEM_EDITOR_FEATURE_SETTINGS)}
              disabled={saving === 'stem_editor_features'}
              style={secondaryBtnStyle}
            >
              恢复默认配置
            </button>
            <button
              onClick={() => saveSection('stem_editor_features', stemEditorFeatures)}
              disabled={saving === 'stem_editor_features'}
              style={saveBtnStyle}
            >
              {saving === 'stem_editor_features' ? '保存中...' : '保存编辑器开关'}
            </button>
          </div>
        </div>
        )}
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

const hintStyle: React.CSSProperties = {
  marginTop: 6,
  color: '#9ca3af',
  fontSize: 12,
  lineHeight: 1.5,
};

const heroManagerCardStyle: React.CSSProperties = {
  ...cardStyle,
  gridColumn: '1 / -1',
  background: 'linear-gradient(135deg, #fffdf8 0%, #ffffff 48%, #f8fafc 100%)',
};

const heroManagerLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
  alignItems: 'stretch',
};

const heroPreviewStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: 214,
  padding: '26px 28px',
  borderRadius: 12,
  border: '1px solid rgba(17,24,39,.18)',
  backgroundColor: '#111827',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  color: '#fff',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)',
};

const heroControlPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  gap: 12,
  padding: 16,
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  background: '#fff',
};

const heroActionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const heroToggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #eef0f3',
  background: '#f9fafb',
  color: '#374151',
  fontSize: 13,
  cursor: 'pointer',
};

const heroUploadButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  marginTop: 0,
  minHeight: 36,
};

const heroHistorySectionStyle: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 16,
  borderTop: '1px solid #eef0f3',
};

const heroHistoryHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
  color: '#9ca3af',
  fontSize: 12,
};

const heroHistoryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
  gap: 10,
};

const heroHistoryButtonStyle: React.CSSProperties = {
  padding: 0,
  overflow: 'hidden',
  borderRadius: 10,
  border: '2px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const heroHistoryPreviewStyle: React.CSSProperties = {
  display: 'block',
  height: 64,
  backgroundColor: '#111827',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
};

const heroHistoryMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  padding: '8px 10px',
  color: '#374151',
  fontSize: 12,
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

const contentManagerCardStyle: React.CSSProperties = {
  ...cardStyle,
  gridColumn: '1 / -1',
  padding: 0,
  overflow: 'hidden',
  background: '#fbfaf7',
};

const contentManagerHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 18,
  padding: '22px 24px',
  borderBottom: '1px solid #e7e2d8',
  background: 'linear-gradient(135deg, #fffdf8 0%, #f7efe4 100%)',
};

const contentEyebrowStyle: React.CSSProperties = {
  margin: '0 0 6px',
  color: '#b45309',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0,
};

const contentTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#1f2937',
  fontSize: 20,
  fontWeight: 800,
};

const contentDescriptionStyle: React.CSSProperties = {
  margin: '10px 0 0',
  maxWidth: 680,
  color: '#5f6470',
  fontSize: 13,
  lineHeight: 1.7,
};

const contentEditorLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr)',
  gap: 18,
  padding: 24,
};

const contentPageListStyle: React.CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
};

function contentPageButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 44,
    padding: '10px 12px',
    borderRadius: 8,
    border: active ? '1px solid #D4A574' : '1px solid #e7e2d8',
    background: active ? '#fff7ed' : '#fff',
    color: active ? '#92400e' : '#374151',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };
}

const contentEditorPanelStyle: React.CSSProperties = {
  border: '1px solid #e7e2d8',
  borderRadius: 8,
  background: '#fff',
  padding: 18,
};

const contentFieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 180px',
  gap: 12,
};

const contentActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 10,
};

const contentPreviewLinkStyle: React.CSSProperties = {
  ...secondaryBtnStyle,
  marginTop: 0,
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
};

const editorManagerCardStyle: React.CSSProperties = {
  ...cardStyle,
  gridColumn: '1 / -1',
  scrollMarginTop: 88,
  padding: 0,
  overflow: 'hidden',
  background: '#fbfaf7',
};

const editorManagerHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 360px',
  gap: 20,
  padding: '22px 24px',
  borderBottom: '1px solid #e7e2d8',
  background: 'linear-gradient(135deg, #fffdf8 0%, #f7efe4 100%)',
};

const editorManagerEyebrowStyle: React.CSSProperties = {
  margin: '0 0 6px',
  color: '#b45309',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0,
};

const editorManagerTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#1f2937',
  fontSize: 20,
  fontWeight: 800,
};

const editorManagerDescriptionStyle: React.CSSProperties = {
  margin: '10px 0 0',
  maxWidth: 720,
  color: '#5f6470',
  fontSize: 13,
  lineHeight: 1.7,
};

const editorSummaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

const editorSummaryCardStyle: React.CSSProperties = {
  border: '1px solid #e5dece',
  borderRadius: 8,
  background: 'rgba(255, 255, 255, 0.72)',
  padding: '14px 16px',
};

const editorSummaryLabelStyle: React.CSSProperties = {
  display: 'block',
  color: '#6b7280',
  fontSize: 12,
  fontWeight: 700,
};

const editorSummaryValueStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 5,
  color: '#111827',
  fontSize: 28,
  lineHeight: 1,
};

const editorSummaryMetaStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 8,
  color: '#7c6f5b',
  fontSize: 12,
};

const editorTierLegendStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  padding: '14px 24px 0',
};

function editorTierPillStyle(color: string): React.CSSProperties {
  return {
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${color}22`,
    background: `${color}0d`,
    color,
    fontSize: 12,
    fontWeight: 700,
  };
}

const editorFeatureGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
  padding: 24,
};

const editorFeatureGroupStyle: React.CSSProperties = {
  border: '1px solid #e7e2d8',
  borderRadius: 8,
  background: '#fff',
  overflow: 'hidden',
};

const editorFeatureGroupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  background: '#f9f6ef',
  borderBottom: '1px solid #ece5d8',
};

const editorFeatureGroupTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#1f2937',
  fontSize: 14,
  fontWeight: 800,
};

const editorFeatureGroupDescriptionStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#6b7280',
  fontSize: 12,
  lineHeight: 1.6,
};

const editorFeatureGroupCountStyle: React.CSSProperties = {
  flex: '0 0 auto',
  color: '#92400e',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const editorFeatureRowsStyle: React.CSSProperties = {
  display: 'grid',
};

const editorFeatureRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 1fr) 116px 116px',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  padding: '8px 12px 8px 16px',
  borderBottom: '1px solid #f3f0ea',
};

const editorFeatureLabelStyle: React.CSSProperties = {
  color: '#374151',
  fontSize: 13,
  fontWeight: 600,
};

function editorSwitchButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 28,
    padding: '0 10px',
    borderRadius: 8,
    border: enabled ? '1px solid #2f7d58' : '1px solid #d1d5db',
    background: enabled ? '#e7f5ee' : '#f9fafb',
    color: enabled ? '#166534' : '#6b7280',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  };
}

function editorSwitchDotStyle(enabled: boolean): React.CSSProperties {
  return {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: enabled ? '#16a34a' : '#cbd5e1',
  };
}

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
