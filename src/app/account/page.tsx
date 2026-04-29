'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import SubscriptionPanel from '@/components/membership/SubscriptionPanel';
import type { PaymentRecord } from '@/types/payment';
import type { CreditHistory } from '@/types/credits';
import type { MembershipTier } from '@/types/membership';

/**
 * 账户管理页面
 * - 月度 Credits 使用统计（付费：consumed/total，Free：used/3 previews）
 * - 历史使用趋势（简单柱状图占位）
 * - 支付失败错误显示与重试
 * - 订阅管理面板
 * - 使用 Supabase Auth 获取当前用户信息，未登录时重定向到登录页
 */
export default function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  // 未登录时重定向到登录页（客户端安全网，中间件已处理）
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirectTo=/account');
    }
  }, [authLoading, user, router]);

  const membership = useMembershipStore((s) => s.membership);
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const credits = useCreditStore((s) => s.credits);
  const previewCount = useCreditStore((s) => s.previewCount);
  const fetchCredits = useCreditStore((s) => s.fetchCredits);
  const fetchPreviewCount = useCreditStore((s) => s.fetchPreviewCount);
  const isPaid = useMembershipStore((s) => s.isPaid());

  const [creditHistory, setCreditHistory] = useState<CreditHistory[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PaymentRecord[]>([]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    fetchMembership();
    if (isPaid) {
      fetchCredits();
    } else {
      fetchPreviewCount();
    }
    // Fetch credit history
    fetchCreditHistory();
    // Fetch purchase history
    fetchPurchaseHistory();
  }, []);

  const fetchCreditHistory = async () => {
    try {
      const res = await fetch('/api/credits/history');
      if (res.ok) {
        const data = await res.json();
        setCreditHistory(data);
      }
    } catch {
      // Silently fail - history is non-critical
    }
  };

  const fetchPurchaseHistory = async () => {
    try {
      const res = await fetch('/api/payments');
      if (res.ok) {
        const data = await res.json();
        setPurchaseHistory(data.filter((r: PaymentRecord) => r.status !== 'pending'));
      }
    } catch {
      // Silently fail
    }
  };

  const handleRetryPayment = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/payments', { method: 'POST' });
      if (res.ok) {
        setPaymentError(null);
      } else {
        const data = await res.json();
        setPaymentError(data.error || '支付重试失败，请稍后再试');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleUpgrade = async (targetTier: MembershipTier) => {
    try {
      const res = await fetch('/api/membership/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      if (res.ok) {
        fetchMembership();
        fetchCredits();
      } else {
        const data = await res.json();
        setPaymentError(data.error || '升级失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    }
  };

  const handleDowngrade = async (targetTier: MembershipTier) => {
    try {
      const res = await fetch('/api/membership/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      if (res.ok) {
        fetchMembership();
      } else {
        const data = await res.json();
        setPaymentError(data.error || '降级失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    }
  };

  const handleCancel = async () => {
    try {
      const res = await fetch('/api/membership/cancel', { method: 'POST' });
      if (res.ok) {
        fetchMembership();
      } else {
        const data = await res.json();
        setPaymentError(data.error || '取消订阅失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    }
  };

  // Find max value for bar chart scaling
  const maxUsage = creditHistory.length > 0
    ? Math.max(...creditHistory.map((h) => h.total), 1)
    : 1;

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: '#999' }}>加载中...</div>
      </div>
    );
  }

  if (!membership) {
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
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '36px',
                fontWeight: 700,
                color: '#2D2D2D',
                marginBottom: '8px',
              }}
            >
              账户管理
            </h1>
            <p style={{ fontSize: '15px', color: '#6B6B6B', margin: 0 }}>
              {user.email} · 管理你的会员订阅和创作额度
            </p>
          </div>
          <button
            onClick={signOut}
            style={{
              padding: '8px 16px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              background: 'white',
              color: '#6B6B6B',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            退出登录
          </button>
        </div>

        {/* Payment Error Alert */}
        {paymentError && (
          <div
            style={{
              background: '#FFF5F5',
              borderRadius: '12px',
              padding: '16px 20px',
              border: '1px solid #FED7D7',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
            role="alert"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span style={{ fontSize: '14px', color: '#C53030', fontWeight: 500 }}>
                {paymentError}
              </span>
            </div>
            <button
              onClick={handleRetryPayment}
              disabled={isRetrying}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: 'none',
                background: '#E53E3E',
                color: 'white',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                opacity: isRetrying ? 0.6 : 1,
                fontFamily: "'Inter', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              {isRetrying ? '重试中...' : '重试支付'}
            </button>
          </div>
        )}

        {/* Usage Stats Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '32px',
          }}
        >
          {/* Monthly Credits Usage */}
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid #f0ebe4',
              boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
            }}
          >
            <h3
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '16px',
                fontWeight: 600,
                color: '#2D2D2D',
                margin: '0 0 16px 0',
              }}
            >
              本月用量
            </h3>

            {isPaid && credits ? (
              <>
                {/* Paid user: Credits usage */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        color: '#D4A574',
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {credits.used}
                    </span>
                    <span style={{ fontSize: '14px', color: '#6B6B6B' }}>
                      / {credits.total} Credits 已消耗
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      background: '#f0ebe4',
                      borderRadius: '6px',
                      height: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: '6px',
                        width: `${credits.total > 0 ? (credits.used / credits.total) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #D4A574, #C9A86A)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                    剩余 {credits.remaining} Credits
                  </div>
                </div>
              </>
            ) : !isPaid && previewCount ? (
              <>
                {/* Free user: Preview count */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        color: '#D4A574',
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {previewCount.used}
                    </span>
                    <span style={{ fontSize: '14px', color: '#6B6B6B' }}>
                      / {previewCount.total} 次预览已使用
                    </span>
                  </div>
                  {/* Dot indicators */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {Array.from({ length: previewCount.total }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: i < previewCount.used
                            ? '#E2E8F0'
                            : 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: i < previewCount.used ? '#A0AEC0' : 'white',
                          fontWeight: 600,
                        }}
                      >
                        {i < previewCount.used ? '✓' : '♪'}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                    剩余 {previewCount.remaining} 次预览
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: '#999' }}>加载中...</div>
            )}
          </div>

          {/* Historical Usage Trend (Bar Chart Placeholder) */}
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid #f0ebe4',
              boxShadow: '0 4px 20px rgba(212, 165, 116, 0.06)',
            }}
          >
            <h3
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '16px',
                fontWeight: 600,
                color: '#2D2D2D',
                margin: '0 0 16px 0',
              }}
            >
              使用趋势
            </h3>

            {creditHistory.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px',
                  height: '120px',
                  padding: '0 4px',
                }}
                role="img"
                aria-label="月度使用趋势柱状图"
              >
                {creditHistory.slice(-6).map((month) => {
                  const heightPercent = maxUsage > 0 ? (month.used / maxUsage) * 100 : 0;
                  return (
                    <div
                      key={month.month}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '32px',
                          height: `${Math.max(heightPercent, 4)}%`,
                          background: 'linear-gradient(180deg, #D4A574 0%, #E8C9A8 100%)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease',
                          minHeight: '4px',
                        }}
                        title={`${month.month}: ${month.used}/${month.total}`}
                      />
                      <span style={{ fontSize: '10px', color: '#999', whiteSpace: 'nowrap' }}>
                        {month.month.slice(5)}月
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  height: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  fontSize: '13px',
                }}
              >
                暂无历史数据
              </div>
            )}
          </div>
        </div>

        {/* Subscription Panel */}
        <SubscriptionPanel
          membership={membership}
          creditsPurchaseHistory={purchaseHistory}
          onUpgrade={handleUpgrade}
          onDowngrade={handleDowngrade}
          onCancel={handleCancel}
          onBuyCredits={() => window.open('/pricing#credits-pack', '_blank')}
        />
      </div>
    </div>
  );
}
