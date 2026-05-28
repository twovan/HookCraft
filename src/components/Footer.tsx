'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const footerLinkStyle: React.CSSProperties = {
  color: '#a8aaa3',
  textDecoration: 'none',
  fontSize: 14,
  cursor: 'pointer',
  transition: 'color 0.2s',
};

export default function Footer() {
  const pathname = usePathname();

  // Hide footer on login page and admin routes
  if (pathname === '/login' || pathname.startsWith('/admin') || pathname.startsWith('/studio/stem-editor')) {
    return null;
  }

  return (
    <footer style={{
      background: '#0b0c10', color: '#f4f1ea', padding: '56px 48px 30px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "var(--hc-font)", color: '#ceff35', marginBottom: 16 }}>HookCraft</div>
            <p style={{ color: '#a8aaa3', fontSize: 14, lineHeight: 1.8, maxWidth: 320 }}>
              用正版模板与 AI 工作流，让华语创作者快速完成可听 Demo。
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 900, marginBottom: 16, color: '#f4f1ea', textTransform: 'uppercase', letterSpacing: 0 }}>平台</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/templates" style={footerLinkStyle}>浏览模板</Link>
              <Link href="/studio" style={footerLinkStyle}>AI 创作</Link>
              <Link href="/pricing" style={footerLinkStyle}>会员方案</Link>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 900, marginBottom: 16, color: '#f4f1ea', textTransform: 'uppercase', letterSpacing: 0 }}>支持</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>帮助中心</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>联系我们</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>常见问题</a>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 900, marginBottom: 16, color: '#f4f1ea', textTransform: 'uppercase', letterSpacing: 0 }}>法律</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>服务条款</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>隐私政策</a>
              <a href="#" style={footerLinkStyle} onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>版权声明</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ color: '#70746c', fontSize: 13 }}>© 2026 HookCraft. 保留所有权利。</div>
          <div style={{ color: '#70746c', fontSize: 13 }}>为音乐创作者打造</div>
        </div>
      </div>
    </footer>
  );
}
