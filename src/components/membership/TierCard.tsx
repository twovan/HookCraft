'use client';

import type { MembershipTier, BillingCycle } from '@/types/membership';
import type { TierConfig } from '@/config/tierConfig';

export interface TierCardProps {
  tier: MembershipTier;
  config: TierConfig;
  billingCycle: BillingCycle;
  isCurrentTier: boolean;
  isRecommended: boolean;
  onSubscribe: (tier: MembershipTier, cycle: BillingCycle) => void;
}

/** 格式化价格（分 → 元） */
function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toFixed(0);
}

/** 格式化年付月均价格 */
function formatMonthlyFromYearly(yearlyPriceInCents: number): string {
  return (yearlyPriceInCents / 100 / 12).toFixed(1);
}

/** 获取授权类型中文描述 */
function getLicenseLabel(level: string): string {
  switch (level) {
    case 'personal':
      return '仅限个人非商业使用';
    case 'commercial':
      return '个人商用授权';
    case 'full_commercial':
      return '完整商业授权';
    default:
      return level;
  }
}

/** 获取导出格式展示文本 */
function getExportFormatsLabel(config: TierConfig): string {
  return config.exportFormats
    .map((f) => {
      const name = f.format.toUpperCase();
      return f.quality ? `${name}(${f.quality})` : name;
    })
    .join('、');
}

/** 获取编辑器功能描述 */
function getEditorFeatures(config: TierConfig): string {
  if (config.tier === 'free') return '基础播放';
  if (config.tier === 'pro') return '多轨编辑 + 混音 + 效果器';
  return '全部编辑 + AI 混音 + AI 母带';
}

export default function TierCard({
  tier,
  config,
  billingCycle,
  isCurrentTier,
  isRecommended,
  onSubscribe,
}: TierCardProps) {
  const price =
    billingCycle === 'monthly' ? config.monthlyPrice : config.yearlyPrice;
  const displayPrice =
    billingCycle === 'monthly'
      ? `¥${formatPrice(config.monthlyPrice)}`
      : `¥${formatMonthlyFromYearly(config.yearlyPrice)}`;
  const priceSuffix = config.monthlyPrice === 0 ? '' : '/月';
  const yearlyNote =
    billingCycle === 'yearly' && config.yearlyPrice > 0
      ? `年付 ¥${formatPrice(config.yearlyPrice)}（8 折）`
      : null;

  // Feature list items
  const features: { label: string; included: boolean }[] = [
    {
      label:
        config.tier === 'free'
          ? '3 次 Preview/月'
          : `${config.monthlyCredits} Credits/月`,
      included: true,
    },
    {
      label: 'Preview 预览（30s）',
      included: true,
    },
    {
      label: 'Full Demo 完整生成（2min）',
      included: config.features.includes('full_demo'),
    },
    {
      label: '基础歌手声模',
      included: config.features.includes('base_singer'),
    },
    {
      label: '高级歌手声模（+5 Credits）',
      included: config.features.includes('premium_singer'),
    },
    {
      label: `导出格式：${getExportFormatsLabel(config)}`,
      included: true,
    },
    {
      label: `编辑器：${getEditorFeatures(config)}`,
      included: true,
    },
    {
      label: '优先队列',
      included: config.hasPriorityQueue,
    },
    {
      label: getLicenseLabel(config.licenseLevel),
      included: true,
    },
    {
      label: 'Credits 充值包折扣',
      included: config.features.includes('credits_pack_discount'),
    },
  ];

  return (
    <div
      style={{
        position: 'relative',
        background: '#1a1a2e',
        borderRadius: '20px',
        padding: isRecommended ? '40px 32px' : '36px 28px',
        boxShadow: isRecommended
          ? '0 12px 40px rgba(117, 54, 213, 0.2)'
          : '0 4px 20px rgba(0, 0, 0, 0.06)',
        border: isRecommended
          ? '2px solid #7536d5'
          : '1px solid #2a2a40',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: isRecommended ? 'scale(1.03)' : 'scale(1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
      className="tier-card"
    >
      {/* 推荐标签 */}
      {isRecommended && (
        <div
          style={{
            position: 'absolute',
            top: '-14px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
            color: 'white',
            padding: '6px 20px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          最受欢迎
        </div>
      )}

      {/* 当前方案标签 */}
      {isCurrentTier && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: '#2a2a40',
            color: '#7536d5',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          当前方案
        </div>
      )}

      {/* 等级名称 */}
      <h3
        style={{
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          fontSize: '24px',
          fontWeight: 700,
          color: '#e8e8f0',
          marginBottom: '8px',
          marginTop: isRecommended ? '8px' : '0',
        }}
      >
        {config.name}
      </h3>

      {/* 价格 */}
      <div style={{ marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '42px',
            fontWeight: 700,
            color: '#7536d5',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            lineHeight: 1.1,
          }}
        >
          {config.monthlyPrice === 0 ? '免费' : displayPrice}
        </span>
        {config.monthlyPrice > 0 && (
          <span
            style={{
              fontSize: '16px',
              color: '#9ca3af',
              marginLeft: '4px',
            }}
          >
            {priceSuffix}
          </span>
        )}
      </div>

      {/* 年付提示 */}
      {yearlyNote && (
        <div
          style={{
            fontSize: '13px',
            color: '#999',
            marginBottom: '16px',
          }}
        >
          {yearlyNote}
        </div>
      )}
      {!yearlyNote && <div style={{ marginBottom: '16px' }} />}

      {/* Credits 消耗明细 */}
      {config.tier !== 'free' && (
        <div
          style={{
            background: '#0d0d14',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#9ca3af',
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 600, color: '#e8e8f0', marginBottom: '4px' }}>
            Credits 消耗
          </div>
          <div>Preview（30s）= 1 Credit</div>
          <div>Full Demo 短版 = 10 Credits</div>
          <div>Full Demo 长版 = 20 Credits</div>
          <div>高级声模 = +5 Credits</div>
        </div>
      )}

      {/* 功能列表 */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 24px 0',
          flex: 1,
        }}
      >
        {features.map((feature, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '8px 0',
              fontSize: '14px',
              color: feature.included ? '#e8e8f0' : '#ccc',
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                background: feature.included ? '#2a2a40' : '#1a1a2e',
                color: feature.included ? '#7536d5' : '#ccc',
                marginTop: '1px',
              }}
            >
              {feature.included ? '✓' : '—'}
            </span>
            <span style={{ textDecoration: feature.included ? 'none' : 'line-through' }}>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      {/* 订阅按钮 */}
      <button
        onClick={() => onSubscribe(tier, billingCycle)}
        disabled={isCurrentTier}
        style={{
          width: '100%',
          padding: '14px 24px',
          border: 'none',
          borderRadius: '24px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: isCurrentTier ? 'default' : 'pointer',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          letterSpacing: '0.3px',
          background: isCurrentTier
            ? '#2a2a40'
            : 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
          color: isCurrentTier ? '#6b7280' : 'white',
          boxShadow: isCurrentTier
            ? 'none'
            : '0 4px 12px rgba(117, 54, 213, 0.3)',
        }}
        aria-label={
          isCurrentTier
            ? `${config.name} - 当前方案`
            : `立即订阅 ${config.name}`
        }
      >
        {isCurrentTier
          ? '当前方案'
          : config.monthlyPrice === 0
            ? '免费使用'
            : '立即订阅'}
      </button>
    </div>
  );
}
