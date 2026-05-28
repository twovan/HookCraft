'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

export interface SensitivityConfirmDialogProps {
  open: boolean;
  styleTags: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SensitivityConfirmDialog({
  open,
  styleTags,
  onConfirm,
  onCancel,
}: SensitivityConfirmDialogProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return undefined;
    }

    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const tags = styleTags.length > 0 ? styleTags.join(' / ') : '相近风格';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sensitivity-confirm-title" style={rootStyle(visible)}>
      <button type="button" aria-label="关闭弹窗" onClick={onCancel} style={backdropStyle} />
      <div style={dialogStyle(visible)}>
        <div style={iconWrapStyle}>
          <SparkIcon />
        </div>

        <div style={copyStyle}>
          <h2 id="sensitivity-confirm-title" style={titleStyle}>使用风格改写继续生成？</h2>
          <p style={messageStyle}>
            为了避免直接模仿或引用具体作品，系统会把输入改写为
            <span style={highlightStyle}> {tags} </span>
            等风格标签，再继续生成歌曲。
          </p>
        </div>

        <div style={buttonRowStyle}>
          <button type="button" onClick={onCancel} style={secondaryButtonStyle}>
            返回编辑
          </button>
          <button type="button" onClick={onConfirm} style={primaryButtonStyle}>
            继续生成
          </button>
        </div>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 13.7 8.2 19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m18 15 .7 2.2L21 18l-2.3.8L18 21l-.7-2.2L15 18l2.3-.8L18 15Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function rootStyle(visible: boolean): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.22s ease',
  };
}

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  border: 'none',
  background: 'rgba(3, 5, 7, 0.76)',
  backdropFilter: 'blur(10px)',
  cursor: 'pointer',
};

function dialogStyle(visible: boolean): CSSProperties {
  return {
    position: 'relative',
    width: 'min(92vw, 470px)',
    borderRadius: 20,
    border: '1px solid rgba(208,255,90,0.24)',
    background: 'linear-gradient(180deg, rgba(31,35,36,0.98), rgba(12,15,17,0.98))',
    boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
    padding: 26,
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
    transition: 'transform 0.22s ease',
  };
}

const iconWrapStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 56,
  height: 56,
  borderRadius: 18,
  color: 'var(--hc-lime)',
  background: 'rgba(208,255,90,0.1)',
  border: '1px solid rgba(208,255,90,0.24)',
  margin: '0 auto 18px',
};

const copyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  textAlign: 'center',
};

const titleStyle: CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 20,
  lineHeight: 1.25,
  fontWeight: 900,
  margin: 0,
};

const messageStyle: CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 14,
  lineHeight: 1.75,
  margin: 0,
};

const highlightStyle: CSSProperties = {
  color: 'var(--hc-lime)',
  fontWeight: 900,
};

const buttonRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  marginTop: 24,
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 12,
  border: '1px solid var(--hc-line)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--hc-text)',
  fontSize: 14,
  fontWeight: 850,
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 46,
  borderRadius: 12,
  border: '1px solid rgba(208,255,90,0.9)',
  background: 'var(--hc-lime)',
  color: '#0e1212',
  fontSize: 14,
  fontWeight: 900,
  cursor: 'pointer',
};
