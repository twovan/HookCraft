'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import type { MembershipTier, BillingCycle } from '@/types/membership';
import type { TierConfig } from '@/config/tierConfig';
import TierCard from '@/components/membership/TierCard';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';

interface PricingContentProps {
  tiers: TierConfig[];
}

/** Credits 充值包配置 */
const CREDITS_PACKS = [
  { id: 'pack_50', credits: 50, price: 9900, discountPrice: 7900, label: '50 Credits' },
  { id: 'pack_100', credits: 100, price: 17900, discountPrice: 14300, label: '100 Credits' },
  { id: 'pack_200', credits: 200, price: 32900, discountPrice: 26300, label: '200 Credits' },
];

export default function PricingContent({ tiers }: PricingContentProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ tier: string; tier_name: string; monthly_credits: number } | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const currentTier = useMembershipStore((s) => s.currentTier());
  const fetchCredits = useCreditStore((s) => s.fetchCredits);
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const isBusiness = currentTier === 'business';

  // Fetch membership on mount to ensure correct tier is displayed
  useEffect(() => {
    if (user) {
      fetchMembership();
    }
  }, [user]);

  const handleSubscribe = async (tier: MembershipTier, cycle: BillingCycle) => {
    if (tier === 'free') return;
    // 未登录用户先跳转到登录页
    if (!user) {
      router.push(`/login?redirectTo=/pricing`);
      return;
    }
    if (tier === currentTier) return;

    setUpgrading(true);
    setUpgradeError(null);
    setUpgradeResult(null);
    try {
      const res = await fetchWithAuth('/api/membership/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: tier, billingCycle: cycle }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const tierConfig = tiers.find((t) => t.tier === tier);
        setUpgradeResult({
          tier,
          tier_name: tierConfig?.name || tier,
          monthly_credits: tierConfig?.monthlyCredits || 0,
        });
        // Refresh membership store
        await fetchMembership({ force: true });
      } else {
        setUpgradeError(data.error || '升级失败，请重试');
        setTimeout(() => setUpgradeError(null), 5000);
      }
    } catch {
      setUpgradeError('网络错误，请重试');
      setTimeout(() => setUpgradeError(null), 5000);
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 80px' }}>
      {/* Billing cycle toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '48px',
        }}
      >
        <button
          onClick={() => setBillingCycle('monthly')}
          style={{
            padding: '10px 24px',
            borderRadius: '20px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            background:
              billingCycle === 'monthly'
                ? 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)'
                : '#1a1a2e',
            color: billingCycle === 'monthly' ? 'white' : '#9ca3af',
            boxShadow:
              billingCycle === 'monthly'
                ? '0 4px 12px rgba(117, 54, 213, 0.3)'
                : 'none',
          }}
          aria-pressed={billingCycle === 'monthly'}
        >
          月付
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          style={{
            padding: '10px 24px',
            borderRadius: '20px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            background:
              billingCycle === 'yearly'
                ? 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)'
                : '#1a1a2e',
            color: billingCycle === 'yearly' ? 'white' : '#9ca3af',
            boxShadow:
              billingCycle === 'yearly'
                ? '0 4px 12px rgba(117, 54, 213, 0.3)'
                : 'none',
          }}
          aria-pressed={billingCycle === 'yearly'}
        >
          年付
          <span
            style={{
              marginLeft: '6px',
              background: billingCycle === 'yearly' ? 'rgba(255,255,255,0.25)' : '#7536d5',
              color: billingCycle === 'yearly' ? 'white' : 'white',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            省 20%
          </span>
        </button>
      </div>

      {/* Upgrade result/error messages */}
      {upgradeResult && (
        <div style={{
          maxWidth: 600, margin: '0 auto 32px', padding: '20px 24px', borderRadius: 16,
          background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>
            升级成功！
          </div>
          <div style={{ fontSize: 14, color: '#15803d' }}>
            已升级至 {upgradeResult.tier_name}，每月 {upgradeResult.monthly_credits} Credits
          </div>
        </div>
      )}
      {upgradeError && (
        <div style={{
          maxWidth: 600, margin: '0 auto 32px', padding: '16px 24px', borderRadius: 16,
          background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'center',
          color: '#dc2626', fontSize: 14, fontWeight: 500,
        }}>
          {upgradeError}
        </div>
      )}
      {upgrading && (
        <div style={{
          maxWidth: 600, margin: '0 auto 32px', padding: '16px 24px', borderRadius: 16,
          background: 'rgba(117, 54, 213, 0.1)', border: '1px solid rgba(117, 54, 213, 0.3)', textAlign: 'center',
          color: '#a78bfa', fontSize: 14, fontWeight: 500,
        }}>
          正在升级中...
        </div>
      )}

      {/* Tier cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '28px',
          alignItems: 'start',
          marginBottom: '80px',
        }}
      >
        {tiers.map((tierConfig) => (
          <TierCard
            key={tierConfig.tier}
            tier={tierConfig.tier}
            config={tierConfig}
            billingCycle={billingCycle}
            isCurrentTier={currentTier === tierConfig.tier}
            isRecommended={tierConfig.tier === 'pro'}
            onSubscribe={handleSubscribe}
          />
        ))}
      </div>

      {/* Credits Pack section */}
      <section id="credits-pack" style={{ marginTop: '40px', scrollMarginTop: '80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2
            style={{
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              fontSize: '32px',
              fontWeight: 700,
              color: '#e8e8f0',
              marginBottom: '12px',
            }}
          >
            Credits 充值包
          </h2>
          <p style={{ fontSize: '16px', color: '#9ca3af', lineHeight: 1.6 }}>
            月度配额用尽？随时补充额外 Credits，灵活创作不中断
          </p>
          {isBusiness && (
            <div
              style={{
                display: 'inline-block',
                marginTop: '12px',
                background: 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
                color: 'white',
                padding: '6px 16px',
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              商业版专享折扣
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            maxWidth: '900px',
            margin: '0 auto',
          }}
        >
          {CREDITS_PACKS.map((pack) => (
            <div
              key={pack.id}
              className="credits-pack-card"
              style={{
                background: '#1a1a2e',
                borderRadius: '16px',
                padding: '28px 24px',
                textAlign: 'center',
                border: '1px solid #2a2a40',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#e8e8f0',
                  marginBottom: '8px',
                }}
              >
                {pack.label}
              </div>
              <div style={{ marginBottom: '16px' }}>
                {isBusiness ? (
                  <>
                    <span
                      style={{
                        fontSize: '28px',
                        fontWeight: 700,
                        color: '#7536d5',
                        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      }}
                    >
                      ¥{(pack.discountPrice / 100).toFixed(0)}
                    </span>
                    <span
                      style={{
                        fontSize: '14px',
                        color: '#999',
                        textDecoration: 'line-through',
                        marginLeft: '8px',
                      }}
                    >
                      ¥{(pack.price / 100).toFixed(0)}
                    </span>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#7536d5',
                      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                    }}
                  >
                    ¥{(pack.price / 100).toFixed(0)}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#999',
                  marginBottom: '20px',
                }}
              >
                ¥{((isBusiness ? pack.discountPrice : pack.price) / 100 / pack.credits).toFixed(1)}/Credit
              </div>
              <button
                onClick={async () => {
                  if (!user) { router.push('/login?redirectTo=/pricing'); return; }
                  try {
                    const res = await fetchWithAuth('/api/payments/credits-pack', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ packId: pack.id }),
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      // Refresh credit store after successful purchase
                      fetchCredits({ force: true });
                      alert(`充值成功！已增加 ${data.credits_added} Credits，当前剩余 ${data.remaining} Credits`);
                    } else {
                      alert(data.error || '充值失败');
                    }
                  } catch { alert('网络错误，请重试'); }
                }}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  border: '1px solid #7536d5',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  background: 'transparent',
                  color: '#7536d5',
                }}
                aria-label={`购买 ${pack.label}`}
              >
                立即购买
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Hover styles */}
      <style>{`
        .tier-card:hover {
          transform: translateY(-8px) !important;
          box-shadow: 0 16px 48px rgba(117, 54, 213, 0.18) !important;
        }
        .credits-pack-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(117, 54, 213, 0.12) !important;
          border-color: #7536d5 !important;
        }
        @media (max-width: 768px) {
          .tier-card:hover {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
