'use client';

import { useMembershipStore } from '@/store/membershipStore';
import { CREDITS_COST } from '@/config/creditsCost';

export interface DurationSelectorProps {
  selected: 30 | 120;
  onSelect: (duration: 30 | 120) => void;
  onUpgradePrompt?: () => void;
  disabled?: boolean;
}

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
    detail: string;
    credits: number;
    locked: boolean;
  }> = [
    {
      duration: 30,
      label: '30 秒',
      detail: isPaid ? '快速预览' : '消耗 1 次预览',
      credits: isPaid ? CREDITS_COST.preview : 0,
      locked: false,
    },
    {
      duration: 120,
      label: '2 分钟',
      detail: '完整 Demo',
      credits: CREDITS_COST.full_demo_long,
      locked: !isPaid,
    },
  ];

  return (
    <div>
      <label style={labelStyle}>生成时长</label>
      <div style={groupStyle} role="radiogroup" aria-label="生成时长选择">
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
                ...optionStyle,
                borderColor: isSelected ? 'rgba(206,255,53,.58)' : 'var(--hc-line)',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(206,255,53,.12), rgba(82,214,198,.06))'
                  : option.locked
                    ? 'rgba(255,255,255,.025)'
                    : 'rgba(24,26,34,.86)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: option.locked ? 0.68 : 1,
              }}
            >
              <span style={{ ...durationStyle, color: isSelected ? 'var(--hc-lime)' : 'var(--hc-text)' }}>
                {option.label}
              </span>
              <span style={detailStyle}>
                {option.locked ? '升级 Pro 解锁' : isPaid ? `${option.credits} 点额度` : option.detail}
              </span>
              <span style={{ ...statusStyle, color: isSelected ? 'var(--hc-lime)' : 'var(--hc-muted)' }}>
                {option.locked ? '锁定' : isSelected ? '已选' : '可选'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 10,
  color: 'var(--hc-text)',
  fontSize: 14,
  fontWeight: 900,
};

const groupStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const optionStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: 86,
  border: '1px solid var(--hc-line)',
  borderRadius: 12,
  padding: '14px 13px',
  textAlign: 'left',
  transition: 'border-color .2s ease, background .2s ease, opacity .2s ease',
};

const durationStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 20,
  fontWeight: 950,
  lineHeight: 1,
};

const detailStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 8,
  color: 'var(--hc-muted)',
  fontSize: 12,
  fontWeight: 800,
};

const statusStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '.08em',
};
