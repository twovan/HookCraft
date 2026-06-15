'use client';

import Link from 'next/link';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { getAvatarInitial } from '@/lib/account/profile';
import type { PreviewCount } from '@/store/creditStore';
import type { CreditInfoEnhanced } from '@/types/credits';

const TIER_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  business: '商业版',
};

interface UserAvatarMenuProps {
  username: string;
  email?: string | null;
  avatarUrl: string;
  currentTier: string;
  isPaid: boolean;
  credits: CreditInfoEnhanced | null;
  previewCount: PreviewCount | null;
  onSignOut: () => void;
}

export default function UserAvatarMenu({
  username,
  email,
  avatarUrl,
  currentTier,
  isPaid,
  credits,
  previewCount,
  onSignOut,
}: UserAvatarMenuProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const truncatedEmail = email
    ? email.length > 20
      ? `${email.slice(0, 17)}...`
      : email
    : null;
  const displayName = username || truncatedEmail;
  const avatarInitial = getAvatarInitial({ username, email });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <Link
        href="/account"
        aria-label="进入账户"
        onClick={() => setShowDropdown(false)}
        onMouseEnter={() => setShowDropdown(true)}
        style={avatarLinkStyle}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="头像" style={avatarImageStyle} />
        ) : (
          avatarInitial
        )}
      </Link>

      {showDropdown && (
        <div
          onMouseLeave={() => setShowDropdown(false)}
          style={dropdownStyle}
        >
          <div style={userInfoStyle}>
            <div style={displayNameStyle}>
              {displayName}
            </div>
            {username && (
              <div style={emailStyle}>
                {truncatedEmail}
              </div>
            )}
            <div style={{
              ...tierBadgeStyle,
              background: currentTier === 'free' ? 'rgba(168, 170, 163, 0.12)' : 'rgba(206, 255, 53, 0.12)',
              color: currentTier === 'free' ? '#a8aaa3' : '#ceff35',
            }}>
              {TIER_LABELS[currentTier] || '免费版'}
            </div>

            <div style={{ marginTop: 10 }}>
              {isPaid && credits ? (
                <>
                  <div style={creditCaptionStyle}>
                    月度: {credits.monthlyUsed}/{credits.monthlyTotal} 已用 · 剩余 {credits.monthlyRemaining}
                  </div>
                  <div style={{ ...creditBarStyle, marginBottom: 6 }}>
                    <div style={{
                      ...creditBarFillStyle,
                      width: `${credits.monthlyTotal > 0 ? (credits.monthlyUsed / credits.monthlyTotal) * 100 : 0}%`,
                    }} />
                  </div>
                  {credits.purchasedBalance > 0 && (
                    <div style={purchasedBalanceStyle}>
                      购买余额: {credits.purchasedBalance} 点额度
                    </div>
                  )}
                  <div style={totalCreditStyle}>
                    总可用: {credits.totalAvailable} 点额度
                  </div>
                </>
              ) : previewCount ? (
                <>
                  <div style={creditCaptionStyle}>
                    预览次数: {previewCount.remaining}/{previewCount.total} 剩余
                  </div>
                  <div style={creditBarStyle}>
                    <div style={{
                      ...creditBarFillStyle,
                      width: `${(previewCount.remaining / previewCount.total) * 100}%`,
                    }} />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <MenuLink href="/account" onClick={() => setShowDropdown(false)}>
            账户管理
          </MenuLink>
          <MenuLink href="/account/creations" onClick={() => setShowDropdown(false)}>
            我的创作
          </MenuLink>
          <MenuLink href="/pricing" onClick={() => setShowDropdown(false)}>
            升级会员
          </MenuLink>

          <div style={signOutWrapStyle}>
            <button
              onClick={() => {
                setShowDropdown(false);
                onSignOut();
              }}
              style={signOutButtonStyle}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'rgba(229, 62, 62, 0.1)';
                event.currentTarget.style.color = '#E53E3E';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
                event.currentTarget.style.color = '#9ca3af';
              }}
            >
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={menuLinkStyle}
      onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(206, 255, 53, 0.08)'; }}
      onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </Link>
  );
}

const avatarLinkStyle: React.CSSProperties = {
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
  textDecoration: 'none',
};

const avatarImageStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  objectFit: 'cover',
};

const dropdownStyle: React.CSSProperties = {
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
};

const userInfoStyle: React.CSSProperties = {
  marginBottom: 12,
  paddingBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
};

const displayNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#f4f1ea',
  marginBottom: 4,
};

const emailStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  marginBottom: 8,
  overflowWrap: 'anywhere',
};

const tierBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 600,
};

const creditCaptionStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  marginBottom: 4,
};

const creditBarStyle: React.CSSProperties = {
  height: 4,
  borderRadius: 2,
  background: 'rgba(255,255,255,0.1)',
  overflow: 'hidden',
};

const creditBarFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 2,
  background: 'linear-gradient(90deg, #ceff35, #52d6c6)',
  transition: 'width 0.3s',
};

const purchasedBalanceStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#957afd',
  marginBottom: 2,
};

const totalCreditStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#e8e8f0',
  fontWeight: 600,
};

const menuLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  borderRadius: 8,
  color: '#f4f1ea',
  fontSize: 13,
  textDecoration: 'none',
  transition: 'background 0.2s',
};

const signOutWrapStyle: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 8,
  borderTop: '1px solid rgba(255,255,255,0.1)',
};

const signOutButtonStyle: React.CSSProperties = {
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
};
