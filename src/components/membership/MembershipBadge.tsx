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

/**
 * 会员徽章组件
 * - Pro: 金色徽章
 * - Business: 钻石徽章
 * - Free: 不显示徽章
 * - Hover 显示浮层卡片：等级名称、到期日期、剩余 Credits/Previews
 */
export default function MembershipBadge({
  tier,
  expiresAt,
  creditsRemaining,
  creditsTotal,
  previewsRemaining,
  previewsTotal,
}: MembershipBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Free 用户不显示徽章
  if (tier === 'free') return null;

  const badgeConfig = {
    pro: {
      icon: '⭐',
      label: 'Pro',
      color: '#D4A574',
      bgColor: 'linear-gradient(135deg, #F5E6D3 0%, #FDF8F3 100%)',
      borderColor: '#D4A574',
    },
    business: {
      icon: '💎',
      label: 'Business',
      color: '#7C3AED',
      bgColor: 'linear-gradient(135deg, #EDE9FE 0%, #F5F3FF 100%)',
      borderColor: '#7C3AED',
    },
  };

  const config = badgeConfig[tier];

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const tierName = tier === 'pro' ? '专业版' : '商业版';

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '12px',
          background: config.bgColor,
          border: `1px solid ${config.borderColor}`,
          cursor: 'default',
          transition: 'all 0.2s ease',
        }}
        role="status"
        aria-label={`会员等级：${tierName}`}
      >
        <span style={{ fontSize: '12px' }}>{config.icon}</span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: config.color,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {config.label}
        </span>
      </div>

      {/* Tooltip card */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            minWidth: '200px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            border: '1px solid #f0ebe4',
            zIndex: 1000,
            animation: 'tooltipFadeIn 0.15s ease',
          }}
          role="tooltip"
        >
          {/* Tier name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '16px' }}>{config.icon}</span>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#2D2D2D',
                fontFamily: "'Playfair Display', serif",
              }}
            >
              {tierName}
            </span>
          </div>

          {/* Info rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Expiry */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '13px',
              }}
            >
              <span style={{ color: '#999' }}>到期日期</span>
              <span style={{ color: '#2D2D2D', fontWeight: 500 }}>
                {formatDate(expiresAt)}
              </span>
            </div>

            {/* Credits */}
            {creditsRemaining !== undefined && creditsTotal !== undefined && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: '#999' }}>剩余 Credits</span>
                <span style={{ color: '#D4A574', fontWeight: 600 }}>
                  {creditsRemaining}/{creditsTotal}
                </span>
              </div>
            )}

            {/* Previews (for display if needed) */}
            {previewsRemaining !== undefined && previewsTotal !== undefined && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: '#999' }}>剩余预览</span>
                <span style={{ color: '#D4A574', fontWeight: 600 }}>
                  {previewsRemaining}/{previewsTotal}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
