'use client';

import React from 'react';

export interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  loading?: boolean;
  children: React.ReactNode;
}

export default function FormModal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = '提交',
  loading = false,
  children,
}: FormModalProps) {
  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={titleStyle}>{title}</h3>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>
        {/* Content */}
        <div style={contentStyle}>
          {children}
        </div>
        {/* Footer */}
        <div style={footerStyle}>
          <button onClick={onClose} style={cancelButtonStyle} disabled={loading}>
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            style={{
              ...submitButtonStyle,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '处理中...' : submitLabel}
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
  maxWidth: 560,
  width: '90%',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '20px 28px',
  borderBottom: '1px solid #f3f4f6',
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#1f2937',
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  background: '#f3f4f6',
  cursor: 'pointer',
  fontSize: 14,
  color: '#6b7280',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const contentStyle: React.CSSProperties = {
  padding: '24px 28px',
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  padding: '16px 28px',
  borderTop: '1px solid #f3f4f6',
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

const submitButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};
