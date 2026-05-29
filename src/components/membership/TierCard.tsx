'use client';

import { useState } from 'react';
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

const TIER_LABELS: Record<MembershipTier, string> = {
  free: '免费版',
  pro: '专业版',
  business: '商业版',
};

const TIER_DESCRIPTIONS: Record<MembershipTier, string> = {
  free: '适合试用模板和快速验证旋律方向。',
  pro: '适合持续产出 Demo、上传参考音频和个人商用。',
  business: '适合工作室、商业授权、分轨导出和高频制作。',
};

function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toFixed(0);
}

function formatMonthlyFromYearly(yearlyPriceInCents: number): string {
  return (yearlyPriceInCents / 100 / 12).toFixed(1);
}

function getLicenseLabel(level: string): string {
  switch (level) {
    case 'personal':
      return '个人非商用授权';
    case 'commercial':
      return '个人商用授权';
    case 'full_commercial':
      return '完整商业授权';
    default:
      return level;
  }
}

function getExportFormatsLabel(config: TierConfig): string {
  return config.exportFormats
    .map((f) => {
      const name = f.format.toUpperCase();
      return f.quality ? `${name}(${f.quality})` : name;
    })
    .join(' / ');
}

function getEditorFeatures(config: TierConfig): string {
  if (config.tier === 'free') return '基础播放';
  if (config.tier === 'pro') return '多轨编辑、混音和效果器';
  return '完整编辑、AI 混音和 AI 母带';
}

export default function TierCard({
  tier,
  config,
  billingCycle,
  isCurrentTier,
  isRecommended,
  onSubscribe,
}: TierCardProps) {
  const [hovered, setHovered] = useState(false);
  const displayPrice = billingCycle === 'monthly'
    ? `¥${formatPrice(config.monthlyPrice)}`
    : `¥${formatMonthlyFromYearly(config.yearlyPrice)}`;
  const yearlyNote = billingCycle === 'yearly' && config.yearlyPrice > 0
    ? `年付 ¥${formatPrice(config.yearlyPrice)}，约 8 折`
    : null;

  const features: { label: string; included: boolean }[] = [
    {
      label: config.tier === 'free'
        ? `${config.monthlyPreviews} 次预览/月`
        : `${config.monthlyCredits} 点额度/月`,
      included: true,
    },
    { label: '试听预览：30 秒', included: true },
    { label: '完整生成：2 分钟', included: config.features.includes('full_demo') },
    { label: '基础歌手声模', included: config.features.includes('base_singer') },
    { label: '高级歌手声模：+5 点额度', included: config.features.includes('premium_singer') },
    { label: `导出格式：${getExportFormatsLabel(config)}`, included: true },
    { label: `编辑器：${getEditorFeatures(config)}`, included: true },
    { label: '优先队列', included: config.hasPriorityQueue },
    { label: getLicenseLabel(config.licenseLevel), included: true },
    { label: '额度充值包折扣', included: config.features.includes('credits_pack_discount') },
  ];

  return (
    <article
      className="tier-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...cardStyle,
        borderColor: hovered || isRecommended ? 'rgba(206, 255, 53, 0.52)' : 'var(--hc-line)',
        transform: hovered
          ? isRecommended ? 'translateY(-14px)' : 'translateY(-6px)'
          : isRecommended ? 'translateY(-10px)' : 'none',
        boxShadow: hovered ? '0 24px 70px rgba(0, 0, 0, 0.36)' : 'var(--hc-shadow)',
      }}
    >
      {isRecommended && <div style={recommendStyle}>最受欢迎</div>}
      {isCurrentTier && <div style={currentStyle}>当前方案</div>}

      <header style={headerStyle}>
        <span style={tierCodeStyle}>{tier}</span>
        <h3 style={titleStyle}>{TIER_LABELS[tier]}</h3>
        <p style={descStyle}>{TIER_DESCRIPTIONS[tier]}</p>
      </header>

      <div style={priceBlockStyle}>
        <span style={priceStyle}>{config.monthlyPrice === 0 ? '免费' : displayPrice}</span>
        {config.monthlyPrice > 0 && <span style={suffixStyle}>/月</span>}
      </div>
      <div style={noteStyle}>{yearlyNote || ' '}</div>

      {config.tier !== 'free' && (
        <div style={creditsStyle}>
          <strong>额度消耗</strong>
          <span>试听预览 30 秒 = 1 点额度</span>
          <span>完整生成短版 = 10 点额度</span>
          <span>完整生成长版 = 20 点额度</span>
          <span>高级声模 = +5 点额度</span>
        </div>
      )}

      <ul style={featureListStyle}>
        {features.map((feature) => (
          <li key={feature.label} style={{ ...featureItemStyle, opacity: feature.included ? 1 : 0.46 }}>
            <span style={featureMarkStyle(feature.included)}>{feature.included ? '含' : '-'}</span>
            <span style={{ textDecoration: feature.included ? 'none' : 'line-through' }}>{feature.label}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSubscribe(tier, billingCycle)}
        disabled={isCurrentTier}
        style={{
          ...buttonStyle,
          background: isCurrentTier
            ? 'rgba(255,255,255,.07)'
            : 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))',
          color: isCurrentTier ? 'var(--hc-muted)' : '#08090c',
          cursor: isCurrentTier ? 'default' : 'pointer',
        }}
        aria-label={isCurrentTier ? `${TIER_LABELS[tier]} - 当前方案` : `立即订阅 ${TIER_LABELS[tier]}`}
      >
        {isCurrentTier ? '当前方案' : config.monthlyPrice === 0 ? '免费使用' : '立即订阅'}
      </button>
    </article>
  );
}

const cardStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: 680,
  display: 'flex',
  flexDirection: 'column',
  padding: '30px 24px 24px',
  border: '1px solid var(--hc-line)',
  borderRadius: 'var(--hc-radius-lg)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))',
  boxShadow: 'var(--hc-shadow-soft)',
  transition: 'transform .24s ease, border-color .24s ease, box-shadow .24s ease',
};

const recommendStyle: React.CSSProperties = {
  position: 'absolute',
  top: -14,
  left: '50%',
  transform: 'translateX(-50%)',
  borderRadius: 999,
  padding: '7px 16px',
  background: 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))',
  color: '#08090c',
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: 'nowrap',
};

const currentStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  borderRadius: 999,
  padding: '5px 10px',
  border: '1px solid rgba(206,255,53,.32)',
  background: 'rgba(206,255,53,.1)',
  color: 'var(--hc-lime)',
  fontSize: 11,
  fontWeight: 900,
};

const headerStyle: React.CSSProperties = {
  marginBottom: 20,
};

const tierCodeStyle: React.CSSProperties = {
  color: 'var(--hc-lime)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
};

const titleStyle: React.CSSProperties = {
  margin: '8px 0',
  color: 'var(--hc-text)',
  fontSize: 25,
  fontWeight: 950,
};

const descStyle: React.CSSProperties = {
  minHeight: 44,
  margin: 0,
  color: 'var(--hc-muted)',
  fontSize: 13,
  lineHeight: 1.65,
};

const priceBlockStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
  marginBottom: 8,
};

const priceStyle: React.CSSProperties = {
  color: 'var(--hc-lime)',
  fontSize: 42,
  fontWeight: 950,
  lineHeight: 1,
};

const suffixStyle: React.CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 15,
};

const noteStyle: React.CSSProperties = {
  minHeight: 20,
  color: 'var(--hc-muted)',
  fontSize: 12,
  marginBottom: 16,
};

const creditsStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  marginBottom: 18,
  border: '1px solid var(--hc-line)',
  borderRadius: 12,
  padding: '12px 14px',
  background: 'rgba(8,9,12,.48)',
  color: 'var(--hc-muted)',
  fontSize: 12,
  lineHeight: 1.55,
};

const featureListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0 0 22px',
  flex: 1,
};

const featureItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 9,
  padding: '7px 0',
  color: 'var(--hc-text)',
  fontSize: 13,
  lineHeight: 1.5,
};

const featureMarkStyle = (included: boolean): React.CSSProperties => ({
  flexShrink: 0,
  minWidth: 24,
  height: 20,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  border: included ? '1px solid rgba(206,255,53,.34)' : '1px solid var(--hc-line)',
  background: included ? 'rgba(206,255,53,.11)' : 'rgba(255,255,255,.04)',
  color: included ? 'var(--hc-lime)' : 'var(--hc-muted)',
  fontSize: 9,
  fontWeight: 950,
});

const buttonStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: 999,
  padding: '14px 18px',
  fontSize: 14,
  fontWeight: 950,
  transition: 'transform .2s ease, opacity .2s ease',
};
