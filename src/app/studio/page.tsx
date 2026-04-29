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
import type { Template } from '@/types/template';

/**
 * AI 创作中心页面
 * - 集成 UsageDashboard、TemplateSelector、PromptInput、DurationSelector、UpgradeModal、UpgradeBanner
 * - 通过 useMembershipPermission 进行权限控制
 * - 生成前显示总 Credits 消耗
 * - Credits 耗尽时保留已有音乐访问
 * - 使用 Supabase Auth 获取当前用户，未登录时重定向到登录页
 */
export default function StudioPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // 未登录时重定向到登录页（客户端安全网，中间件已处理）
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

  // Fetch initial data
  useEffect(() => {
    fetchMembership();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (isPaid) {
      fetchCredits();
    } else {
      fetchPreviewCount();
    }
  }, [isPaid]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        // API 返回 { templates: [...] } 或直接数组
        setTemplates(Array.isArray(data) ? data : data.templates ?? []);
      }
    } catch {
      // Silently fail
    }
  };

  // Calculate total cost
  const totalCost = (() => {
    if (!isPaid) return 0; // Free users use preview count, not credits
    const type = duration === 30 ? 'preview' : 'full_demo_long';
    return calculateGenerationCost(type as 'preview' | 'full_demo_short' | 'full_demo_long', usePremiumSinger);
  })();

  // Check if user can generate
  const canGenerate = (() => {
    if (!isPaid) {
      // Free user: check preview count
      return previewCount !== null && previewCount.remaining > 0 && duration === 30;
    }
    // Paid user: check credits
    return credits !== null && credits.remaining >= totalCost;
  })();

  // Check if credits exhausted (paid user)
  const creditsExhaustedPaid = isPaid && isExhausted;
  // Check if previews exhausted (free user)
  const previewsExhaustedFree = !isPaid && previewCount !== null && previewCount.remaining === 0;

  const showUpgradePrompt = useCallback((feature: string) => {
    setUpgradeFeature(feature);
    setUpgradeModalOpen(true);
  }, []);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    // Permission check for full_demo
    if (duration === 120 && !fullDemoPermission.hasPermission) {
      showUpgradePrompt('完整 Demo 生成');
      return;
    }

    // Permission check for premium singer
    if (usePremiumSinger && !premiumSingerPermission.hasPermission) {
      showUpgradePrompt('高级歌手声模');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate', {
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

  // 认证加载中或未登录时显示加载状态
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
        paddingBottom: '80px', // Space for upgrade banner
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
            选择模板或输入提示词，开始你的 AI 音乐创作
          </p>
        </div>

        {/* Usage Dashboard */}
        <div style={{ marginBottom: '32px' }}>
          <UsageDashboard
            onUpgrade={() => showUpgradePrompt('更多创作额度')}
            onBuyCredits={() => window.open('/pricing#credits-pack', '_blank')}
          />
        </div>

        {/* Main Content Grid */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                    额外消耗 {CREDITS_COST.premium_singer} Credits
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

            {/* Total Cost Display */}
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
                  本次消耗
                </span>
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#D4A574',
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  {isPaid ? `${totalCost} Credits` : '1 次预览'}
                </span>
              </div>

              {/* Cost breakdown for paid users */}
              {isPaid && (
                <div style={{ fontSize: '12px', color: '#6B6B6B', lineHeight: 1.8 }}>
                  <div>基础：{duration === 30 ? `Preview ${CREDITS_COST.preview} Credit` : `Full Demo ${CREDITS_COST.full_demo_long} Credits`}</div>
                  {usePremiumSinger && <div>高级声模：+{CREDITS_COST.premium_singer} Credits</div>}
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
              {isGenerating ? '生成中...' : '开始 AI 创作'}
            </button>

            {/* Credits exhausted message - preserves access to existing music */}
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
                <strong>本月预览次数已用尽</strong>
                <p style={{ margin: '8px 0 0 0' }}>
                  升级到专业版获取更多创作额度。您仍可访问已生成的预览音乐。
                </p>
              </div>
            )}
          </div>
        </div>
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
