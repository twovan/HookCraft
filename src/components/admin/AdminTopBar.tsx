'use client';

import React from 'react';

export interface AdminTopBarProps {
  title: string;
  breadcrumb: string;
}

export default function AdminTopBar({ title, breadcrumb }: AdminTopBarProps) {
  return (
    <div style={topBarStyle}>
      <div style={{ minWidth: 0 }}>
        <h1 style={titleStyle}>{title}</h1>
        <div style={breadcrumbStyle}>{breadcrumb}</div>
      </div>
      <div style={rightStyle}>
        <div style={searchContainerStyle}>
          <span style={searchIconStyle}>SR</span>
          <input
            type="text"
            placeholder="搜索用户、订单、模板、歌曲..."
            style={searchInputStyle}
          />
        </div>
        <button style={iconButtonStyle} aria-label="通知">
          NT
          <span style={redDotStyle} />
        </button>
        <button style={iconButtonStyle} aria-label="消息">
          MS
        </button>
      </div>
    </div>
  );
}

const topBarStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  height: 64,
  background: '#101827',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  zIndex: 50,
  color: '#fff',
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#fff',
  margin: 0,
  lineHeight: 1.2,
};

const breadcrumbStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.48)',
  marginTop: 4,
};

const rightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const searchContainerStyle: React.CSSProperties = {
  height: 36,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 12px',
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.07)',
};

const searchIconStyle: React.CSSProperties = {
  color: '#f3c17f',
  fontSize: 10,
  fontWeight: 900,
};

const searchInputStyle: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 13,
  width: 260,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  color: '#fff',
};

const iconButtonStyle: React.CSSProperties = {
  position: 'relative',
  width: 36,
  height: 36,
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.72)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 900,
};

const redDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: 7,
  right: 7,
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#ef4444',
  border: '2px solid #101827',
};
