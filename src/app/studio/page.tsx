'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import { useMembershipPermission } from '@/hooks/useMembershipPermission';
import { calculateGenerationCost, CREDITS_COST } from '@/config/creditsCost';
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
import { useSensitivityCheck } from '@/hooks/useSensitivityCheck';
import type { Template } from '@/types/template';
import type { VersionResult } from '@/types/generation';
import type { SensitivityCheckResult } from '@/types/sensitivity';

/**
 * AI 创作中心页面
 * - 单版本生成
 * - 版本选择面板
 * - 下载流程
 */
export default function StudioPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirectTo=/studio');
    }
  }, [authLoading, user, router]);

  // Stores
  const membership = useMembershipStore((s) => s.membership);
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const isPaid = useMembershipStore((s) => s.isPaid());
  const currentTier = useMembershipStore((s) => s.currentTier());

  const credits = useCreditStore((s) => s.credits);
  const previewCount = useCreditStore((s) => s.previewCount);
  const fetchCredits = useCreditStore((s) => s.fetchCredits);
  const fetchPreviewCount = useCreditStore((s) => s.fetchPreviewCount);
  const isExhausted = useCreditStore((s) => s.isExhausted());

  // Permission checks
  const fullDemoPermission = useMembershipPermission('full_demo');
  const premiumSingerPermission = useMembershipPermission('premium_singer');

  // Local state
  const [templates, setTemplates] = useState<Template[]>([]);
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
    try {
      // Fetch all templates (pass business tier to get all, frontend handles lock state)
      const res = await fetch('/api/templates?tier=business');
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.templates ?? []);
      }
    } catch {
      // Silently fail
    }
  };

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
    if (!isPaid) {
      return previewCount !== null && previewCount.remaining >= 1 && duration === 30;
    }
    return credits !== null && credits.totalAvailable >= totalCost;
  })();

  const creditsExhaustedPaid = isPaid && isExhausted;
  const previewsExhaustedFree = !isPaid && previewCount !== null && previewCount.remaining < 1;

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

  /** Proceed with the actual generation API call */
  const proceedWithGeneration = async (userPrompt: string | undefined) => {
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
          fetchCredits();
        } else {
          fetchPreviewCount();
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
        // API returned error status
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
    // Use the rewritten prompt from sensitivity check result
    const rewrittenPrompt = sensitivityResult?.rewrittenPrompt;
    proceedWithGeneration(rewrittenPrompt || prompt || undefined);
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
      const res = await fetch(`/api/versions/${selectedVersionId}/select`, {
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
        background: '#0d0d14',
        position: 'relative',
        paddingBottom: '80px',
      }}
    >
      {/* Background texture */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(117, 54, 213, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(117, 54, 213, 0.03) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              fontSize: '36px',
              fontWeight: 700,
              color: '#e8e8f0',
              marginBottom: '8px',
            }}
          >
            AI 创作中心
          </h1>
          <p style={{ fontSize: '15px', color: '#9ca3af', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>选择模板或输入提示词，AI 为您生成音乐作品</span>
            <button
              onClick={() => setCopyrightModalOpen(true)}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: '#9ca3af', fontSize: 12, cursor: 'pointer',
                textDecoration: 'underline', fontFamily: "'Inter', sans-serif",
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#c0a7fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
            >
              © HookCraft 创作安全与版权说明
            </button>
          </p>
        </div>

        {/* Generation Progress */}
        {(isGenerating || isSensitivityLoading) && (
          <div style={{ marginBottom: '32px' }}>
            {isSensitivityLoading ? (
              <div style={{
                background: '#1a1a2e',
                borderRadius: 20,
                padding: '32px 24px',
                border: '1px solid #2a2a40',
                boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
                textAlign: 'center',
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  margin: '0 auto 16px',
                  border: '3px solid #2a2a40',
                  borderTopColor: '#7536d5',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <p style={{
                  fontSize: 14,
                  color: '#e8e8f0',
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
            background: '#1a1a2e',
            borderRadius: 20,
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
              fontSize: 28,
            }}>
              ❌
            </div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#e8e8f0',
              marginBottom: 12,
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}>
              生成失败
            </h3>
            <p style={{
              fontSize: 14,
              color: '#9ca3af',
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
                borderRadius: 24,
                border: 'none',
                background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                boxShadow: '0 4px 16px rgba(117, 54, 213, 0.3)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(117, 54, 213, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(117, 54, 213, 0.3)';
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
            background: '#1a1a2e',
            borderRadius: 20,
            padding: 24,
            border: '1px solid #2a2a40',
            boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
          }}>
            {versions.some(v => v.status === 'completed') ? (
              <div>
                <h3 style={{
                  fontSize: 18, fontWeight: 600, color: '#e8e8f0', marginBottom: 20,
                  fontFamily: "'Inter', sans-serif", textAlign: 'center',
                }}>生成完成 · {versions.filter(v => v.status === 'completed').length} 个版本</h3>

                {versions.filter(v => v.status === 'completed').length === 0 && versions.some(v => v.status === 'safety_blocked') && (
                  <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>
                    所有版本被安全过滤器拦截，请修改歌词或提示词后重试
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  {versions.filter(v => v.status === 'completed').map((version, idx) => (
                    <div key={version.taskId} style={{
                      padding: 16, background: '#12121e', borderRadius: 14,
                      border: '1px solid #2a2a40',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#c0a7fc', marginBottom: 10 }}>
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
                      border: '1px solid #7536d5', background: 'transparent', color: '#7536d5',
                      fontSize: 15, fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    继续创作
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
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
                    background: 'linear-gradient(135deg, #7536d5, #5a2db8)', color: 'white',
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
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '32px',
            }}
          >
            {/* Left Column: Template Selection */}
            <div
              style={{
                background: '#1a1a2e',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid #2a2a40',
                boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <h2
                style={{
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#e8e8f0',
                  margin: '0 0 20px 0',
                }}
              >
                选择模板
              </h2>
              <TemplateSelector
                templates={templates}
                selectedTemplateId={selectedTemplate?.id}
                onSelect={(t) => setSelectedTemplate(t.id === selectedTemplate?.id ? null : t)}
              />
            </div>

            {/* Right Column: Prompt & Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
              {/* Prompt Input */}
              <div
                style={{
                  background: '#1a1a2e',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #2a2a40',
                  boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
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
                style={{
                  background: '#1a1a2e',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #2a2a40',
                  boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
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
                style={{
                  background: '#1a1a2e',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #2a2a40',
                  boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
                }}
              >
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#e8e8f0',
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
                      border: !instrumentalOnly ? '2px solid #7536d5' : '1px solid #2a2a40',
                      background: !instrumentalOnly ? 'rgba(117, 54, 213, 0.1)' : 'transparent',
                      color: !instrumentalOnly ? '#7536d5' : '#9ca3af',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    🎤 带歌词
                  </button>
                  <button
                    onClick={() => setInstrumentalOnly(true)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 12,
                      border: instrumentalOnly ? '2px solid #7536d5' : '1px solid #2a2a40',
                      background: instrumentalOnly ? 'rgba(117, 54, 213, 0.1)' : 'transparent',
                      color: instrumentalOnly ? '#7536d5' : '#9ca3af',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    🎹 纯器乐
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
                          border: voiceGender === 'female' ? '2px solid #7536d5' : '1px solid #2a2a40',
                          background: voiceGender === 'female' ? 'rgba(117, 54, 213, 0.08)' : 'transparent',
                          color: voiceGender === 'female' ? '#e8e8f0' : '#9ca3af',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                          transition: 'all 0.2s',
                        }}
                      >
                        👩 女声
                      </button>
                      <button
                        onClick={() => setVoiceGender('male')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: voiceGender === 'male' ? '2px solid #7536d5' : '1px solid #2a2a40',
                          background: voiceGender === 'male' ? 'rgba(117, 54, 213, 0.08)' : 'transparent',
                          color: voiceGender === 'male' ? '#e8e8f0' : '#9ca3af',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                          transition: 'all 0.2s',
                        }}
                      >
                        👨 男声
                      </button>
                    </div>

                    {/* Custom lyrics textarea */}
                    <div>
                      <label style={{
                        fontSize: 12,
                        color: '#9ca3af',
                        marginBottom: 8,
                        display: 'block',
                        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      }}>
                        自定义歌词（可选）
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 14, height: 14, borderRadius: '50%', marginLeft: 6,
                            background: '#7536d5', color: 'white', fontSize: 9, fontWeight: 700,
                            cursor: 'help', transition: 'all 0.2s', position: 'relative',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = '#2a2a40';
                            e.currentTarget.style.color = '#9ca3af';
                            const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement;
                            if (tip) tip.style.display = 'block';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = '#7536d5';
                            e.currentTarget.style.color = 'white';
                            const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement;
                            if (tip) tip.style.display = 'none';
                          }}
                        >
                          !
                          <div data-tip style={{
                            display: 'none', position: 'absolute', top: '100%', left: '50%',
                            transform: 'translateX(-50%)', marginTop: 8,
                            background: '#1a1a2e', border: '1px solid #2a2a40', borderRadius: 10,
                            padding: '10px 14px', width: 240, fontSize: 11, lineHeight: 1.6,
                            color: '#e8e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100,
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
                          border: '1px solid #2a2a40',
                          background: '#0d0d14',
                          color: '#e8e8f0',
                          fontSize: 13,
                          lineHeight: 1.6,
                          resize: 'vertical',
                          outline: 'none',
                          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#7536d5'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#2a2a40'}
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
              disabled={!canGenerate || isGenerating || isSensitivityLoading || (!selectedTemplate && !prompt.trim())}
              onMouseEnter={(e) => { if (canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())) e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '24px',
                border: 'none',
                background: canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)'
                  : '#2a2a40',
                color: canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? 'white'
                  : '#6b7280',
                fontSize: '15px',
                fontWeight: 700,
                cursor: canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? 'pointer'
                  : 'not-allowed',
                fontFamily: "'Inter', sans-serif",
                boxShadow: canGenerate && !isGenerating && !isSensitivityLoading && (selectedTemplate || prompt.trim())
                  ? '0 4px 20px rgba(117, 54, 213, 0.4)'
                  : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <span>{isGenerating ? '生成中...' : isSensitivityLoading ? '检测中...' : '开始 AI 创作'}</span>
              <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>
                {isPaid
                  ? `消耗 ${totalCost} Credits（2版本）· 剩余 ${credits?.totalAvailable ?? 0}`
                  : `消耗 1 次预览（2版本）· 剩余 ${previewCount?.remaining ?? 0} 次`
                }
              </span>
            </button>
          </div>

          {/* Credits exhausted messages */}
          {creditsExhaustedPaid && (
            <div style={{ background: 'rgba(229, 57, 53, 0.1)', borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(229, 57, 53, 0.3)', fontSize: '13px', color: '#C53030', lineHeight: 1.6, marginTop: 16 }} role="alert">
              <strong>Credits 已用尽</strong>
              <p style={{ margin: '8px 0 0 0' }}>购买 Credits 充值包或等待下月刷新。</p>
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
      </div>

      {/* Copyright & Safety Modal */}
      {copyrightModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 24,
        }} onClick={() => setCopyrightModalOpen(false)}>
          <div style={{
            background: '#1a1a2e', borderRadius: 20, maxWidth: 480, width: '100%',
            padding: 32, border: '1px solid #2a2a40', position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setCopyrightModalOpen(false)} style={{
              position: 'absolute', top: 16, right: 16, border: 'none',
              background: '#2a2a40', borderRadius: 8, width: 28, height: 28,
              color: '#9ca3af', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f0', marginBottom: 8, fontFamily: "'Inter', sans-serif" }}>
              HookCraft
            </h2>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#c0a7fc', marginBottom: 20 }}>
              创作安全与版权说明
            </h3>

            <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.8, marginBottom: 16 }}>
              欢迎使用 HookCraft AI 创作工具
            </p>
            <p style={{ fontSize: 14, color: '#e8e8f0', lineHeight: 1.8, marginBottom: 20 }}>
              为了保护音乐创作者的合法权益并遵守平台安全规范，AI 创作中心无法处理包含以下意图的提示词：
            </p>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: '#e8e8f0', fontWeight: 600, marginBottom: 8 }}>
                1. 未与本平台签约的现实公众人物与版权导向：
              </p>
              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.8, paddingLeft: 16 }}>
                包含具体歌手、知名乐队名称，或明确要求模仿特定受版权保护的曲目。
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: '#e8e8f0', fontWeight: 600, marginBottom: 8 }}>
                2. 不当内容：
              </p>
              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.8, paddingLeft: 16 }}>
                包含暴力、仇恨言论、歧视、色情及其他违反社区准则的词汇。
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setCopyrightModalOpen(false)}
                style={{
                  padding: '12px 32px', borderRadius: 24, border: 'none',
                  background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
                  color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: '0 4px 16px rgba(117, 54, 213, 0.3)',
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
