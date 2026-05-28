'use client';

import { useState } from 'react';
import type { MembershipTier } from '@/types/membership';

export interface MembershipBadgeProps {
  tier: MembershipTier;
  expiresAt?: Date | string | null;
  creditsRemaining?: number;
  creditsTotal?: number;
  previewsRemaining?: number;
  previewsTotal?: number;
}

export default function MembershipBadge({
  tier,
  expiresAt,
  creditsRemaining,
  creditsTotal,
  previewsRemaining,
  previewsTotal,
}: MembershipBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (tier === 'free') return null;

  const tierName = tier === 'pro' ? '专业版' : '商业版';
  const label = tier === 'pro' ? 'Pro' : 'Business';

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div
      className="membership-badge-wrap"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="membership-badge" role="status" aria-label={`会员等级：${tierName}`}>
        {label}
      </div>

      {showTooltip && (
        <div className="membership-tooltip" role="tooltip">
          <strong>{tierName}</strong>
          <div>
            <span>到期日期</span>
            <b>{formatDate(expiresAt)}</b>
          </div>
          {creditsRemaining !== undefined && creditsTotal !== undefined && (
            <div>
              <span>剩余额度</span>
              <b>{creditsRemaining}/{creditsTotal}</b>
            </div>
          )}
          {previewsRemaining !== undefined && previewsTotal !== undefined && (
            <div>
              <span>剩余预览</span>
              <b>{previewsRemaining}/{previewsTotal}</b>
            </div>
          )}
        </div>
      )}

      <style>{`
        .membership-badge-wrap {
          position: relative;
          display: inline-flex;
        }

        .membership-badge {
          border: 1px solid rgba(206,255,53,.34);
          border-radius: 999px;
          background: rgba(206,255,53,.11);
          color: var(--hc-lime);
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 950;
          cursor: default;
        }

        .membership-tooltip {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 1000;
          min-width: 210px;
          border: 1px solid var(--hc-line);
          border-radius: 12px;
          background: #15181f;
          box-shadow: var(--hc-shadow);
          padding: 14px;
        }

        .membership-tooltip strong {
          display: block;
          color: var(--hc-text);
          margin-bottom: 12px;
        }

        .membership-tooltip div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 6px 0;
          color: var(--hc-muted);
          font-size: 13px;
        }

        .membership-tooltip b {
          color: var(--hc-lime);
        }
      `}</style>
    </div>
  );
}
