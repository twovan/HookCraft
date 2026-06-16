'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const footerLinkStyle: React.CSSProperties = {
  color: 'var(--hc-text-muted)',
  textDecoration: 'none',
  fontSize: 14,
  cursor: 'pointer',
  transition: 'color 0.2s',
};

export default function Footer() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname.startsWith('/admin') || pathname.startsWith('/studio/stem-editor')) {
    return null;
  }

  return (
    <footer
      style={{
        background: 'linear-gradient(180deg, rgba(13, 15, 20, 0.98), #08090c)',
        color: 'var(--hc-text)',
        padding: '60px 48px 32px',
        borderTop: '1px solid var(--hc-border)',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                color: 'var(--hc-lime)',
                marginBottom: 16,
              }}
            >
              HookCraft
            </div>
            <p style={{ color: 'var(--hc-text-muted)', fontSize: 14, lineHeight: 1.8, maxWidth: 320 }}>
              用正版模板与 AI 工作流，让华语创作者快速完成可听 Demo。
            </p>
          </div>

          <div>
            <h4 style={footerTitleStyle}>平台</h4>
            <div style={footerColumnStyle}>
              <Link href="/templates" style={footerLinkStyle}>浏览模板</Link>
              <Link href="/studio" style={footerLinkStyle}>AI 创作</Link>
              <Link href="/pricing" style={footerLinkStyle}>会员方案</Link>
            </div>
          </div>

          <div>
            <h4 style={footerTitleStyle}>支持</h4>
            <div style={footerColumnStyle}>
              <Link href="/help" style={footerLinkStyle}>帮助中心</Link>
              <Link href="/contact" style={footerLinkStyle}>联系我们</Link>
              <Link href="/faq" style={footerLinkStyle}>常见问题</Link>
            </div>
          </div>

          <div>
            <h4 style={footerTitleStyle}>法律</h4>
            <div style={footerColumnStyle}>
              <Link href="/terms" style={footerLinkStyle}>服务条款</Link>
              <Link href="/privacy" style={footerLinkStyle}>隐私政策</Link>
              <Link href="/copyright" style={footerLinkStyle}>版权声明</Link>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--hc-border)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--hc-text-weak)', fontSize: 13 }}>© 2026 HookCraft. All rights reserved.</div>
          <div style={{ color: 'var(--hc-text-weak)', fontSize: 13 }}>Made for music creators</div>
        </div>
      </div>
    </footer>
  );
}

const footerTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 16,
  color: 'var(--hc-text)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const footerColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};
