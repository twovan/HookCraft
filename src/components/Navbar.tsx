'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import { useCartStore } from '@/store/cartStore';
import UserAvatarMenu from '@/components/nav/UserAvatarMenu';

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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch membership and credits when user is logged in
  useEffect(() => {
    if (user) {
      fetchMembership();
      if (isPaid) { fetchCredits(); } else { fetchPreviewCount(); }
    }
  }, [user]);

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

  const username = typeof user?.user_metadata?.username === 'string'
    ? user.user_metadata.username
    : typeof user?.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : '';
  const avatarUrl = typeof user?.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : '';

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

        {mounted && !loading && (
          user ? (
            <UserAvatarMenu
              username={username}
              email={user.email}
              avatarUrl={avatarUrl}
              currentTier={currentTier}
              isPaid={isPaid}
              credits={credits}
              previewCount={previewCount}
              onSignOut={signOut}
            />
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
