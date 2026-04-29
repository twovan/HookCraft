'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { MembershipTier, BillingCycle } from '@/types/membership';
import type { TierConfig } from '@/config/tierConfig';
import TierCard from '@/components/membership/TierCard';
import { useMembershipStore } from '@/store/membershipStore';

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
  const router = useRouter();
  const { user } = useAuth();
  const currentTier = useMembershipStore((s) => s.currentTier());
  const isBusiness = currentTier === 'business';

  const handleSubscribe = (tier: MembershipTier, cycle: BillingCycle) => {
    if (tier === 'free') return;
    // 未登录用户先跳转到登录页
    if (!user) {
      router.push(`/login?redirectTo=/pricing`);
      return;
    }
    router.push(`/payments?tier=${tier}&cycle=${cycle}`);
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
            fontFamily: "'Inter', sans-serif",
            background:
              billingCycle === 'monthly'
                ? 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)'
                : '#f5f0ea',
            color: billingCycle === 'monthly' ? 'white' : '#6B6B6B',
            boxShadow:
              billingCycle === 'monthly'
                ? '0 4px 12px rgba(212, 165, 116, 0.3)'
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
            fontFamily: "'Inter', sans-serif",
            background:
              billingCycle === 'yearly'
                ? 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)'
                : '#f5f0ea',
            color: billingCycle === 'yearly' ? 'white' : '#6B6B6B',
            boxShadow:
              billingCycle === 'yearly'
                ? '0 4px 12px rgba(212, 165, 116, 0.3)'
                : 'none',
          }}
          aria-pressed={billingCycle === 'yearly'}
        >
          年付
          <span
            style={{
              marginLeft: '6px',
              background: billingCycle === 'yearly' ? 'rgba(255,255,255,0.25)' : '#D4A574',
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
      <section style={{ marginTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '32px',
              fontWeight: 700,
              color: '#2D2D2D',
              marginBottom: '12px',
            }}
          >
            Credits 充值包
          </h2>
          <p style={{ fontSize: '16px', color: '#6B6B6B', lineHeight: 1.6 }}>
            月度配额用尽？随时补充额外 Credits，灵活创作不中断
          </p>
          {isBusiness && (
            <div
              style={{
                display: 'inline-block',
                marginTop: '12px',
                background: 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)',
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
                background: 'white',
                borderRadius: '16px',
                padding: '28px 24px',
                textAlign: 'center',
                border: '1px solid #f0ebe4',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#2D2D2D',
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
                        color: '#D4A574',
                        fontFamily: "'Playfair Display', serif",
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
                      color: '#D4A574',
                      fontFamily: "'Playfair Display', serif",
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
                onClick={() => router.push(`/payments/credits-pack?pack=${pack.id}`)}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  border: '1px solid #D4A574',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'Inter', sans-serif",
                  background: 'transparent',
                  color: '#D4A574',
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
          box-shadow: 0 16px 48px rgba(212, 165, 116, 0.18) !important;
        }
        .credits-pack-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(212, 165, 116, 0.12) !important;
          border-color: #D4A574 !important;
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
