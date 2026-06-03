'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface NavItem {
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '概览',
    items: [
      { label: '数据看板', icon: '📊', href: '/admin' },
    ],
  },
  {
    title: '内容管理',
    items: [
      { label: '模板管理', icon: '🎵', href: '/admin/templates' },
      { label: '内容审核', icon: '✅', href: '/admin/review' },
      { label: '分类管理', icon: '📁', href: '/admin/categories' },
      { label: '敏感词管理', icon: '🚫', href: '/admin/sensitive-words' },
    ],
  },
  {
    title: '用户管理',
    items: [
      { label: '用户列表', icon: '👥', href: '/admin/users' },
      { label: '制作人', icon: '🎤', href: '/admin/producers' },
      { label: '会员管理', icon: '💎', href: '/admin/membership' },
    ],
  },
  {
    title: '交易管理',
    items: [
      { label: '订单管理', icon: '📋', href: '/admin/orders' },
      { label: '收入结算', icon: '💰', href: '/admin/revenue' },
    ],
  },
  {
    title: 'AI 管理',
    items: [
      { label: 'AI 任务', icon: '🤖', href: '/admin/ai-tasks' },
      { label: 'Style DNA', icon: '🧬', href: '/admin/style-dna' },
      { label: '生成歌曲', icon: '♪', href: '/admin/generated-songs' },
      { label: 'Credits', icon: '⚡', href: '/admin/credits' },
      { label: 'AI 操作定价', icon: '¥', href: '/admin/credits/cost-rules' },
    ],
  },
  {
    title: '系统',
    items: [
      { label: '系统设置', icon: '⚙️', href: '/admin/settings' },
      { label: '编辑器开关', icon: '🎚️', href: '/admin/editor-features' },
      { label: '操作日志', icon: '📝', href: '/admin/logs' },
      { label: '敏感词检测日志', icon: '🛡️', href: '/admin/sensitivity-logs' },
    ],
  },
];

interface AdminInfo {
  displayName: string;
  role: string;
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState<AdminInfo>({ displayName: '管理员', role: '管理员' });
  const [loggingOut, setLoggingOut] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    const fetchAdminInfo = async () => {
      try {
        const res = await fetch('/api/admin/auth/session');
        if (res.ok) {
          const data = await res.json();
          setAdminInfo({
            displayName: data.admin?.displayName || '管理员',
            role: data.admin?.role === 'super_admin' ? '超级管理员' : '管理员',
          });
        }
      } catch {
        // Ignore errors, use default
      }
    };
    fetchAdminInfo();

    // Fetch pending review count
    const fetchReviewCount = async () => {
      try {
        const res = await fetch('/api/admin/review?page=1&pageSize=1');
        if (res.ok) {
          const data = await res.json();
          setReviewCount(data.stats?.pending || 0);
        }
      } catch {
        // Ignore
      }
    };
    fetchReviewCount();
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  const isActive = (href: string) => {
    const pathOnly = href.split('#')[0];
    if (pathOnly === '/admin') return pathname === '/admin';
    if (pathOnly === '/admin/credits') return pathname === '/admin/credits';
    return pathname.startsWith(pathOnly);
  };

  return (
    <aside style={sidebarStyle}>
      {/* Logo */}
      <div style={logoContainerStyle}>
        <div style={logoIconStyle}>H</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>HookCraft</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>管理后台</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} style={{ padding: '0 16px', marginBottom: 8 }}>
            <div style={sectionTitleStyle}>{section.title}</div>
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...navItemStyle,
                    ...(active ? navItemActiveStyle : {}),
                  }}
                >
                  <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span style={badgeStyle}>{item.badge}</span>
                  )}
                  {item.href === '/admin/review' && reviewCount > 0 && (
                    <span style={badgeStyle}>{reviewCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Admin user footer */}
      <div style={footerStyle}>
        <div style={avatarStyle}>{adminInfo.displayName.charAt(0)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {adminInfo.displayName}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{adminInfo.role}</div>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={logoutButtonStyle}
          title="退出登录"
          aria-label="退出登录"
        >
          {loggingOut ? '...' : '↪'}
        </button>
      </div>
    </aside>
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

const badgeStyle: React.CSSProperties = {
  background: '#ef4444',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 10,
  minWidth: 18,
  textAlign: 'center',
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
  flexShrink: 0,
};

const logoutButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: 'rgba(255,255,255,0.5)',
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'all 0.2s',
};
