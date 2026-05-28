'use client';

import { useMembershipStore } from '@/store/membershipStore';

export interface UpgradeBannerProps {
  onUpgrade?: () => void;
}

export default function UpgradeBanner({ onUpgrade }: UpgradeBannerProps) {
  const membership = useMembershipStore((s) => s.membership);
  const isLoading = useMembershipStore((s) => s.isLoading);
  const isPaid = useMembershipStore((s) => s.isPaid());

  if (isLoading || !membership || isPaid) return null;

  return (
    <div className="upgrade-banner" role="banner" aria-label="升级提示">
      <span>升级到专业版解锁完整生成</span>
      {onUpgrade && <button onClick={onUpgrade}>了解更多</button>}
      <style>{`
        .upgrade-banner {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 12px 20px;
          border-top: 1px solid rgba(206,255,53,.28);
          background: rgba(13,15,20,.94);
          backdrop-filter: blur(12px);
          box-shadow: 0 -16px 40px rgba(0,0,0,.28);
        }

        .upgrade-banner span {
          color: var(--hc-text);
          font-size: 14px;
          font-weight: 800;
        }

        .upgrade-banner button {
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
          color: #08090c;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
        }

        @media (max-width: 560px) {
          .upgrade-banner {
            align-items: stretch;
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
