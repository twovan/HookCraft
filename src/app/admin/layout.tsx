'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const NAV_SECTIONS = [
  {
    title: '概览',
    items: [
      { label: '数据看板', icon: '📊', href: '/admin' },
    ],
  },
  {
    title: 'AI 管理',
    items: [
      { label: 'Credits 配额', icon: '⚡', href: '/admin/credits' },
      { label: '消耗规则', icon: '📐', href: '/admin/credits/cost-rules' },
      { label: '会员价格', icon: '💰', href: '/admin/credits/pricing' },
      { label: 'Credits Pack', icon: '📦', href: '/admin/credits/credits-pack' },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        <div style={logoContainerStyle}>
          <div style={logoIconStyle}>H</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>HookCraft</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>管理后台</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} style={{ padding: '0 16px', marginBottom: 8 }}>
              <div style={sectionTitleStyle}>{section.title}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      ...navItemStyle,
                      ...(isActive ? navItemActiveStyle : {}),
                    }}
                  >
                    <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={footerStyle}>
          <div style={avatarStyle}>管</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>管理员</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>超级管理员</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 240, background: '#f0f2f5', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  bottom: 0,
  width: 240,
  background: '#1a1a2e',
  color: '#fff',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const logoContainerStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const logoIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: 'linear-gradient(135deg, #D4A574, #c4956a)',
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 700,
  color: '#fff',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.35)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  padding: '8px 8px 4px',
};

const navItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  margin: '2px 8px',
  borderRadius: 8,
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.65)',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
};

const navItemActiveStyle: React.CSSProperties = {
  background: 'rgba(212,165,116,0.2)',
  color: '#D4A574',
};

const footerStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const avatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #D4A574, #c4956a)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 600,
};
