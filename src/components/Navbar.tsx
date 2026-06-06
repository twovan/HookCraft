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
    fontWeight: isActive(href) ? 800 : 650,
    color: isActive(href) ? '#ceff35' : '#a8aaa3',
    textDecoration: 'none',
    transition: 'color 0.2s, background 0.2s',
    position: 'relative',
    borderRadius: 999,
    padding: '8px 10px',
    background: isActive(href) ? 'rgba(206, 255, 53, 0.1)' : 'transparent',
    whiteSpace: 'nowrap',
    flexShrink: 0,
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
    <>
    <style dangerouslySetInnerHTML={{ __html: `
      .hc-nav a,
      .hc-nav button {
        letter-spacing: 0;
      }

      .hc-nav::after {
        content: "";
        position: absolute;
        left: 48px;
        right: 48px;
        bottom: -1px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(206,255,53,.38), rgba(82,214,198,.22), transparent);
        pointer-events: none;
      }

      @media (max-width: 980px) {
        .hc-nav { padding: 0 20px !important; }
        .hc-nav::after { left: 20px; right: 20px; }
        .hc-nav-logo img { width: 118px !important; height: auto !important; }
        .hc-nav-links {
          min-width: 0 !important;
          flex: 1 1 auto !important;
          gap: 6px !important;
          overflow-x: auto;
          scrollbar-width: none;
          justify-content: flex-start !important;
          padding-left: 10px;
        }
        .hc-nav-links::-webkit-scrollbar { display: none; }
        .hc-nav-optional { display: none !important; }
      }

      @media (max-width: 520px) {
        .hc-nav { padding: 0 14px !important; }
        .hc-nav::after { left: 14px; right: 14px; }
        .hc-nav-logo img { width: 112px !important; }
      }
    ` }} />
    <nav style={{
      position: 'sticky', top: 0, height: 70, zIndex: 1000,
      background: 'linear-gradient(180deg, rgba(8, 9, 12, 0.95), rgba(8, 9, 12, 0.88))', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.09)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 48px',
      boxShadow: '0 12px 38px rgba(0,0,0,0.28)',
    }} className="hc-nav">
      <Link href="/" className="hc-nav-logo" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flex: '0 0 auto' }}>
        <Image
          src="/logo-nav.svg"
          alt="HookCraft"
          width={140}
          height={36}
          priority
        />
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }} className="hc-nav-links">
        <Link href="/templates" style={navLinkStyle('/templates')} onMouseEnter={e => { if (!isActive('/templates')) e.currentTarget.style.color = '#ceff35'; }} onMouseLeave={e => { if (!isActive('/templates')) e.currentTarget.style.color = '#a8aaa3'; }}>模板</Link>
        <Link href="/studio" style={navLinkStyle('/studio')} onMouseEnter={e => { if (!isActive('/studio')) e.currentTarget.style.color = '#ceff35'; }} onMouseLeave={e => { if (!isActive('/studio')) e.currentTarget.style.color = '#a8aaa3'; }}>工作台</Link>
        <Link href="/pricing" style={navLinkStyle('/pricing')} onMouseEnter={e => { if (!isActive('/pricing')) e.currentTarget.style.color = '#ceff35'; }} onMouseLeave={e => { if (!isActive('/pricing')) e.currentTarget.style.color = '#a8aaa3'; }}>会员</Link>
        <Link href="/account/creations" className="hc-nav-optional" style={navLinkStyle('/account/creations')} onMouseEnter={e => { if (!isActive('/account/creations')) e.currentTarget.style.color = '#ceff35'; }} onMouseLeave={e => { if (!isActive('/account/creations')) e.currentTarget.style.color = '#a8aaa3'; }}>我的作品</Link>
        <Link href="/account" className="hc-nav-optional" style={navLinkStyle('/account')} onMouseEnter={e => { if (!isActive('/account')) e.currentTarget.style.color = '#ceff35'; }} onMouseLeave={e => { if (!isActive('/account')) e.currentTarget.style.color = '#a8aaa3'; }}>账户</Link>

        {/* Cart icon with badge */}
        <Link href="/cart" style={{ position: 'relative', textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#f4f1ea', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '7px 10px', whiteSpace: 'nowrap' }}>购物车</span>
          {cartCount > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -8,
              background: '#ceff35', color: '#08090c',
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
                  background: 'linear-gradient(135deg, #ceff35, #52d6c6)',
                  border: '1px solid rgba(206, 255, 53, 0.26)',
                  padding: 0,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  color: '#08090c',
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="头像" style={{ display: 'block', width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
                    background: '#181a22',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 14,
                    padding: 16,
                    minWidth: 220,
                    boxShadow: '0 18px 48px rgba(0,0,0,0.42)',
                    zIndex: 1001,
                  }}
                >
                  {/* User info */}
                  <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#f4f1ea', marginBottom: 4 }}>
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
                      background: currentTier === 'free' ? 'rgba(168, 170, 163, 0.12)' : 'rgba(206, 255, 53, 0.12)',
                      color: currentTier === 'free' ? '#a8aaa3' : '#ceff35',
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
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 6 }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              background: 'linear-gradient(90deg, #ceff35, #52d6c6)',
                              width: `${credits.monthlyTotal > 0 ? (credits.monthlyUsed / credits.monthlyTotal) * 100 : 0}%`,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          {credits.purchasedBalance > 0 && (
                            <div style={{ fontSize: 11, color: '#957afd', marginBottom: 2 }}>
                              购买余额: {credits.purchasedBalance} 点额度
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#e8e8f0', fontWeight: 600 }}>
                            总可用: {credits.totalAvailable} 点额度
                          </div>
                        </>
                      ) : previewCount ? (
                        <>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                            预览次数: {previewCount.remaining}/{previewCount.total} 剩余
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                            background: 'linear-gradient(90deg, #ceff35, #52d6c6)',
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
                      color: '#f4f1ea',
                      fontSize: 13,
                      textDecoration: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(206, 255, 53, 0.08)'}
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
                      color: '#f4f1ea',
                      fontSize: 13,
                      textDecoration: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(206, 255, 53, 0.08)'}
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
                      color: '#f4f1ea',
                      fontSize: 13,
                      textDecoration: 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(206, 255, 53, 0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    升级会员
                  </Link>

                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
              background: '#ceff35',
              color: '#08090c', fontSize: 13, fontWeight: 900,
              textDecoration: 'none', transition: 'all 0.2s',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              登录
            </Link>
          )
        )}
      </div>
    </nav>
    </>
  );
}
