'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import { useCartStore } from '@/store/cartStore';
import { getAvatarInitial } from '@/lib/account/profile';

const TIER_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  business: '商业版',
};

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const cartCount = useCartStore((s) => s.getCount());
  const membership = useMembershipStore((s) => s.membership);
  const currentTier = useMembershipStore((s) => s.currentTier());
  const isPaid = useMembershipStore((s) => s.isPaid());
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const credits = useCreditStore((s) => s.credits);
  const previewCount = useCreditStore((s) => s.previewCount);
  const fetchCredits = useCreditStore((s) => s.fetchCredits);
  const fetchPreviewCount = useCreditStore((s) => s.fetchPreviewCount);

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch membership and credits when user is logged in
  useEffect(() => {
    if (user) {
      fetchMembership();
      if (isPaid) { fetchCredits(); } else { fetchPreviewCount(); }
    }
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hide navbar on login page and admin routes
  if (pathname === '/login' || pathname.startsWith('/admin') || pathname.startsWith('/studio/stem-editor')) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const navLinkStyle = (href: string): React.CSSProperties => ({
    fontSize: 14,
    fontWeight: isActive(href) ? 600 : 500,
    color: isActive(href) ? '#7536d5' : '#9ca3af',
    textDecoration: 'none',
    transition: 'color 0.2s',
    position: 'relative',
  });

  const truncatedEmail = user?.email
    ? user.email.length > 20
      ? user.email.slice(0, 17) + '...'
      : user.email
    : null;

  const username = typeof user?.user_metadata?.username === 'string'
    ? user.user_metadata.username
    : typeof user?.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : '';
  const displayName = username || truncatedEmail;
  const avatarUrl = typeof user?.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : '';
  const avatarInitial = getAvatarInitial({ username, email: user?.email });

  return (
    <nav style={{
      position: 'sticky', top: 0, height: 70, zIndex: 1000,
      background: 'rgba(13, 13, 20, 0.95)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(117, 54, 213,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 48px',
      boxShadow: '0 2px 20px rgba(117, 54, 213,0.08)',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <Image
          src="/logo-nav.svg"
          alt="HookCraft"
          width={140}
          height={36}
          priority
        />
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link href="/templates" style={navLinkStyle('/templates')} onMouseEnter={e => { if (!isActive('/templates')) e.currentTarget.style.color = '#7536d5'; }} onMouseLeave={e => { if (!isActive('/templates')) e.currentTarget.style.color = '#9ca3af'; }}>模板中心</Link>
        <Link href="/studio" style={navLinkStyle('/studio')} onMouseEnter={e => { if (!isActive('/studio')) e.currentTarget.style.color = '#7536d5'; }} onMouseLeave={e => { if (!isActive('/studio')) e.currentTarget.style.color = '#9ca3af'; }}>AI 创作</Link>
        <Link href="/pricing" style={navLinkStyle('/pricing')} onMouseEnter={e => { if (!isActive('/pricing')) e.currentTarget.style.color = '#7536d5'; }} onMouseLeave={e => { if (!isActive('/pricing')) e.currentTarget.style.color = '#9ca3af'; }}>定价</Link>
        <Link href="/account/creations" style={navLinkStyle('/account/creations')} onMouseEnter={e => { if (!isActive('/account/creations')) e.currentTarget.style.color = '#7536d5'; }} onMouseLeave={e => { if (!isActive('/account/creations')) e.currentTarget.style.color = '#9ca3af'; }}>我的创作</Link>
        <Link href="/account" style={navLinkStyle('/account')} onMouseEnter={e => { if (!isActive('/account')) e.currentTarget.style.color = '#7536d5'; }} onMouseLeave={e => { if (!isActive('/account')) e.currentTarget.style.color = '#9ca3af'; }}>账户</Link>

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
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              {/* Avatar button */}
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                onMouseEnter={() => setShowDropdown(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
                  border: '2px solid rgba(117, 54, 213, 0.4)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="头像" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  avatarInitial
                )}
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <div
                  onMouseLeave={() => setShowDropdown(false)}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    background: '#1a1a2e',
                    border: '1px solid #2a2a40',
                    borderRadius: 16,
                    padding: 16,
                    minWidth: 220,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    zIndex: 1001,
                  }}
                >
                  {/* User info */}
                  <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #2a2a40' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 4 }}>
                      {displayName}
                    </div>
                    {username && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, overflowWrap: 'anywhere' }}>
                        {truncatedEmail}
                      </div>
                    )}
                    <div style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 10,
                      background: currentTier === 'free' ? 'rgba(156, 163, 175, 0.15)' : 'rgba(117, 54, 213, 0.15)',
                      color: currentTier === 'free' ? '#9ca3af' : '#7536d5',
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {TIER_LABELS[currentTier] || '免费版'}
                    </div>

                    {/* Credits progress */}
                    <div style={{ marginTop: 10 }}>
                      {isPaid && credits ? (
                        <>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                            月度: {credits.monthlyUsed}/{credits.monthlyTotal} 已用 · 剩余 {credits.monthlyRemaining}
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: '#2a2a40', overflow: 'hidden', marginBottom: 6 }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              background: 'linear-gradient(90deg, #7536d5, #957afd)',
                              width: `${credits.monthlyTotal > 0 ? (credits.monthlyUsed / credits.monthlyTotal) * 100 : 0}%`,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          {credits.purchasedBalance > 0 && (
                            <div style={{ fontSize: 11, color: '#957afd', marginBottom: 2 }}>
                              购买余额: {credits.purchasedBalance} Credits
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#e8e8f0', fontWeight: 600 }}>
                            总可用: {credits.totalAvailable} Credits
                          </div>
                        </>
                      ) : previewCount ? (
                        <>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                            预览次数: {previewCount.remaining}/{previewCount.total} 剩余
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: '#2a2a40', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              background: 'linear-gradient(90deg, #7536d5, #957afd)',
                              width: `${(previewCount.remaining / previewCount.total) * 100}%`,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Menu items */}
                  <Link
                    href="/account"
                    onClick={() => setShowDropdown(false)}
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      borderRadius: 8,
                      color: '#e8e8f0',
                      fontSize: 13,
                      textDecoration: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(117, 54, 213, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    账户管理
                  </Link>
                  <Link
                    href="/account/creations"
                    onClick={() => setShowDropdown(false)}
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      borderRadius: 8,
                      color: '#e8e8f0',
                      fontSize: 13,
                      textDecoration: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(117, 54, 213, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    我的创作
                  </Link>
                  <Link
                    href="/pricing"
                    onClick={() => setShowDropdown(false)}
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      borderRadius: 8,
                      color: '#e8e8f0',
                      fontSize: 13,
                      textDecoration: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(117, 54, 213, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    升级会员
                  </Link>

                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a2a40' }}>
                    <button
                      onClick={() => { setShowDropdown(false); signOut(); }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        color: '#9ca3af',
                        fontSize: 13,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229, 62, 62, 0.1)'; e.currentTarget.style.color = '#E53E3E'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                    >
                      退出登录
                    </button>
                  </div>
                </div>
              )}
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
