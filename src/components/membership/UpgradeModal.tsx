'use client';

import { useEffect, useRef } from 'react';
import type { MembershipTier } from '@/types/membership';
import { TIER_CONFIGS } from '@/config/tierConfig';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: MembershipTier;
  requiredFeature: string;
  recommendedTier?: MembershipTier;
  onNavigateToPricing: () => void;
}

const TIER_LABELS: Record<MembershipTier, string> = {
  free: '免费版',
  pro: '专业版',
  business: '商业版',
};

export default function UpgradeModal({
  isOpen,
  onClose,
  currentTier,
  requiredFeature,
  recommendedTier = 'pro',
  onNavigateToPricing,
}: UpgradeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && dialogRef.current) dialogRef.current.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const recommendedConfig = TIER_CONFIGS[recommendedTier];

  return (
    <div className="upgrade-modal-root" role="presentation">
      <div className="upgrade-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        tabIndex={-1}
        className="upgrade-dialog"
      >
        <button onClick={onClose} aria-label="关闭" className="close-button">×</button>
        <span className="eyebrow">需要升级</span>
        <h2 id="upgrade-modal-title">升级解锁更多功能</h2>
        <p>
          你当前为 {TIER_LABELS[currentTier]}，“{requiredFeature}” 需要 {TIER_LABELS[recommendedTier]} 或更高等级才能使用。
        </p>

        <div className="recommended-card">
          <div>
            <span>推荐方案</span>
            <strong>{TIER_LABELS[recommendedTier]}</strong>
          </div>
          <b>¥{(recommendedConfig.monthlyPrice / 100).toFixed(0)}/月</b>
          <p>{recommendedConfig.monthlyCredits} 点额度/月 · 完整生成 · 高级声模</p>
        </div>

        <div className="actions">
          <button onClick={onClose}>稍后再说</button>
          <button className="primary" onClick={onNavigateToPricing}>查看方案</button>
        </div>
      </div>

      <style>{`
        .upgrade-modal-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          padding: 24px;
        }

        .upgrade-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,.52);
          backdrop-filter: blur(6px);
        }

        .upgrade-dialog {
          position: relative;
          width: min(440px, 100%);
          border: 1px solid var(--hc-line);
          border-radius: var(--hc-radius-lg);
          background: #15181f;
          box-shadow: var(--hc-shadow);
          padding: 30px;
          outline: none;
        }

        .close-button {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 34px;
          height: 34px;
          border: 1px solid var(--hc-line);
          border-radius: 50%;
          background: rgba(255,255,255,.04);
          color: var(--hc-muted);
          font-size: 22px;
          cursor: pointer;
        }

        .eyebrow {
          color: var(--hc-lime);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .upgrade-dialog h2 {
          margin: 10px 0 8px;
          color: var(--hc-text);
          font-size: 24px;
        }

        .upgrade-dialog p,
        .recommended-card p {
          color: var(--hc-muted);
          line-height: 1.7;
          font-size: 14px;
        }

        .recommended-card {
          border: 1px solid var(--hc-line);
          border-radius: 14px;
          background: rgba(8,9,12,.38);
          padding: 16px;
          margin: 20px 0;
        }

        .recommended-card div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .recommended-card span {
          color: var(--hc-muted);
          font-size: 12px;
        }

        .recommended-card strong,
        .recommended-card b {
          color: var(--hc-lime);
        }

        .actions {
          display: flex;
          gap: 12px;
        }

        .actions button {
          flex: 1;
          border: 1px solid var(--hc-line);
          border-radius: 999px;
          background: transparent;
          color: var(--hc-text);
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .actions .primary {
          border-color: transparent;
          background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
          color: #08090c;
        }
      `}</style>
    </div>
  );
}
