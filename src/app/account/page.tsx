'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
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
    // Fetch credit history
    fetchCreditHistory();
    // Fetch purchase history
    fetchPurchaseHistory();
  }, []);

  // 在 membership 加载完成后，根据等级加载对应的 credits 数据
  useEffect(() => {
    if (membership) {
      if (isPaid) {
        fetchCredits();
      } else {
        fetchPreviewCount();
      }
    }
  }, [membership]);

  const fetchCreditHistory = async () => {
    try {
      const res = await fetchWithAuth('/api/credits/history');
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
      const res = await fetchWithAuth('/api/payments');
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
      const res = await fetchWithAuth('/api/payments', { method: 'POST' });
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
      const res = await fetchWithAuth('/api/membership/upgrade', {
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
      const res = await fetchWithAuth('/api/membership/downgrade', {
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
      const res = await fetchWithAuth('/api/membership/cancel', { method: 'POST' });
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
      <div style={{ minHeight: '100vh', background: '#0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: '#999' }}>加载中...</div>
      </div>
    );
  }

  if (!membership) {
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
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div>
            <h1
              style={{
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                fontSize: '36px',
                fontWeight: 700,
                color: '#e8e8f0',
                marginBottom: '8px',
              }}
            >
              账户管理
            </h1>
            <p style={{ fontSize: '15px', color: '#9ca3af', margin: 0 }}>
              {user.email} · 管理你的会员订阅和创作额度
            </p>
          </div>
          <button
            onClick={signOut}
            style={{
              padding: '8px 16px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              background: '#1a1a2e',
              color: '#9ca3af',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
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
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
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
              background: '#1a1a2e',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid #2a2a40',
              boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
            }}
          >
            <h3
              style={{
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                fontSize: '16px',
                fontWeight: 600,
                color: '#e8e8f0',
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
                        color: '#7536d5',
                        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      }}
                    >
                      {credits.monthlyUsed}
                    </span>
                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>
                      / {credits.monthlyTotal} Credits 已消耗
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      background: '#2a2a40',
                      borderRadius: '6px',
                      height: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: '6px',
                        width: `${credits.monthlyTotal > 0 ? (credits.monthlyUsed / credits.monthlyTotal) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #7536d5, #5a2db8)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      月度剩余 {credits.monthlyRemaining} Credits
                    </span>
                    {credits.purchasedBalance > 0 && (
                      <span style={{ fontSize: '12px', color: '#6B46C1', fontWeight: 500 }}>
                        购买余额 {credits.purchasedBalance}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    总可用 {credits.totalAvailable} Credits
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
                        color: '#7536d5',
                        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      }}
                    >
                      {previewCount.used}
                    </span>
                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>
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
                            : 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
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
              background: '#1a1a2e',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid #2a2a40',
              boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
            }}
          >
            <h3
              style={{
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                fontSize: '16px',
                fontWeight: 600,
                color: '#e8e8f0',
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
                  const monthlyHeight = maxUsage > 0 ? ((month.monthlyUsed ?? 0) / maxUsage) * 100 : 0;
                  const purchasedHeight = maxUsage > 0 ? ((month.purchasedUsed ?? 0) / maxUsage) * 100 : 0;
                  const totalHeight = monthlyHeight + purchasedHeight;
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
                          display: 'flex',
                          flexDirection: 'column',
                          height: `${Math.max(totalHeight, 4)}%`,
                          minHeight: '4px',
                        }}
                        title={`${month.month}: 月度 ${month.monthlyUsed ?? 0} + 购买 ${month.purchasedUsed ?? 0} / ${month.total}`}
                      >
                        {/* 购买 Credits 部分（紫色，上方） */}
                        {(month.purchasedUsed ?? 0) > 0 && (
                          <div
                            style={{
                              width: '100%',
                              flex: purchasedHeight,
                              background: 'linear-gradient(180deg, #9F7AEA 0%, #B794F4 100%)',
                              borderRadius: monthlyHeight > 0 ? '4px 4px 0 0' : '4px',
                              transition: 'flex 0.3s ease',
                            }}
                          />
                        )}
                        {/* 月度 Credits 部分（金色，下方） */}
                        {(month.monthlyUsed ?? 0) > 0 && (
                          <div
                            style={{
                              width: '100%',
                              flex: monthlyHeight,
                              background: 'linear-gradient(180deg, #7536d5 0%, #E8C9A8 100%)',
                              borderRadius: purchasedHeight > 0 ? '0 0 0 0' : '4px 4px 0 0',
                              transition: 'flex 0.3s ease',
                            }}
                          />
                        )}
                        {/* Fallback if both are 0 but used > 0 (legacy data) */}
                        {(month.monthlyUsed ?? 0) === 0 && (month.purchasedUsed ?? 0) === 0 && month.used > 0 && (
                          <div
                            style={{
                              width: '100%',
                              flex: 1,
                              background: 'linear-gradient(180deg, #7536d5 0%, #E8C9A8 100%)',
                              borderRadius: '4px 4px 0 0',
                            }}
                          />
                        )}
                      </div>
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
