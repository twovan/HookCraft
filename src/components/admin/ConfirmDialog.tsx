'use client';

import React from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const variantColors: Record<string, string> = {
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const accentColor = variantColors[variant];

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={titleStyle}>{title}</h3>
          <p style={descriptionStyle}>{description}</p>
        </div>
        <div style={footerStyle}>
          <button onClick={onCancel} style={cancelButtonStyle} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              ...confirmButtonStyle,
              background: accentColor,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: '28px 32px',
  maxWidth: 420,
  width: '90%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
  marginBottom: 8,
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#6b7280',
  margin: 0,
  lineHeight: 1.6,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const confirmButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};
