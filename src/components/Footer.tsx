'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const footerLinkStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  textDecoration: 'none',
  fontSize: 14,
  cursor: 'pointer',
  transition: 'color 0.2s',
};

export default function Footer() {
  const pathname = usePathname();

  // Hide footer on login page and admin routes
  if (pathname === '/login' || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer style={{
      background: '#1a1a2e', color: 'white', padding: '60px 48px 32px',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", color: '#7536d5', marginBottom: 16 }}>HookCraft</div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.8, maxWidth: 320 }}>
              用正版模板与 AI 工作流，让华语创作者快速完成可听 Demo。
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>平台</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/templates" style={footerLinkStyle}>浏览模板</Link>
              <Link href="/studio" style={footerLinkStyle}>AI 创作</Link>
              <Link href="/pricing" style={footerLinkStyle}>会员方案</Link>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>支持</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>帮助中心</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>联系我们</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>常见问题</a>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>法律</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>服务条款</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>隐私政策</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>版权声明</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>© 2026 HookCraft. All rights reserved.</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Made with ♪ for music creators</div>
        </div>
      </div>
    </footer>
  );
}
