'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import type { MembershipTier, BillingCycle } from '@/types/membership';
import type { TierConfig } from '@/config/tierConfig';
import type { PublicCreditsPack } from '@/config/creditsPack';
import TierCard from '@/components/membership/TierCard';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';

interface PricingContentProps {
  tiers: TierConfig[];
  initialCreditsPacks: PublicCreditsPack[];
}

const TIER_LABELS: Record<MembershipTier, string> = {
  free: '免费版',
  pro: '专业版',
  business: '商业版',
};

export default function PricingContent({ tiers, initialCreditsPacks }: PricingContentProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ tier: string; tier_name: string; monthly_credits: number } | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [creditsPacks, setCreditsPacks] = useState(initialCreditsPacks);
  const router = useRouter();
  const { user } = useAuth();
  const currentTier = useMembershipStore((s) => s.currentTier());
  const fetchCredits = useCreditStore((s) => s.fetchCredits);
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const isBusiness = currentTier === 'business';

  useEffect(() => {
    if (user) {
      fetchMembership();
    }
  }, [user, fetchMembership]);

  useEffect(() => {
    let active = true;

    fetch('/api/payments/credits-pack', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.creditsPacks)) {
          setCreditsPacks(data.creditsPacks);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const handleSubscribe = async (tier: MembershipTier, cycle: BillingCycle) => {
    if (tier === 'free') return;
    if (!user) {
      router.push('/login?redirectTo=/pricing');
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
          tier_name: TIER_LABELS[tier],
          monthly_credits: tierConfig?.monthlyCredits || 0,
        });
        await fetchMembership({ force: true });
      } else {
        setUpgradeError(data.error || '升级失败，请重试');
        window.setTimeout(() => setUpgradeError(null), 5000);
      }
    } catch {
      setUpgradeError('网络错误，请重试');
      window.setTimeout(() => setUpgradeError(null), 5000);
    } finally {
      setUpgrading(false);
    }
  };

  const handleBuyCredits = async (pack: PublicCreditsPack) => {
    if (!user) {
      router.push('/login?redirectTo=/pricing');
      return;
    }
    try {
      const res = await fetchWithAuth('/api/payments/credits-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchCredits({ force: true });
        alert(`充值成功，已增加 ${data.credits_added} 点额度，当前剩余 ${data.remaining} 点额度`);
      } else {
        alert(data.error || '充值失败');
      }
    } catch {
      alert('网络错误，请重试');
    }
  };

  return (
    <div className="pricing-content">
      <div className="billing-toggle" role="group" aria-label="计费周期">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={billingCycle === 'monthly' ? 'active' : ''}
          aria-pressed={billingCycle === 'monthly'}
        >
          月付
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={billingCycle === 'yearly' ? 'active' : ''}
          aria-pressed={billingCycle === 'yearly'}
        >
          年付 <span>省 20%</span>
        </button>
      </div>

      {upgradeResult && (
        <div className="notice success">
          <strong>升级成功</strong>
          <span>已升级至 {upgradeResult.tier_name}，每月 {upgradeResult.monthly_credits} 点额度。</span>
        </div>
      )}
      {upgradeError && <div className="notice error">{upgradeError}</div>}
      {upgrading && <div className="notice loading">正在升级中...</div>}

      <section className="tier-grid" aria-label="会员方案">
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
      </section>

      <section id="credits-pack" className="credits-section">
        <div className="section-heading">
          <span>额度充值包</span>
          <h2>额度充值包</h2>
          <p>月度额度用尽后，可随时补充点额度，让创作不中断。</p>
          {isBusiness && <b>商业版专享折扣</b>}
        </div>

        <div className="credits-grid">
          {creditsPacks.map((pack) => {
            const effectivePrice = isBusiness ? pack.discountPrice : pack.price;
            return (
              <article key={pack.id} className="credits-pack-card">
                <span>{pack.credits} 点额度</span>
                <div className="pack-price">
                  <strong>¥{(effectivePrice / 100).toFixed(0)}</strong>
                  {isBusiness && <del>¥{(pack.price / 100).toFixed(0)}</del>}
                </div>
                <p>¥{(effectivePrice / 100 / pack.credits).toFixed(1)} / 点额度</p>
                <button onClick={() => handleBuyCredits(pack)} aria-label={`购买 ${pack.label}`}>
                  立即购买
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <style>{`
        .pricing-content {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 22px;
        }

        .billing-toggle {
          width: fit-content;
          margin: 0 auto 48px;
          display: flex;
          gap: 4px;
          padding: 5px;
          border: 1px solid var(--hc-line);
          border-radius: 999px;
          background: rgba(24, 26, 34, .78);
        }

        .billing-toggle button {
          border: 1px solid transparent;
          border-radius: 999px;
          background: transparent;
          color: var(--hc-muted);
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
        }

        .billing-toggle button.active {
          border-color: rgba(206,255,53,.36);
          background: rgba(206,255,53,.12);
          color: var(--hc-lime);
        }

        .billing-toggle span {
          margin-left: 6px;
          font-size: 11px;
          color: inherit;
        }

        .notice {
          max-width: 640px;
          margin: 0 auto 26px;
          border-radius: var(--hc-radius);
          padding: 15px 18px;
          text-align: center;
          font-size: 14px;
          font-weight: 800;
        }

        .notice strong,
        .notice span {
          display: block;
        }

        .notice span {
          margin-top: 4px;
          color: var(--hc-muted);
          font-weight: 600;
        }

        .notice.success,
        .notice.loading {
          border: 1px solid rgba(206,255,53,.3);
          background: rgba(206,255,53,.09);
          color: var(--hc-lime);
        }

        .notice.error {
          border: 1px solid rgba(255,90,61,.34);
          background: rgba(255,90,61,.1);
          color: #ff8b76;
        }

        .tier-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 22px;
          align-items: stretch;
          margin-bottom: 76px;
        }

        .tier-card:hover,
        .credits-pack-card:hover {
          transform: translateY(-5px);
          border-color: rgba(206,255,53,.42) !important;
        }

        .credits-section {
          scroll-margin-top: 90px;
        }

        .section-heading {
          text-align: center;
          margin-bottom: 28px;
        }

        .section-heading span {
          color: var(--hc-lime);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .section-heading h2 {
          margin: 8px 0 10px;
          font-size: clamp(30px, 4vw, 44px);
        }

        .section-heading p {
          margin: 0 auto;
          max-width: 580px;
          color: var(--hc-muted);
          line-height: 1.75;
        }

        .section-heading b {
          display: inline-flex;
          margin-top: 14px;
          border: 1px solid rgba(206,255,53,.34);
          border-radius: 999px;
          background: rgba(206,255,53,.1);
          color: var(--hc-lime);
          padding: 7px 12px;
          font-size: 12px;
        }

        .credits-grid {
          max-width: 920px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .credits-pack-card {
          border: 1px solid var(--hc-line);
          border-radius: var(--hc-radius-lg);
          padding: 26px 22px;
          text-align: center;
          background: rgba(24, 26, 34, .88);
          box-shadow: var(--hc-shadow);
          transition: transform .22s ease, border-color .22s ease;
        }

        .credits-pack-card span {
          color: var(--hc-text);
          font-size: 16px;
          font-weight: 950;
        }

        .pack-price {
          margin: 16px 0 8px;
          display: flex;
          justify-content: center;
          align-items: baseline;
          gap: 8px;
        }

        .pack-price strong {
          color: var(--hc-lime);
          font-size: 34px;
          line-height: 1;
        }

        .pack-price del {
          color: var(--hc-muted);
          font-size: 14px;
        }

        .credits-pack-card p {
          margin: 0 0 20px;
          color: var(--hc-muted);
          font-size: 13px;
        }

        .credits-pack-card button {
          width: 100%;
          border: 1px solid rgba(206,255,53,.34);
          border-radius: 999px;
          padding: 12px 18px;
          background: rgba(206,255,53,.08);
          color: var(--hc-lime);
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
        }

        @media (max-width: 980px) {
          .tier-grid {
            grid-template-columns: 1fr;
          }

          .tier-card {
            min-height: auto !important;
            transform: none !important;
          }
        }

        @media (max-width: 680px) {
          .billing-toggle,
          .credits-grid {
            width: 100%;
          }

          .billing-toggle button {
            flex: 1;
          }

          .credits-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
