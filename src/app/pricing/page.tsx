import { TIER_CONFIGS } from '@/config/tierConfig';
import PricingContent from './PricingContent';

export const metadata = {
  title: 'HookCraft - 会员定价',
  description: '选择适合你的 AI 音乐创作方案',
};

export default function PricingPage() {
  // Pass tier configs as serializable data to client component
  const tiers = Object.values(TIER_CONFIGS);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d14',
        position: 'relative',
      }}
    >
      {/* Background texture */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(117, 54, 213, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(117, 54, 213, 0.03) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <header
          style={{
            textAlign: 'center',
            padding: '80px 24px 48px',
          }}
        >
          <h1
            style={{
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              fontSize: '48px',
              fontWeight: 700,
              color: '#e8e8f0',
              marginBottom: '16px',
              letterSpacing: '-0.5px',
            }}
          >
            选择你的创作方案
          </h1>
          <p
            style={{
              fontSize: '18px',
              color: '#9ca3af',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            从免费体验到专业创作，找到最适合你的 AI 音乐生成方案
          </p>
        </header>

        {/* Interactive pricing content (client component) */}
        <PricingContent tiers={tiers} />
      </div>
    </div>
  );
}
