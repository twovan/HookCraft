'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import { useMembershipPermission } from '@/hooks/useMembershipPermission';
import { calculateGenerationCost, CREDITS_COST } from '@/config/creditsCost';
import {
  STUDIO_TAB_OPTIONS,
  normalizeStudioTabSettings,
  type StudioTab,
  type StudioTabSettings,
} from '@/config/studioTabs';
import UsageDashboard from '@/components/membership/UsageDashboard';
import TemplateSelector from '@/components/studio/TemplateSelector';
import PromptInput from '@/components/studio/PromptInput';
import DurationSelector from '@/components/studio/DurationSelector';
import UpgradeModal from '@/components/membership/UpgradeModal';
import UpgradeBanner from '@/components/membership/UpgradeBanner';
import GenerationProgress from '@/components/studio/GenerationProgress';
import VersionPanel from '@/components/studio/VersionPanel';
import SyncedLyrics from '@/components/studio/SyncedLyrics';
import SensitivityConfirmDialog from '@/components/studio/SensitivityConfirmDialog';
import SensitivityBlockDialog from '@/components/studio/SensitivityBlockDialog';
import AudioUploadTab from '@/components/studio/AudioUploadTab';
import AdvancedArrangementTab from '@/components/studio/AdvancedArrangementTab';
import { useSensitivityCheck } from '@/hooks/useSensitivityCheck';
import type { Template } from '@/types/template';
import type { VersionResult } from '@/types/generation';
import type { SensitivityCheckResult } from '@/types/sensitivity';

/** Tab 类型定义 */
/**
 * AI 创作中心页面
 * - 单版本生成
 * - 版本选择面板
 * - 下载流程
 */
