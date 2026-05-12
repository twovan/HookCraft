'use client';

import React from 'react';

export interface TagProps {
  label: string;
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple' | 'gray';
}

const colorMap: Record<TagProps['color'], { bg: string; text: string }> = {
  green: { bg: 'rgba(34,197,94,0.1)', text: '#16a34a' },
  blue: { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  orange: { bg: 'rgba(245,158,11,0.1)', text: '#d97706' },
  red: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626' },
  purple: { bg: 'rgba(139,92,246,0.1)', text: '#7c3aed' },
  gray: { bg: 'rgba(107,114,128,0.1)', text: '#6b7280' },
};

export default function Tag({ label, color }: TagProps) {
  const colors = colorMap[color];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      background: colors.bg,
      color: colors.text,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
