'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface NavItem {
  label: string;
  icon: string;
  href: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '概览',
    items: [
      { label: '数据看板', icon: 'DB', href: '/admin' },
    ],
  },
  {
    title: '内容管理',
    items: [
      { label: '模板管理', icon: 'TM', href: '/admin/templates' },
      { label: '内容审核', icon: 'RV', href: '/admin/review' },
      { label: '分类管理', icon: 'CT', href: '/admin/categories' },
      { label: '敏感词管理', icon: 'SW', href: '/admin/sensitive-words' },
    ],
  },
  {
    title: '用户管理',
    items: [
      { label: '用户列表', icon: 'US', href: '/admin/users' },
      { label: '制作人', icon: 'PR', href: '/admin/producers' },
      { label: '会员管理', icon: 'MB', href: '/admin/membership' },
    ],
  },
  {
    title: '交易管理',
    items: [
      { label: '订单管理', icon: 'OD', href: '/admin/orders' },
      { label: '收入结算', icon: 'RV', href: '/admin/revenue' },
    ],
  },
  {
    title: 'AI 管理',
    items: [
      { label: 'AI 任务', icon: 'AI', href: '/admin/ai-tasks' },
      { label: '生成歌曲', icon: 'SG', href: '/admin/generated-songs' },
      { label: 'Credits', icon: 'CR', href: '/admin/credits' },
      { label: 'AI 操作定价', icon: '¥', href: '/admin/credits/cost-rules' },
    ],
  },
  {
    title: '系统',
    items: [
      { label: '系统设置', icon: 'ST', href: '/admin/settings' },
      { label: '编辑器开关', icon: 'ED', href: '/admin/editor-features' },
      { label: '操作日志', icon: 'LG', href: '/admin/logs' },
      { label: '敏感词检测日志', icon: 'SL', href: '/admin/sensitivity-logs' },
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
        // Keep default admin info when the session endpoint is unavailable.
      }
    };

    const fetchReviewCount = async () => {
      try {
        const res = await fetch('/api/admin/review?page=1&pageSize=1');
        if (res.ok) {
          const data = await res.json();
          setReviewCount(data.stats?.pending || 0);
        }
      } catch {
        // Badge count is non-critical.
      }
    };

    fetchAdminInfo();
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
      <div style={logoContainerStyle}>
        <div style={logoIconStyle}>H</div>
        <div style={{ minWidth: 0 }}>
          <div style={logoTextStyle}>HookCraft</div>
          <div style={logoSubStyle}>管理后台</div>
        </div>
      </div>

      <nav style={navStyle}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} style={sectionStyle}>
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
                  <span style={{ ...navIconStyle, ...(active ? navIconActiveStyle : {}) }}>{item.icon}</span>
                  <span style={navLabelStyle}>{item.label}</span>
                  {item.href === '/admin/review' && reviewCount > 0 && (
                    <span style={badgeStyle}>{reviewCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={footerStyle}>
        <div style={avatarStyle}>{adminInfo.displayName.charAt(0)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={adminNameStyle}>{adminInfo.displayName}</div>
          <div style={adminRoleStyle}>{adminInfo.role}</div>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={logoutButtonStyle}
          title="退出登录"
          aria-label="退出登录"
        >
          {loggingOut ? '...' : 'OUT'}
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
  width: 248,
  background: 'linear-gradient(180deg, #0b1420 0%, #0f1f31 58%, #092133 100%)',
  color: '#fff',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderRight: '1px solid rgba(255,255,255,0.08)',
};

const logoContainerStyle: React.CSSProperties = {
  height: 72,
  padding: '0 18px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const logoIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: 'linear-gradient(135deg, #d7a56d, #b8793b)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 800,
  color: '#fff',
};

const logoTextStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  letterSpacing: 0,
};

const logoSubStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.58)',
  marginTop: 2,
};

const navStyle: React.CSSProperties = {
  flex: 1,
  padding: '14px 0',
  overflowY: 'auto',
};

const sectionStyle: React.CSSProperties = {
  padding: '0 10px',
  marginBottom: 8,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: 'rgba(255,255,255,0.38)',
  letterSpacing: 0.6,
  padding: '10px 10px 5px',
};

const navItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 38,
  padding: '0 10px',
  margin: '2px 0',
  borderRadius: 7,
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.68)',
  fontSize: 13,
  fontWeight: 650,
  textDecoration: 'none',
};

const navItemActiveStyle: React.CSSProperties = {
  background: 'rgba(215,165,109,0.18)',
  color: '#f3c17f',
  boxShadow: 'inset 3px 0 0 #d7a56d',
};

const navIconStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 900,
  color: 'rgba(255,255,255,0.55)',
  flexShrink: 0,
};

const navIconActiveStyle: React.CSSProperties = {
  color: '#f3c17f',
  borderColor: 'rgba(243,193,127,0.45)',
  background: 'rgba(243,193,127,0.1)',
};

const navLabelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const badgeStyle: React.CSSProperties = {
  background: '#ef4444',
  color: '#fff',
  fontSize: 10,
  fontWeight: 800,
  padding: '2px 6px',
  borderRadius: 999,
  minWidth: 18,
  textAlign: 'center',
};

const footerStyle: React.CSSProperties = {
  padding: 16,
  borderTop: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const avatarStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #d7a56d, #b8793b)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 800,
  flexShrink: 0,
};

const adminNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const adminRoleStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.52)',
  marginTop: 2,
};

const logoutButtonStyle: React.CSSProperties = {
  height: 28,
  minWidth: 40,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.62)',
  fontSize: 10,
  fontWeight: 800,
  cursor: 'pointer',
  flexShrink: 0,
};