export default function StudioPageClient({
  initialStudioTabSettings,
}: {
  initialStudioTabSettings: StudioTabSettings;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirectTo=/studio');
    }
  }, [authLoading, user, router]);

  // Stores
  const membership = useMembershipStore((s) => s.membership);
  const membershipLoading = useMembershipStore((s) => s.isLoading);
  const membershipError = useMembershipStore((s) => s.error);
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const isPaid = useMembershipStore((s) => s.isPaid());
  const currentTier = useMembershipStore((s) => s.currentTier());

  const credits = useCreditStore((s) => s.credits);
  const previewCount = useCreditStore((s) => s.previewCount);
  const creditLoading = useCreditStore((s) => s.isLoading);
  const fetchCredits = useCreditStore((s) => s.fetchCredits);
  const fetchPreviewCount = useCreditStore((s) => s.fetchPreviewCount);
  const isExhausted = useCreditStore((s) => s.isExhausted());

  // Permission checks
  const fullDemoPermission = useMembershipPermission('full_demo');
  const premiumSingerPermission = useMembershipPermission('premium_singer');

  // Tab state
  const [activeTab, setActiveTab] = useState<StudioTab>(initialStudioTabSettings.defaultTab);
  const [studioTabSettings, setStudioTabSettings] = useState<StudioTabSettings>(initialStudioTabSettings);

  // Local state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<30 | 120>(30);
  const [usePremiumSinger, setUsePremiumSinger] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [instrumentalOnly, setInstrumentalOnly] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [customLyrics, setCustomLyrics] = useState('');

  // Multi-version state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionResult[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined);
  const [completedCount, setCompletedCount] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const [resultAudioTime, setResultAudioTime] = useState(0);
  const [resultPlaying, setResultPlaying] = useState(false);
  const [copyrightModalOpen, setCopyrightModalOpen] = useState(false);

  // Sensitivity check state
  const {
    check: sensitivityCheck,
    status: sensitivityStatus,
    result: sensitivityResult,
    loadingMessage: sensitivityLoadingMessage,
    reset: resetSensitivity,
  } = useSensitivityCheck();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockSource, setBlockSource] = useState<'description' | 'lyrics'>('description');
  const isSensitivityLoading = sensitivityStatus === 'loading';

  // Fetch initial data
  useEffect(() => {
    fetchMembership();
    fetchTemplates();
    fetchStudioTabSettings();
    checkIncompleteBatch();
  }, []);

  useEffect(() => {
    if (membership) {
      if (isPaid) {
        fetchCredits();
      } else {
        fetchPreviewCount();
      }
    }
  }, [membership]);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      // Fetch all templates (pass business tier to get all, frontend handles lock state)
      const res = await fetch('/api/templates?tier=business');
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.templates ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setTemplatesLoading(false);
    }
  };

  const fetchStudioTabSettings = async () => {
    try {
      const res = await fetch('/api/studio/settings', { cache: 'no-store' });
      if (!res.ok) return;
      const data = normalizeStudioTabSettings(await res.json());
      setStudioTabSettings(data);
      setActiveTab(data.defaultTab);
    } catch {
      // Keep local defaults if Studio settings cannot be loaded.
    }
  };

  useEffect(() => {
    const refreshStudioTabSettings = () => {
      if (document.visibilityState === 'visible') {
        fetchStudioTabSettings();
      }
    };

    window.addEventListener('focus', refreshStudioTabSettings);
    document.addEventListener('visibilitychange', refreshStudioTabSettings);

    return () => {
      window.removeEventListener('focus', refreshStudioTabSettings);
      document.removeEventListener('visibilitychange', refreshStudioTabSettings);
    };
  }, []);

  const checkIncompleteBatch = async () => {
    // Disabled: don't reload previous generation results on page load
    // Users can view history in /account/creations
  };

  // Calculate total cost (1 version)
  const singleCost = (() => {
    if (!isPaid) return 0;
    const type = duration === 30 ? 'preview' : 'full_demo_long';
    return calculateGenerationCost(type as 'preview' | 'full_demo_short' | 'full_demo_long', usePremiumSinger);
  })();

  const totalCost = singleCost;

  // Check if user can generate
  const canGenerate = (() => {
    if (!membership && !membershipError) return false;
    if (!isPaid) {
      return previewCount !== null && previewCount.remaining >= 1 && duration === 30;
    }
    return credits !== null && credits.totalAvailable >= totalCost;
  })();

  const usageLoading = !membership && !membershipError
    ? true
    : membershipError
      ? false
    : isPaid
      ? credits === null || creditLoading
      : previewCount === null || creditLoading;
  const templateStudioLoading = templatesLoading || usageLoading || membershipLoading;
  const visibleStudioTabs = STUDIO_TAB_OPTIONS.filter((tab) => studioTabSettings.visibleTabs.includes(tab.id));
  const showStudioTabs = visibleStudioTabs.length > 1;

  const creditsExhaustedPaid = isPaid && isExhausted;
  const previewsExhaustedFree = !isPaid && previewCount !== null && previewCount.remaining < 1;

  const tabButtonStyle = (tab: StudioTab): React.CSSProperties => {
    const active = activeTab === tab;
    return {
      display: studioTabSettings.visibleTabs.includes(tab) ? 'block' : 'none',
      flex: 1,
      minWidth: 132,
      padding: '12px 18px',
      borderRadius: 8,
      border: '1px solid transparent',
      background: active ? 'rgba(206, 255, 53, 0.12)' : 'transparent',
      color: active ? '#ceff35' : '#a8aaa3',
      fontSize: 14,
      fontWeight: 850,
      cursor: 'pointer',
      fontFamily: 'var(--hc-font)',
      transition: 'all 0.15s ease',
      boxShadow: active ? 'inset 0 0 0 1px rgba(206, 255, 53, 0.16)' : 'none',
      whiteSpace: 'nowrap',
    };
  };

  const showUpgradePrompt = useCallback((feature: string) => {
    setUpgradeFeature(feature);
    setUpgradeModalOpen(true);
  }, []);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerationError(null);

    if (duration === 120 && !fullDemoPermission.hasPermission) {
      showUpgradePrompt('完整 Demo 生成');
      return;
    }

    if (usePremiumSinger && !premiumSingerPermission.hasPermission) {
      showUpgradePrompt('高级歌手声模');
      return;
    }

    // Step 1: Run sensitivity check before generation
    const description = prompt.trim();
    const lyrics = (!instrumentalOnly && customLyrics.trim()) ? customLyrics.trim() : undefined;

    // Only run sensitivity check if there's user-provided text to check
    if (description || lyrics) {
      const checkResult = await sensitivityCheck({
        description: description || '',
        lyrics,
      });

      // Handle sensitivity check result
      if (checkResult) {
        if (checkResult.resultType === 'block') {
          // Determine block source: lyrics or description
          if (checkResult.lyricsResult && checkResult.lyricsResult.type === 'block') {
            setBlockSource('lyrics');
          } else {
            setBlockSource('description');
          }
          setShowBlockDialog(true);
          return;
        }

        if (checkResult.resultType === 'rewrite') {
          // Check if rewrite was successful (has rewrittenPrompt and styleTags)
          if (checkResult.rewrittenPrompt && checkResult.styleTags && checkResult.styleTags.length > 0) {
            // Show confirm dialog with style tags - user decides whether to proceed
            setShowConfirmDialog(true);
          } else {
            // Gemini rewrite failed — show error, ask user to modify manually
            setGenerationError('检测到您的描述中包含版权相关内容，但自动改写服务暂时不可用。请手动修改描述，移除明星名字或歌曲名称后重试。');
          }
          return;
        }

        // resultType === 'pass' → proceed directly to generation
      }

      // checkResult === null means error (degradation) → proceed to generation anyway
    }

    // Proceed with generation
    await proceedWithGeneration(prompt || undefined);
  };

  // Generation error state
  const [generationError, setGenerationError] = useState<string | null>(null);

  /** Proceed with the actual generation request */
  const proceedWithGeneration = async (userPrompt: string | undefined, displayPrompt?: string) => {
    setIsGenerating(true);
    setGenerationError(null);
    setCompletedCount(0);
    setBatchId(null);
    setVersions([]);
    setSelectedVersionId(undefined);
    setSelectionConfirmed(false);

    try {
      const res = await fetch('/api/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate?.id,
          userPrompt: userPrompt || undefined,
          displayPrompt: displayPrompt || undefined,
          generationType: duration === 30 ? 'preview' : 'full_demo',
          usePremiumSinger,
          instrumentalOnly,
          voiceGender: instrumentalOnly ? undefined : voiceGender,
          customLyrics: instrumentalOnly ? undefined : (customLyrics.trim() || undefined),
          versionCount: 2,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Refresh credits after generation
        if (isPaid) {
          fetchCredits({ force: true });
        } else {
          fetchPreviewCount({ force: true });
        }

        // Check if all versions failed or were safety blocked
        const allVersions = data.versions || [];
        const failedVersions = allVersions.filter(
          (v: any) => v.status === 'failed' || v.status === 'safety_blocked'
        );

        if (failedVersions.length > 0 && failedVersions.length === allVersions.length) {
          // All versions failed — stay on studio page and show error
          const firstError = failedVersions[0]?.error;
          let errorMessage = '生成失败，请修改提示词或歌词后重试';

          if (failedVersions[0]?.status === 'safety_blocked') {
            errorMessage = '您的内容被安全过滤器拦截，请修改提示词或歌词中的敏感内容后重试';
          } else if (firstError?.message) {
            errorMessage = firstError.message;
          }

          setGenerationError(errorMessage);
          return;
        }

        // At least one version succeeded — navigate to creations page
        router.push(`/account/creations?expand=${data.batchId}`);
        return;
      } else {
        // Server returned error status
        const errorData = await res.json().catch(() => ({ error: '生成失败，请重试' }));
        setGenerationError(errorData.error || '生成失败，请重试');
      }
    } catch {
      setGenerationError('网络异常，请检查网络连接后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  /** Handle user confirming rewrite in SensitivityConfirmDialog */
  const handleSensitivityConfirm = () => {
    setShowConfirmDialog(false);
    // Use the rewritten English prompt for Lyria 3, Chinese version for display
    const rewrittenPrompt = sensitivityResult?.rewrittenPrompt;
    const rewrittenPromptCn = sensitivityResult?.rewrittenPromptCn;
    // 如果中文改写版存在且确实是中文，用它作为显示；否则用用户原始输入
    const displayPromptToUse = rewrittenPromptCn && /[\u4e00-\u9fff]/.test(rewrittenPromptCn)
      ? rewrittenPromptCn
      : prompt; // 用户原始中文输入
    proceedWithGeneration(rewrittenPrompt || prompt || undefined, displayPromptToUse || undefined);
    resetSensitivity();
  };

  /** Handle user canceling in SensitivityConfirmDialog */
  const handleSensitivityCancel = () => {
    setShowConfirmDialog(false);
    resetSensitivity();
  };

  /** Handle user closing SensitivityBlockDialog */
  const handleBlockClose = () => {
    setShowBlockDialog(false);
    resetSensitivity();
  };

  const handleSelectVersion = (taskId: string) => {
    setSelectedVersionId(taskId);
  };

  const handleConfirmSelection = async () => {
    if (!selectedVersionId || !batchId) return;

    setIsConfirming(true);
    try {
      const res = await fetch(`/api/versions/${selectedVersionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });

      if (res.ok) {
        setSelectionConfirmed(true);
      }
    } catch {
      // Handle error
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedVersionId) return;

    setIsDownloading(true);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: selectedVersionId }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `creation-${batchId}-v${versions.find(v => v.taskId === selectedVersionId)?.versionNumber || 1}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Handle error
    } finally {
      setIsDownloading(false);
    }
  };

  const renderTemplatePicker = (description: string) => (
    <div className="studio-template-picker">
      <div className="studio-template-picker-head">
        <div>
          <h2>选择模板</h2>
          <p>{description}</p>
        </div>
      </div>
      <TemplateSelector
        templates={templates}
        selectedTemplateId={selectedTemplate?.id}
        onSelect={(t) => setSelectedTemplate(t)}
        loading={templatesLoading}
        columns={4}
        cardVariant="workbench"
      />
    </div>
  );

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: '#999' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--hc-bg)',
        position: 'relative',
        paddingBottom: '80px',
      }}
      className="studio-page"
    >
      <style>{studioPageStyles}</style>
      {/* Background texture */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.024) 1px, transparent 1px), linear-gradient(180deg, rgba(82, 214, 198, 0.07), transparent 320px), radial-gradient(circle at 82% 12%, rgba(206, 255, 53, 0.13), transparent 320px), radial-gradient(circle at 8% 24%, rgba(255, 90, 61, 0.08), transparent 360px)',
          backgroundSize: '76px 76px, 76px 76px, auto, auto, auto',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="studio-shell-inner" style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto', padding: '48px clamp(20px, 4vw, 48px)' }}>
        {/* Page Header */}
        <div className="studio-hero" style={{ marginBottom: '22px' }}>
          <h1
            style={{
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              fontSize: '42px',
              fontWeight: 900,
              color: 'var(--hc-text)',
              marginBottom: '8px',
              letterSpacing: 0,
            }}
          >
            AI 创作中心
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--hc-text-muted)', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span>选择模板或输入提示词，AI 为您生成音乐作品</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setCopyrightModalOpen(true)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--hc-text-muted)', fontSize: 12, cursor: 'pointer',
                  textDecoration: 'underline', fontFamily: 'var(--hc-font)',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ceff35'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--hc-text-muted)'}
              >
                © HookCraft 创作安全与版权说明
              </button>
            </span>
          </p>
        </div>

        {/* Tab Navigation */}
        <div
          className="studio-tabbar"
          style={{
            display: showStudioTabs ? 'flex' : 'none',
            gap: '6px',
            marginBottom: '22px',
            background: 'rgba(6,8,12,0.76)',
            borderRadius: '10px',
            padding: '5px',
            border: '1px solid rgba(255,255,255,0.12)',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('template')}
            style={tabButtonStyle('template')}
          >
            模板生成
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            style={tabButtonStyle('upload')}
          >
            翻唱模式
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            style={tabButtonStyle('advanced')}
          >
            参考编曲模式
          </button>
          <button
            onClick={() => setActiveTab('templateArrangement')}
            style={tabButtonStyle('templateArrangement')}
          >
            模板编曲
          </button>
          <button
            onClick={() => setActiveTab('templateInstrumental')}
            style={tabButtonStyle('templateInstrumental')}
          >
            模板伴奏
          </button>
        </div>

        {/* Template Generation Tab Content */}
        <div style={{ display: activeTab === 'template' ? 'block' : 'none' }}>

        {/* Generation Progress */}
        {(isGenerating || isSensitivityLoading) && (
          <div style={{ marginBottom: '32px' }}>
            {isSensitivityLoading ? (
              <div style={{
                background: 'var(--hc-panel)',
                borderRadius: 14,
                padding: '32px 24px',
                border: '1px solid var(--hc-border)',
                boxShadow: 'none',
                textAlign: 'center',
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  margin: '0 auto 16px',
                  border: '3px solid rgba(255,255,255,0.12)',
                  borderTopColor: '#ceff35',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <p style={{
                  fontSize: 14,
                  color: 'var(--hc-text)',
                  margin: 0,
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                }}>
                  {sensitivityLoadingMessage}
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <GenerationProgress
                completedCount={completedCount}
                totalCount={1}
                isGenerating={true}
              />
            )}
          </div>
        )}

        {/* Generation Error Display */}
        {generationError && !isGenerating && !isSensitivityLoading && (
          <div style={{
            marginBottom: '32px',
            background: 'var(--hc-panel)',
            borderRadius: 14,
            padding: '32px 24px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.06)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 56,
              height: 56,
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 900,
              color: '#ff5a5f',
            }}>
              !
            </div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--hc-text)',
              marginBottom: 12,
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}>
              生成失败
            </h3>
            <p style={{
              fontSize: 14,
              color: 'var(--hc-text-muted)',
              lineHeight: 1.7,
              margin: '0 0 24px 0',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              maxWidth: 360,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}>
              {generationError}
            </p>
            <button
              onClick={() => setGenerationError(null)}
              style={{
                padding: '12px 32px',
                borderRadius: 999,
                border: 'none',
                background: '#ceff35',
                color: '#08090c',
                fontSize: 15,
                fontWeight: 900,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                boxShadow: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              返回修改
            </button>
          </div>
        )}

        {/* Generation Result (after generation) */}
        {batchId && versions.length > 0 && !isGenerating && (
          <div style={{
            marginBottom: '32px',
            background: 'var(--hc-panel)',
            borderRadius: 14,
            padding: 24,
            border: '1px solid var(--hc-border)',
            boxShadow: 'none',
          }}>
            {versions.some(v => v.status === 'completed') ? (
              <div>
                <h3 style={{
                  fontSize: 18, fontWeight: 600, color: '#e8e8f0', marginBottom: 20,
                  fontFamily: 'var(--hc-font)', textAlign: 'center',
                }}>生成完成 · {versions.filter(v => v.status === 'completed').length} 个版本</h3>

                {versions.filter(v => v.status === 'completed').length === 0 && versions.some(v => v.status === 'safety_blocked') && (
                  <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
                    所有版本被安全过滤器拦截，请修改歌词或提示词后重试
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  {versions.filter(v => v.status === 'completed').map((version, idx) => (
                    <div key={version.taskId} style={{
                      padding: 16, background: '#111217', borderRadius: 12,
                      border: '1px solid var(--hc-border)',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ceff35', marginBottom: 10 }}>
                        版本 {idx + 1}
                      </div>
                      {version.audioUrl && (
                        <audio
                          controls
                          src={version.audioUrl}
                          style={{ width: '100%', height: 36, marginBottom: 10 }}
                          onTimeUpdate={(e) => { setResultAudioTime((e.target as HTMLAudioElement).currentTime); setSelectedVersionId(version.taskId); }}
                          onPlay={() => { setResultPlaying(true); setSelectedVersionId(version.taskId); }}
                          onPause={() => setResultPlaying(false)}
                        />
                      )}
                      {version.lyrics && (
                        <SyncedLyrics
                          lyrics={version.lyrics}
                          currentTime={selectedVersionId === version.taskId ? resultAudioTime : 0}
                          isPlaying={resultPlaying && selectedVersionId === version.taskId}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => { setBatchId(null); setVersions([]); setSelectedVersionId(undefined); }}
                    style={{
                      padding: '14px 32px', borderRadius: 24,
                      border: '1px solid rgba(206, 255, 53, 0.34)', background: 'transparent', color: '#ceff35',
                      fontSize: 15, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--hc-font)',
                    }}
                  >
                    继续创作
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 12, color: '#ff5a5f' }}>生成失败</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#E53E3E', marginBottom: 8 }}>
                  生成失败
                </h3>
                <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 20 }}>
                  {versions[0]?.error?.message || '请重试或更换提示词'}
                </p>
                <button
                  onClick={() => { setBatchId(null); setVersions([]); }}
                  style={{
                    padding: '14px 32px', borderRadius: 24, border: 'none',
                    background: '#ceff35', color: '#08090c',
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  }}
                >
                  重新创作
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Content Grid (creation form) */}
        {!isGenerating && !batchId && !isSensitivityLoading && (
          <>
          <div
            className="studio-create-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '32px',
            }}
          >
            {/* Left Column: Template Selection */}
            <div
              className="studio-card"
              style={{
                background: 'var(--hc-panel)',
                borderRadius: 14,
                padding: '24px',
                border: '1px solid var(--hc-border)',
                boxShadow: 'none',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <h2
                style={{
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--hc-text)',
                  margin: '0 0 20px 0',
                }}
              >
                选择模板
              </h2>
              <TemplateSelector
                templates={templates}
                selectedTemplateId={selectedTemplate?.id}
                onSelect={(t) => setSelectedTemplate(t.id === selectedTemplate?.id ? null : t)}
                loading={templatesLoading}
              />
            </div>

            {/* Right Column: Prompt & Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
              {/* Prompt Input */}
              <div
                className="studio-card"
                style={{
                  background: 'var(--hc-panel)',
                  borderRadius: 14,
                  padding: '24px',
                  border: '1px solid var(--hc-border)',
                  boxShadow: 'none',
                }}
              >
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  disabled={isGenerating}
                />
              </div>

              {/* Duration Selector */}
              <div
                className="studio-card"
                style={{
                  background: 'var(--hc-panel)',
                  borderRadius: 14,
                  padding: '24px',
                  border: '1px solid var(--hc-border)',
                  boxShadow: 'none',
                }}
              >
                <DurationSelector
                  selected={duration}
                  onSelect={setDuration}
                  onUpgradePrompt={() => showUpgradePrompt('完整 Demo 生成')}
                  disabled={isGenerating}
                />
              </div>

              {/* Vocal Mode Section */}
              <div
                className="studio-card"
                style={{
                  background: 'var(--hc-panel)',
                  borderRadius: 14,
                  padding: '24px',
                  border: '1px solid var(--hc-border)',
                  boxShadow: 'none',
                }}
              >
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--hc-text)',
                  marginBottom: 16,
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                }}>
                  人声模式
                </h3>

                {/* Toggle: 带歌词 / 纯器乐 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => setInstrumentalOnly(false)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 12,
                      border: !instrumentalOnly ? '1px solid rgba(206, 255, 53, 0.55)' : '1px solid var(--hc-border)',
                      background: !instrumentalOnly ? 'rgba(206, 255, 53, 0.12)' : 'transparent',
                      color: !instrumentalOnly ? '#ceff35' : 'var(--hc-text-muted)',
                      fontSize: 13,
                      fontWeight: 850,
                      cursor: 'pointer',
                      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    带歌词
                  </button>
                  <button
                    onClick={() => setInstrumentalOnly(true)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 12,
                      border: instrumentalOnly ? '1px solid rgba(206, 255, 53, 0.55)' : '1px solid var(--hc-border)',
                      background: instrumentalOnly ? 'rgba(206, 255, 53, 0.12)' : 'transparent',
                      color: instrumentalOnly ? '#ceff35' : 'var(--hc-text-muted)',
                      fontSize: 13,
                      fontWeight: 850,
                      cursor: 'pointer',
                      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    纯器乐
                  </button>
                </div>

                {/* Voice gender selector (only when not instrumental) */}
                {!instrumentalOnly && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button
                        onClick={() => setVoiceGender('female')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: voiceGender === 'female' ? '1px solid rgba(206, 255, 53, 0.55)' : '1px solid var(--hc-border)',
                          background: voiceGender === 'female' ? 'rgba(206, 255, 53, 0.1)' : 'transparent',
                          color: voiceGender === 'female' ? '#ceff35' : 'var(--hc-text-muted)',
                          fontSize: 12,
                          fontWeight: 850,
                          cursor: 'pointer',
                          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                          transition: 'all 0.2s',
                        }}
                      >
                        女声
                      </button>
                      <button
                        onClick={() => setVoiceGender('male')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: voiceGender === 'male' ? '1px solid rgba(206, 255, 53, 0.55)' : '1px solid var(--hc-border)',
                          background: voiceGender === 'male' ? 'rgba(206, 255, 53, 0.1)' : 'transparent',
                          color: voiceGender === 'male' ? '#ceff35' : 'var(--hc-text-muted)',
                          fontSize: 12,
                          fontWeight: 850,
                          cursor: 'pointer',
                          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                          transition: 'all 0.2s',
                        }}
                      >
                        男声
                      </button>
                    </div>

                    {/* Custom lyrics textarea */}
                    <div>
                      <label style={{
                        fontSize: 12,
                        color: 'var(--hc-text-muted)',
                        marginBottom: 8,
                        display: 'block',
                        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      }}>
                        自定义歌词（可选）
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 14, height: 14, borderRadius: '50%', marginLeft: 6,
                            background: 'rgba(206, 255, 53, 0.14)', color: '#ceff35', fontSize: 9, fontWeight: 900,
                            cursor: 'help', transition: 'all 0.2s', position: 'relative',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.color = 'var(--hc-text-muted)';
                            const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement;
                            if (tip) tip.style.display = 'block';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(206, 255, 53, 0.14)';
                            e.currentTarget.style.color = '#ceff35';
                            const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement;
                            if (tip) tip.style.display = 'none';
                          }}
                        >
                          !
                          <div data-tip style={{
                            display: 'none', position: 'absolute', top: '100%', left: '50%',
                            transform: 'translateX(-50%)', marginTop: 8,
                            background: 'var(--hc-panel-raised)', border: '1px solid var(--hc-border)', borderRadius: 10,
                            padding: '10px 14px', width: 240, fontSize: 11, lineHeight: 1.6,
                            color: 'var(--hc-text)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100,
                            whiteSpace: 'normal', fontWeight: 400,
                          }}>
                            请勿输入以下违禁内容：<br/>
                            1. 未与本平台签约的现实公众人物与版权导向：包含具体歌手、知名乐队名称，或明确要求模仿特定受版权保护的曲目。<br/>
                            2. 不当内容：包含暴力、仇恨言论、歧视、色情或其他违反社区准则的词汇
                          </div>
                        </span>
                      </label>
                      <textarea
                        value={customLyrics}
                        onChange={(e) => setCustomLyrics(e.target.value)}
                        placeholder="输入歌词，AI 将按照您的歌词生成音乐..."
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: 80,
                          maxWidth: '100%',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid var(--hc-border)',
                          background: '#0b0c10',
                          color: 'var(--hc-text)',
                          fontSize: 13,
                          lineHeight: 1.6,
                          resize: 'vertical',
                          outline: 'none',
                          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#ceff35'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Premium Singer Toggle (paid users only) */}
              {/* Premium Singer - hidden, coming soon */}
            </div>
          </div>

          {/* Generate Button - full width, sticky at bottom */}
          <div style={{ position: 'sticky', bottom: 24, zIndex: 10, marginTop: 24 }}>
            <button
              onClick={handleGenerate}
              disabled={templateStudioLoading || !canGenerate || isGenerating || isSensitivityLoading || (!selectedTemplate && !prompt.trim())}
              onMouseEnter={(e) => { if (!templateStudioLoading && canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())) e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: 999,
                border: 'none',
                background: !templateStudioLoading && canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? '#ceff35'
                  : '#20222b',
                color: !templateStudioLoading && canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? '#08090c'
                  : 'var(--hc-text-weak)',
                fontSize: '15px',
                fontWeight: 900,
                cursor: !templateStudioLoading && canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? 'pointer'
                  : 'not-allowed',
                fontFamily: 'var(--hc-font)',
                boxShadow: !templateStudioLoading && canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? '0 10px 26px rgba(206, 255, 53, 0.12)'
                  : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <span>{templateStudioLoading ? '正在加载创作配置...' : isGenerating ? '生成中...' : isSensitivityLoading ? '检测中...' : '开始 AI 创作'}</span>
              <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>
                {templateStudioLoading
                  ? '正在同步模板与额度'
                  : isPaid
                  ? `消耗 ${totalCost} 点额度（2版本）· 剩余 ${credits?.totalAvailable ?? 0}`
                  : `消耗 1 次预览（2版本）· 剩余 ${previewCount?.remaining ?? 0} 次`
                }
              </span>
            </button>
          </div>

          {/* Credits exhausted messages */}
          {creditsExhaustedPaid && (
            <div style={{ background: 'rgba(229, 57, 53, 0.1)', borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(229, 57, 53, 0.3)', fontSize: '13px', color: '#C53030', lineHeight: 1.6, marginTop: 16 }} role="alert">
              <strong>额度已用尽</strong>
              <p style={{ margin: '8px 0 0 0' }}>购买额度充值包或等待下月刷新。</p>
            </div>
          )}
          {previewsExhaustedFree && (
            <div style={{ background: 'rgba(229, 57, 53, 0.1)', borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(229, 57, 53, 0.3)', fontSize: '13px', color: '#C53030', lineHeight: 1.6, marginTop: 16 }} role="alert">
              <strong>预览次数不足</strong>
              <p style={{ margin: '8px 0 0 0' }}>升级到专业版获取更多创作额度。</p>
            </div>
          )}
        </>
        )}
        </div>{/* End Template Generation Tab Content */}

        {/* Upload Arrangement Tab Content */}
        <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
          <AudioUploadTab />
        </div>

        {/* Advanced Arrangement Tab Content */}
        <div style={{ display: activeTab === 'advanced' ? 'block' : 'none' }}>
          <AdvancedArrangementTab />
        </div>

        {/* Template Arrangement Tab Content */}
        <div style={{ display: activeTab === 'templateArrangement' ? 'block' : 'none' }}>
          <AdvancedArrangementTab
            variant="template"
            selectedTemplate={selectedTemplate}
            templatePicker={renderTemplatePicker('模板将作为主创作基调，选择一个模板开始创作。')}
          />
        </div>

        {/* Template Instrumental Tab Content */}
        <div style={{ display: activeTab === 'templateInstrumental' ? 'block' : 'none' }}>
          <AdvancedArrangementTab
            variant="templateInstrumental"
            selectedTemplate={selectedTemplate}
            templatePicker={renderTemplatePicker('模板解析会自动生成风格标签，默认使用 V5.5 伴奏模型。')}
          />
        </div>
      </div>

      {/* Copyright & Safety Modal */}
      {copyrightModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24,
        }} onClick={() => setCopyrightModalOpen(false)}>
          <div style={{
            background: 'var(--hc-panel)', borderRadius: 14, maxWidth: 480, width: '100%',
            padding: 32, border: '1px solid var(--hc-border)', position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setCopyrightModalOpen(false)} style={{
              position: 'absolute', top: 16, right: 16, border: 'none',
              background: '#20222b', borderRadius: 8, width: 28, height: 28,
              color: 'var(--hc-text-muted)', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>

            <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--hc-text)', marginBottom: 8, fontFamily: 'var(--hc-font)' }}>
              HookCraft
            </h2>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ceff35', marginBottom: 20 }}>
              创作安全与版权说明
            </h3>

            <p style={{ fontSize: 14, color: 'var(--hc-text-muted)', lineHeight: 1.8, marginBottom: 16 }}>
              欢迎使用 HookCraft AI 创作工具
            </p>
            <p style={{ fontSize: 14, color: 'var(--hc-text)', lineHeight: 1.8, marginBottom: 20 }}>
              为了保护音乐创作者的合法权益并遵守平台安全规范，AI 创作中心无法处理包含以下意图的提示词：
            </p>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: 'var(--hc-text)', fontWeight: 800, marginBottom: 8 }}>
                1. 未与本平台签约的现实公众人物与版权导向：
              </p>
              <p style={{ fontSize: 13, color: 'var(--hc-text-muted)', lineHeight: 1.8, paddingLeft: 16 }}>
                包含具体歌手、知名乐队名称，或明确要求模仿特定受版权保护的曲目。
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: 'var(--hc-text)', fontWeight: 800, marginBottom: 8 }}>
                2. 不当内容：
              </p>
              <p style={{ fontSize: 13, color: 'var(--hc-text-muted)', lineHeight: 1.8, paddingLeft: 16 }}>
                包含暴力、仇恨言论、歧视、色情及其他违反社区准则的词汇。
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setCopyrightModalOpen(false)}
                style={{
                  padding: '12px 32px', borderRadius: 999, border: 'none',
                  background: '#ceff35',
                  color: '#08090c', fontSize: 14, fontWeight: 900, cursor: 'pointer',
                  fontFamily: 'var(--hc-font)',
                  boxShadow: 'none',
                }}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensitivity Confirm Dialog (rewrite type) */}
      <SensitivityConfirmDialog
        open={showConfirmDialog}
        styleTags={sensitivityResult?.styleTagsCn ?? sensitivityResult?.styleTags ?? []}
        onConfirm={handleSensitivityConfirm}
        onCancel={handleSensitivityCancel}
      />

      {/* Sensitivity Block Dialog (block type) */}
      <SensitivityBlockDialog
        open={showBlockDialog}
        blockedWords={sensitivityResult?.blockedWords ?? []}
        source={blockSource}
        onClose={handleBlockClose}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentTier={currentTier}
        requiredFeature={upgradeFeature}
        onNavigateToPricing={() => {
          setUpgradeModalOpen(false);
          window.location.href = '/pricing';
        }}
      />

      {/* Upgrade Banner (Free users only) */}
      <UpgradeBanner
        onUpgrade={() => {
          window.location.href = '/pricing';
        }}
      />
    </div>
  );
}

const studioPageStyles = `
  .studio-page {
    isolation: isolate;
  }

  .studio-shell-inner {
    width: min(1400px, calc(100% - 48px));
  }

  .studio-hero {
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 18px;
    padding: 26px;
    background:
      linear-gradient(135deg, rgba(255,255,255,.07), transparent 34%),
      linear-gradient(180deg, rgba(17,18,23,.72), rgba(9,10,14,.54));
    box-shadow: var(--hc-shadow-soft);
  }

  .studio-hero h1 {
    font-family: var(--hc-font-display) !important;
    font-size: clamp(34px, 5vw, 56px) !important;
    line-height: .98 !important;
    margin: 0 0 12px !important;
    text-wrap: balance;
  }

  .studio-tabbar {
    box-shadow: var(--hc-shadow-soft);
    backdrop-filter: blur(16px);
  }

  .studio-tabbar button {
    min-height: 44px;
  }

  .studio-production-workbench {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 430px);
    gap: 18px;
    align-items: start;
  }

  .studio-template-picker-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .studio-template-picker h2 {
    margin: 0;
    color: var(--hc-text);
    font-size: 18px;
    font-weight: 800;
    font-family: var(--hc-font);
  }

  .studio-template-picker p {
    margin: 8px 0 0;
    color: var(--hc-text-muted);
    font-size: 12px;
    line-height: 1.65;
  }

  .studio-template-source {
    background:
      linear-gradient(180deg, rgba(255,255,255,.052), rgba(255,255,255,.018)) !important;
    border-color: rgba(255,255,255,.12) !important;
    box-shadow: var(--hc-shadow-soft) !important;
  }

  .studio-create-grid {
    align-items: start;
  }

  .studio-card {
    background:
      linear-gradient(180deg, rgba(255,255,255,.052), rgba(255,255,255,.018)) !important;
    border-color: rgba(255,255,255,.12) !important;
    box-shadow: var(--hc-shadow-soft) !important;
  }

  .studio-page section,
  .studio-page textarea,
  .studio-page input,
  .studio-page button {
    letter-spacing: 0;
  }

  .studio-page textarea,
  .studio-page input {
    border-color: rgba(255,255,255,0.12) !important;
    background: rgba(7,8,11,.86) !important;
  }

  .studio-page button {
    border-radius: 8px;
  }

  .studio-page [style*="#1a1a2e"],
  .studio-page [style*="rgba(13, 17, 23"] {
    background: var(--hc-panel) !important;
  }

  .studio-page [style*="#2a2a40"],
  .studio-page [style*="rgba(148, 163, 184"] {
    border-color: rgba(255,255,255,0.1) !important;
  }

  .studio-page [style*="#7536d5"],
  .studio-page [style*="#B7FF4A"] {
    border-color: rgba(206,255,53,0.36) !important;
    color: var(--hc-lime) !important;
  }

  .studio-page [style*="background: #7536d5"],
  .studio-page [style*="background: #B7FF4A"],
  .studio-page [style*="linear-gradient(135deg, #7536d5"],
  .studio-page [style*="linear-gradient(135deg, #B7FF4A"] {
    background: var(--hc-lime) !important;
    color: #08090c !important;
  }

  .studio-page [style*="borderRadius: 20"],
  .studio-page [style*="border-radius: 20"] {
    border-radius: 14px !important;
  }

  .studio-page audio {
    accent-color: var(--hc-lime);
  }

  .studio-page select,
  .studio-page input[type="number"] {
    border-color: rgba(255,255,255,0.12) !important;
    background: rgba(7,8,11,.86) !important;
    color: var(--hc-text) !important;
  }

  @media (max-width: 980px) {
    .studio-shell-inner {
      width: min(100% - 32px, 760px);
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    .studio-hero {
      padding: 20px;
    }

    .studio-tabbar {
      margin-bottom: 22px !important;
    }

    .studio-page [style*="grid-template-columns: 1fr 1fr"],
    .studio-page [style*="grid-template-columns: minmax(260px, 320px) minmax(0, 1fr)"],
    .studio-page [style*="grid-template-columns: minmax(0, 1fr) minmax(360px, 420px)"],
    .studio-production-workbench {
      grid-template-columns: 1fr !important;
    }

    .studio-page [style*="position: sticky"] {
      position: static !important;
    }

    .studio-template-source [style*="repeat(4, minmax(0, 1fr))"] {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 560px) {
    .studio-shell-inner {
      width: min(100% - 24px, 560px);
      padding-top: 28px !important;
    }

    .studio-hero {
      padding: 16px;
      border-radius: 14px;
    }

    .studio-tabbar {
      gap: 6px !important;
      padding: 6px !important;
    }

    .studio-tabbar button {
      min-width: max-content !important;
      padding: 11px 13px !important;
    }

    .studio-card {
      padding: 18px !important;
    }

    .studio-page [style*="display: flex"][style*="gap: 8px"] {
      flex-wrap: wrap;
    }

    .studio-template-source [style*="repeat(4, minmax(0, 1fr))"],
    .studio-template-source [style*="repeat(3, minmax(0, 1fr))"] {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }
`;
