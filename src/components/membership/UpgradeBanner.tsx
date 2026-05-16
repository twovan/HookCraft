'use client';

import { useMembershipStore } from '@/store/membershipStore';

export interface UpgradeBannerProps {
  onUpgrade?: () => void;
}

/**
 * 升级横幅组件
 * - Free 用户：底部非侵入式横幅"升级到专业版解锁完整 Demo 生成"
 * - 付费用户：隐藏
 */
export default function UpgradeBanner({ onUpgrade }: UpgradeBannerProps) {
  const isPaid = useMembershipStore((s) => s.isPaid());

  // 付费用户不显示
  if (isPaid) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        background: 'linear-gradient(135deg, rgba(253, 251, 247, 0.98) 0%, rgba(245, 230, 211, 0.98) 100%)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(117, 54, 213, 0.2)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        boxShadow: '0 -4px 20px rgba(117, 54, 213, 0.08)',
      }}
      role="banner"
      aria-label="升级提示"
    >
      {/* Icon */}
      <span style={{ fontSize: '16px' }}>✨</span>

      {/* Text */}
      <span
        style={{
          fontSize: '14px',
          color: '#e8e8f0',
          fontWeight: 500,
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}
      >
        升级到专业版解锁完整 Demo 生成
      </span>

      {/* CTA Button */}
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          style={{
            padding: '8px 20px',
            borderRadius: '20px',
            border: 'none',
            background: 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(117, 54, 213, 0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          了解更多
        </button>
      )}
    </div>
  );
}
