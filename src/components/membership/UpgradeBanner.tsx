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
  const membership = useMembershipStore((s) => s.membership);
  const isLoading = useMembershipStore((s) => s.isLoading);
  const isPaid = useMembershipStore((s) => s.isPaid());

  // 等会员状态明确后再展示，避免刷新瞬间误判为免费用户。
  if (isLoading || !membership || isPaid) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        background: 'linear-gradient(135deg, rgba(18, 18, 30, 0.96) 0%, rgba(31, 24, 50, 0.96) 100%)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(117, 54, 213, 0.35)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.28), 0 -4px 20px rgba(117, 54, 213, 0.12)',
      }}
      role="banner"
      aria-label="升级提示"
    >
      {/* Icon */}
      <span style={{ fontSize: '16px', color: '#c0a7fc' }}>✨</span>

      {/* Text */}
      <span
        style={{
          fontSize: '14px',
          color: '#d8d9e6',
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
