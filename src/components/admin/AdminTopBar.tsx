'use client';

import React from 'react';

export interface AdminTopBarProps {
  title: string;
  breadcrumb: string;
}

export default function AdminTopBar({ title, breadcrumb }: AdminTopBarProps) {
  return (
    <div style={topBarStyle}>
      <div>
        <h1 style={titleStyle}>{title}</h1>
        <div style={breadcrumbStyle}>{breadcrumb}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Search input */}
        <div style={searchContainerStyle}>
          <span style={{ color: '#9ca3af', fontSize: 14 }}>🔍</span>
          <input
            type="text"
            placeholder="搜索模板、用户、订单..."
            style={searchInputStyle}
          />
        </div>
        {/* Notification button */}
        <button style={iconButtonStyle}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <span style={redDotStyle} />
        </button>
        {/* Message button */}
        <button style={iconButtonStyle}>
          <span style={{ fontSize: 18 }}>💬</span>
        </button>
      </div>
    </div>
  );
}

const topBarStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  height: 60,
  background: '#fff',
  borderBottom: '1px solid #f3f4f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 32px',
  zIndex: 50,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
  lineHeight: 1.2,
};

const breadcrumbStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af',
  marginTop: 2,
};

const searchContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
};

const searchInputStyle: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 13,
  width: 180,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  color: '#374151',
};

const iconButtonStyle: React.CSSProperties = {
  position: 'relative',
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const redDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#ef4444',
  border: '2px solid #fff',
};
