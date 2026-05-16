'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCartStore } from '@/store/cartStore';

const navLinkStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: '#9ca3af',
  textDecoration: 'none', transition: 'color 0.2s',
};

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const cartCount = useCartStore((s) => s.getCount());

  // Hide navbar on login page and admin routes
  if (pathname === '/login' || pathname.startsWith('/admin')) {
    return null;
  }

  const truncatedEmail = user?.email
    ? user.email.length > 20
      ? user.email.slice(0, 17) + '...'
      : user.email
    : null;

  return (
    <nav style={{
      position: 'sticky', top: 0, height: 70, zIndex: 1000,
      background: 'rgba(13, 13, 20, 0.95)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(117, 54, 213,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 48px',
      boxShadow: '0 2px 20px rgba(117, 54, 213,0.08)',
    }}>
      <Link href="/" style={{
        fontSize: 32, fontWeight: 700, color: '#7536d5',
        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: -0.5,
        textDecoration: 'none',
      }}>
        HookCraft
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link href="/templates" style={navLinkStyle} onMouseEnter={e => e.currentTarget.style.color = '#7536d5'} onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>模板中心</Link>
        <Link href="/upload" style={navLinkStyle} onMouseEnter={e => e.currentTarget.style.color = '#7536d5'} onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>上传模板</Link>
        <Link href="/studio" style={navLinkStyle} onMouseEnter={e => e.currentTarget.style.color = '#7536d5'} onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>AI 创作</Link>
        <Link href="/pricing" style={navLinkStyle} onMouseEnter={e => e.currentTarget.style.color = '#7536d5'} onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>定价</Link>
        <Link href="/account/creations" style={navLinkStyle} onMouseEnter={e => e.currentTarget.style.color = '#7536d5'} onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>我的创作</Link>
        <Link href="/account" style={navLinkStyle} onMouseEnter={e => e.currentTarget.style.color = '#7536d5'} onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>账户</Link>

        {/* Cart icon with badge */}
        <Link href="/cart" style={{ position: 'relative', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🛒</span>
          {cartCount > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -8,
              background: '#7536d5', color: 'white',
              fontSize: 10, fontWeight: 700,
              width: 18, height: 18, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>

        {!loading && (
          user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
                {truncatedEmail}
              </span>
              <button
                onClick={signOut}
                style={{
                  padding: '6px 16px', borderRadius: 20,
                  border: '1px solid rgba(117, 54, 213,0.4)',
                  background: 'transparent', color: '#7536d5',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                }}
              >
                退出
              </button>
            </div>
          ) : (
            <Link href="/login" style={{
              padding: '8px 20px', borderRadius: 20,
              background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
              color: 'white', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.2s',
            }}>
              登录
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
