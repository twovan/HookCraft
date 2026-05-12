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
import type { Template } from '@/types/template';
import type { VersionResult } from '@/types/generation';

/**
 * AI 创作中心页面
 * - 多版本生成：一次生成 3 个版本
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

  // Multi-version state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionResult[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined);
  const [completedCount, setCompletedCount] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);

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
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.templates ?? []);
      }
    } catch {
      // Silently fail
    }
  };

  const checkIncompleteBatch = async () => {
    try {
      const res = await fetch('/api/batches?range=7d&pageSize=1');
      if (res.ok) {
        const data = await res.json();
        const batches = data.batches || [];
        // Find the latest batch that is completed/partial but has no selected version
        const incompleteBatch = batches.find(
          (b: { status: string; selectedVersionId?: string }) =>
            (b.status === 'completed' || b.status === 'partial') && !b.selectedVersionId
        );
        if (incompleteBatch) {
          // Fetch batch details
          const detailRes = await fetch(`/api/batches/${incompleteBatch.batchId}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setBatchId(incompleteBatch.batchId);
            setVersions(detail.versions || []);
            setCompletedCount(
              (detail.versions || []).filter((v: VersionResult) => v.status === 'completed').length
            );
          }
        }
      }
    } catch {
      // Silently fail
    }
  };

  // Calculate total cost (3 versions)
  const singleCost = (() => {
    if (!isPaid) return 0;
    const type = duration === 30 ? 'preview' : 'full_demo_long';
    return calculateGenerationCost(type as 'preview' | 'full_demo_short' | 'full_demo_long', usePremiumSinger);
  })();

  const totalCost = singleCost * 3;

  // Check if user can generate
  const canGenerate = (() => {
    if (!isPaid) {
      return previewCount !== null && previewCount.remaining >= 3 && duration === 30;
    }
    return credits !== null && credits.totalAvailable >= totalCost;
  })();

  const creditsExhaustedPaid = isPaid && isExhausted;
  const previewsExhaustedFree = !isPaid && previewCount !== null && previewCount.remaining < 3;

  const showUpgradePrompt = useCallback((feature: string) => {
    setUpgradeFeature(feature);
    setUpgradeModalOpen(true);
  }, []);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    if (duration === 120 && !fullDemoPermission.hasPermission) {
      showUpgradePrompt('完整 Demo 生成');
      return;
    }

    if (usePremiumSinger && !premiumSingerPermission.hasPermission) {
      showUpgradePrompt('高级歌手声模');
      return;
    }

    setIsGenerating(true);
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
          userPrompt: prompt || undefined,
          generationType: duration === 30 ? 'preview' : 'full_demo',
          usePremiumSinger,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBatchId(data.batchId);
        setVersions(data.versions || []);
        setCompletedCount(
          (data.versions || []).filter((v: VersionResult) => v.status === 'completed').length
        );

        // Refresh credits after generation
        if (isPaid) {
          fetchCredits();
        } else {
          fetchPreviewCount();
        }
      }
    } catch {
      // Handle error
    } finally {
      setIsGenerating(false);
    }
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
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: '#999' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FDFBF7',
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
            'radial-gradient(circle at 20% 50%, rgba(212, 165, 116, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212, 165, 116, 0.03) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '36px',
              fontWeight: 700,
              color: '#2D2D2D',
              marginBottom: '8px',
            }}
          >
            AI 创作中心
          </h1>
          <p style={{ fontSize: '15px', color: '#6B6B6B', margin: 0 }}>
            选择模板或输入提示词，一次生成 3 个版本供您对比选择
          </p>
        </div>

        {/* Usage Dashboard */}
        <div style={{ marginBottom: '32px' }}>
          <UsageDashboard
            onUpgrade={() => showUpgradePrompt('更多创作额度')}
            onBuyCredits={() => window.open('/pricing#credits-pack', '_blank')}
          />
        </div>

        {/* Generation Progress */}
        {isGenerating && (
          <div style={{ marginBottom: '32px' }}>
            <GenerationProgress
              completedCount={completedCount}
              totalCount={3}
              isGenerating={true}
            />
          </div>
        )}

        {/* Version Panel (after generation) */}
        {batchId && versions.length > 0 && !isGenerating && !selectionConfirmed && (
          <div style={{ marginBottom: '32px' }}>
            <VersionPanel
              batchId={batchId}
              versions={versions}
              selectedVersionId={selectedVersionId}
              onSelect={handleSelectVersion}
              onConfirm={handleConfirmSelection}
              isLoading={isConfirming}
            />
          </div>
        )}

        {/* Download section (after selection confirmed) */}
        {selectionConfirmed && selectedVersionId && (
          <div style={{
            marginBottom: '32px',
            background: 'white',
            borderRadius: 20,
            padding: 24,
            border: '1px solid #f0ebe4',
            boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#2D2D2D',
              marginBottom: 8,
              fontFamily: "'Playfair Display', serif",
            }}>
              版本已确认
            </h3>
            <p style={{ fontSize: 14, color: '#6B6B6B', marginBottom: 20 }}>
              您选择的版本已保存，可以下载 MP3 文件
            </p>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              style={{
                padding: '14px 32px',
                borderRadius: 24,
                border: 'none',
                background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
                color: 'white',
                fontSize: 15,
                fontWeight: 700,
                cursor: isDownloading ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                boxShadow: '0 4px 16px rgba(212, 165, 116, 0.3)',
                opacity: isDownloading ? 0.7 : 1,
              }}
            >
              {isDownloading ? '下载中...' : '下载 MP3'}
            </button>
          </div>
        )}

        {/* Main Content Grid (creation form) */}
        {!isGenerating && !selectionConfirmed && (
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
                background: 'white',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid #f0ebe4',
                boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#2D2D2D',
                  margin: '0 0 20px 0',
                }}
              >
                选择模板
              </h2>
              <TemplateSelector
                templates={templates}
                selectedTemplateId={selectedTemplate?.id}
                onSelect={setSelectedTemplate}
              />
            </div>

            {/* Right Column: Prompt & Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
              {/* Prompt Input */}
              <div
                style={{
                  background: 'white',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #f0ebe4',
                  boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
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
                  background: 'white',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid #f0ebe4',
                  boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
                }}
              >
                <DurationSelector
                  selected={duration}
                  onSelect={setDuration}
                  onUpgradePrompt={() => showUpgradePrompt('完整 Demo 生成')}
                  disabled={isGenerating}
                />
              </div>

              {/* Premium Singer Toggle (paid users only) */}
              {isPaid && (
                <div
                  style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '20px 24px',
                    border: '1px solid #f0ebe4',
                    boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#2D2D2D', fontFamily: "'Inter', sans-serif" }}>
                      高级歌手声模
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                      额外消耗 {CREDITS_COST.premium_singer} Credits/版本
                    </div>
                  </div>
                  <button
                    onClick={() => setUsePremiumSinger(!usePremiumSinger)}
                    disabled={isGenerating}
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      border: 'none',
                      background: usePremiumSinger
                        ? 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)'
                        : '#E2E8F0',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s ease',
                    }}
                    role="switch"
                    aria-checked={usePremiumSinger}
                    aria-label="启用高级歌手声模"
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: usePremiumSinger ? '22px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      }}
                    />
                  </button>
                </div>
              )}

              {/* Total Cost Display (3 versions) */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #FDFBF7 0%, #F5E6D3 100%)',
                  borderRadius: '20px',
                  padding: '20px 24px',
                  border: '1px solid #f0ebe4',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#2D2D2D', fontFamily: "'Inter', sans-serif" }}>
                    预计总消耗（3 个版本）
                  </span>
                  <span
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: '#D4A574',
                      fontFamily: "'Playfair Display', serif",
                    }}
                  >
                    {isPaid ? `${totalCost} Credits` : '3 次预览'}
                  </span>
                </div>

                {isPaid && (
                  <div style={{ fontSize: '12px', color: '#6B6B6B', lineHeight: 1.8 }}>
                    <div>单版本：{duration === 30 ? `Preview ${CREDITS_COST.preview} Credit` : `Full Demo ${CREDITS_COST.full_demo_long} Credits`}</div>
                    {usePremiumSinger && <div>高级声模：+{CREDITS_COST.premium_singer} Credits/版本</div>}
                    <div style={{ marginTop: 4, color: '#999' }}>× 3 版本 = {totalCost} Credits</div>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating || (!selectedTemplate && !prompt.trim())}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: '24px',
                  border: 'none',
                  background: canGenerate && !isGenerating && (selectedTemplate || prompt.trim())
                    ? 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)'
                    : '#E2E8F0',
                  color: canGenerate && !isGenerating && (selectedTemplate || prompt.trim())
                    ? 'white'
                    : '#A0AEC0',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: canGenerate && !isGenerating && (selectedTemplate || prompt.trim())
                    ? 'pointer'
                    : 'not-allowed',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: canGenerate && !isGenerating && (selectedTemplate || prompt.trim())
                    ? '0 4px 16px rgba(212, 165, 116, 0.3)'
                    : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {isGenerating ? '生成中...' : '开始 AI 创作（生成 3 个版本）'}
              </button>

              {/* Credits exhausted messages */}
              {creditsExhaustedPaid && (
                <div
                  style={{
                    background: '#FFF5F5',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    border: '1px solid #FED7D7',
                    fontSize: '13px',
                    color: '#C53030',
                    lineHeight: 1.6,
                  }}
                  role="alert"
                >
                  <strong>Credits 已用尽</strong>
                  <p style={{ margin: '8px 0 0 0' }}>
                    购买 Credits 充值包或等待下月刷新。您仍可访问和编辑已生成的音乐作品。
                  </p>
                </div>
              )}

              {previewsExhaustedFree && (
                <div
                  style={{
                    background: '#FFF5F5',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    border: '1px solid #FED7D7',
                    fontSize: '13px',
                    color: '#C53030',
                    lineHeight: 1.6,
                  }}
                  role="alert"
                >
                  <strong>预览次数不足</strong>
                  <p style={{ margin: '8px 0 0 0' }}>
                    多版本生成需要 3 次预览额度。升级到专业版获取更多创作额度。
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
