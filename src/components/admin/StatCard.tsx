'use client';

import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: { value: string; direction: 'up' | 'down' };
  icon: string;
  iconColor: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal';
}

const iconColorMap: Record<StatCardProps['iconColor'], string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  red: '#ef4444',
  teal: '#14b8a6',
};

const iconBgMap: Record<StatCardProps['iconColor'], string> = {
  blue: 'rgba(59,130,246,0.1)',
  green: 'rgba(34,197,94,0.1)',
  orange: 'rgba(245,158,11,0.1)',
  purple: 'rgba(139,92,246,0.1)',
  red: 'rgba(239,68,68,0.1)',
  teal: 'rgba(20,184,166,0.1)',
};

export default function StatCard({ label, value, change, icon, iconColor }: StatCardProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={labelStyle}>{label}</div>
          <div style={valueStyle}>{value}</div>
          {change && (
            <div style={{
              ...changeStyle,
              color: change.direction === 'up' ? '#22c55e' : '#ef4444',
            }}>
              {change.direction === 'up' ? '↑' : '↓'} {change.value}
            </div>
          )}
        </div>
        <div style={{
          ...iconCircleStyle,
          background: iconBgMap[iconColor],
          color: iconColorMap[iconColor],
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7280',
  fontWeight: 500,
  marginBottom: 8,
};

const valueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#1f2937',
  lineHeight: 1.2,
};

const changeStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  marginTop: 6,
};

const iconCircleStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
};
