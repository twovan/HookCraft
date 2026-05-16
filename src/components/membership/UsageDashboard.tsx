'use client';

import { useCreditStore } from '@/store/creditStore';
import { useMembershipStore } from '@/store/membershipStore';

export interface UsageDashboardProps {
  onUpgrade?: () => void;
  onBuyCredits?: () => void;
}

/**
 * 额度面板组件
 * - 付费用户：显示月度 Credits 进度条 + 购买 Credits 余额 + 总可用量
 * - Free 用户：显示剩余 Preview 次数（如"剩余 2/3 次预览"）
 * - Credits < 20%：琥珀色高亮警告，推荐 Credits Pack
 * - Credits 耗尽：禁用按钮，显示"Credits 不足"
 * - 月度用尽但购买有余额：显示提示信息
 * - Free 用户次数耗尽：禁用 Preview 按钮，显示升级提示
 */
export default function UsageDashboard({ onUpgrade, onBuyCredits }: UsageDashboardProps) {
  const credits = useCreditStore((s) => s.credits);
  const previewCount = useCreditStore((s) => s.previewCount);
  const isLow = useCreditStore((s) => s.isLow());
  const isExhausted = useCreditStore((s) => s.isExhausted());
  const isMonthlyExhausted = useCreditStore((s) => s.isMonthlyExhausted());
  const resetCountdown = useCreditStore((s) => s.resetCountdown());
  const isPaid = useMembershipStore((s) => s.isPaid());

  const isFreeExhausted = !isPaid && previewCount !== null && previewCount.remaining === 0;

  return (
    <div
      style={{
        background: isExhausted
          ? 'linear-gradient(135deg, rgba(229, 57, 53, 0.1) 0%, #FFF0F0 100%)'
          : isLow
            ? 'linear-gradient(135deg, #FFFBF0 0%, #FFF8E6 100%)'
            : 'white',
        borderRadius: '16px',
        padding: '20px 24px',
        border: isExhausted
          ? '1px solid rgba(229, 57, 53, 0.3)'
          : isLow
            ? '1px solid #F6E05E'
            : '1px solid #2a2a40',
        boxShadow: '0 2px 12px rgba(117, 54, 213, 0.08)',
      }}
      role="region"
      aria-label="用量面板"
    >
      {/* 标题行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: '16px',
            fontWeight: 600,
            color: '#e8e8f0',
            margin: 0,
          }}
        >
          {isPaid ? 'Credits 用量' : '预览次数'}
        </h3>
        {resetCountdown && (
          <span
            style={{
              fontSize: '12px',
              color: '#999',
              fontWeight: 400,
            }}
          >
            {resetCountdown}
          </span>
        )}
      </div>

      {/* 付费用户：Credits 显示 */}
      {isPaid && credits && (
        <>
          {/* 月度 Credits 进度条 */}
          <div style={{ marginBottom: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
                月度 Credits
              </span>
              <span style={{ fontSize: '12px', color: '#999' }}>
                {credits.monthlyUsed} / {credits.monthlyTotal}
              </span>
            </div>
            <div
              style={{
                background: '#2a2a40',
                borderRadius: '8px',
                height: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: '8px',
                  width: `${credits.monthlyTotal > 0 ? (credits.monthlyUsed / credits.monthlyTotal) * 100 : 0}%`,
                  background: isMonthlyExhausted
                    ? '#D69E2E'
                    : 'linear-gradient(90deg, #7536d5, #5a2db8)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* 购买 Credits 余额 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
              购买 Credits
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6B46C1',
                background: '#F3E8FF',
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              {credits.purchasedBalance}
            </span>
          </div>

          {/* 总可用量 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: isExhausted ? '#E53E3E' : isLow ? '#D69E2E' : '#7536d5',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}
            >
              {credits.totalAvailable}
            </span>
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>
              可用 Credits
            </span>
          </div>

          {/* 已消耗 */}
          <div style={{ fontSize: '13px', color: '#999', marginBottom: '12px' }}>
            本月已消耗 {credits.monthlyUsed} Credits
          </div>

          {/* 月度用尽但购买有余额提示 */}
          {isMonthlyExhausted && !isExhausted && (
            <div
              style={{
                background: '#EBF8FF',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#2B6CB0',
                fontWeight: 500,
                marginBottom: '12px',
              }}
              role="status"
            >
              月度额度已用尽，当前使用购买 Credits
            </div>
          )}

          {/* 警告状态 */}
          {isExhausted && (
            <div
              style={{
                background: 'rgba(229, 57, 53, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#C53030',
                fontWeight: 500,
                marginBottom: '12px',
              }}
              role="alert"
            >
              Credits 不足，请购买 Credits 充值包或升级会员
            </div>
          )}

          {isLow && !isExhausted && !isMonthlyExhausted && (
            <div
              style={{
                background: '#FEFCBF',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#975A16',
                fontWeight: 500,
                marginBottom: '12px',
              }}
              role="alert"
            >
              Credits 即将用尽，推荐购买 Credits 充值包
            </div>
          )}

          {/* 购买按钮 */}
          {(isLow || isExhausted) && onBuyCredits && (
            <button
              onClick={onBuyCredits}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
                color: 'white',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}
            >
              购买 Credits 充值包
            </button>
          )}
        </>
      )}

      {/* Free 用户：Preview 次数显示 */}
      {!isPaid && previewCount && (
        <>
          {/* 圆点指示器 */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            {Array.from({ length: previewCount.total }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: i < previewCount.used
                    ? '#E2E8F0'
                    : 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: i < previewCount.used ? '#A0AEC0' : 'white',
                  fontWeight: 600,
                }}
                aria-hidden="true"
              >
                {i < previewCount.used ? '✓' : '♪'}
              </div>
            ))}
          </div>

          {/* 文字 */}
          <div
            style={{
              fontSize: '14px',
              color: isFreeExhausted ? '#E53E3E' : '#e8e8f0',
              fontWeight: 500,
              marginBottom: '12px',
            }}
          >
            剩余 {previewCount.remaining}/{previewCount.total} 次预览
          </div>

          {/* 次数耗尽提示 */}
          {isFreeExhausted && (
            <>
              <div
                style={{
                  background: 'rgba(229, 57, 53, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#C53030',
                  fontWeight: 500,
                  marginBottom: '12px',
                }}
                role="alert"
              >
                本月预览次数已用尽，升级到专业版获取更多创作额度
              </div>
              {onUpgrade && (
                <button
                  onClick={onUpgrade}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
                    color: 'white',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  }}
                >
                  升级到专业版
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* 加载状态 */}
      {!credits && isPaid && (
        <div style={{ fontSize: '13px', color: '#999' }}>加载中...</div>
      )}
      {!previewCount && !isPaid && (
        <div style={{ fontSize: '13px', color: '#999' }}>加载中...</div>
      )}
    </div>
  );
}
