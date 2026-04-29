'use client';

import { useMembershipStore } from '@/store/membershipStore';
import { CREDITS_COST } from '@/config/creditsCost';

export interface DurationSelectorProps {
  selected: 30 | 120;
  onSelect: (duration: 30 | 120) => void;
  onUpgradePrompt?: () => void;
  disabled?: boolean;
}

/**
 * 时长选择器组件
 * - 两个按钮：30s 和 2min，显示 Credits 消耗
 * - Free 用户：仅 30s 可用，2min 显示升级提示
 */
export default function DurationSelector({
  selected,
  onSelect,
  onUpgradePrompt,
  disabled = false,
}: DurationSelectorProps) {
  const isPaid = useMembershipStore((s) => s.isPaid());

  const options: Array<{
    duration: 30 | 120;
    label: string;
    credits: number;
    locked: boolean;
  }> = [
    {
      duration: 30,
      label: '30 秒',
      credits: isPaid ? CREDITS_COST.preview : 0,
      locked: false,
    },
    {
      duration: 120,
      label: '2 分钟',
      credits: CREDITS_COST.full_demo_long,
      locked: !isPaid,
    },
  ];

  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 600,
          color: '#2D2D2D',
          marginBottom: '10px',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        生成时长
      </label>
      <div
        style={{
          display: 'flex',
          gap: '12px',
        }}
        role="radiogroup"
        aria-label="生成时长选择"
      >
        {options.map((option) => {
          const isSelected = selected === option.duration;
          const isDisabled = disabled || option.locked;

          return (
            <button
              key={option.duration}
              onClick={() => {
                if (option.locked && onUpgradePrompt) {
                  onUpgradePrompt();
                } else if (!isDisabled) {
                  onSelect(option.duration);
                }
              }}
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isDisabled}
              style={{
                flex: 1,
                position: 'relative',
                padding: '16px 12px',
                borderRadius: '12px',
                border: isSelected
                  ? '2px solid #D4A574'
                  : '1px solid #f0ebe4',
                background: isSelected
                  ? 'linear-gradient(135deg, #FDF8F3 0%, #FDFBF7 100%)'
                  : option.locked
                    ? '#F7F7F7'
                    : 'white',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: option.locked ? 0.7 : 1,
                transition: 'all 0.2s ease',
                fontFamily: "'Inter', sans-serif",
                textAlign: 'center',
              }}
            >
              {/* Duration label */}
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: isSelected ? '#D4A574' : option.locked ? '#999' : '#2D2D2D',
                  marginBottom: '4px',
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                {option.label}
              </div>

              {/* Credits cost */}
              <div
                style={{
                  fontSize: '12px',
                  color: isSelected ? '#D4A574' : '#999',
                  fontWeight: 500,
                }}
              >
                {option.locked ? (
                  <span style={{ color: '#D4A574' }}>需升级 Pro</span>
                ) : isPaid ? (
                  `${option.credits} Credit${option.credits > 1 ? 's' : ''}`
                ) : (
                  '消耗 1 次预览'
                )}
              </div>

              {/* Lock icon for paid-only */}
              {option.locked && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontSize: '14px',
                  }}
                >
                  🔒
                </div>
              )}

              {/* Selected indicator */}
              {isSelected && !option.locked && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#D4A574',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: 'white',
                  }}
                >
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
