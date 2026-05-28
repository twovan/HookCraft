'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

export interface SensitivityBlockDialogProps {
  open: boolean;
  blockedWords: string[];
  source: 'description' | 'lyrics';
  onClose: () => void;
}

export default function SensitivityBlockDialog({
  open,
  blockedWords,
  source,
  onClose,
}: SensitivityBlockDialogProps) {
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

  const sourceText = source === 'description' ? '创作描述' : '歌词';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sensitivity-block-title" style={rootStyle(visible)}>
      <button type="button" aria-label="关闭弹窗" onClick={onClose} style={backdropStyle} />
      <div style={dialogStyle(visible)}>
        <div style={iconWrapStyle}>
          <WarningIcon />
        </div>

        <div style={copyStyle}>
          <h2 id="sensitivity-block-title" style={titleStyle}>需要修改后再生成</h2>
          <p style={messageStyle}>
            你的{sourceText}中包含当前不能使用的词语。请返回编辑，替换为更安全的风格、情绪或场景描述。
          </p>
        </div>

        {blockedWords.length > 0 && (
          <div style={wordCloudStyle}>
            {blockedWords.map((word, index) => (
              <span key={`${word}-${index}`} style={wordTagStyle}>
                {word}
              </span>
            ))}
          </div>
        )}

        <button type="button" onClick={onClose} style={primaryButtonStyle}>
          返回修改
        </button>
      </div>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M10.6 3.7 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.4 3.7a1.6 1.6 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
    width: 'min(92vw, 460px)',
    borderRadius: 20,
    border: '1px solid rgba(255,122,102,0.28)',
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
  color: '#ff9a88',
  background: 'rgba(255,122,102,0.11)',
  border: '1px solid rgba(255,122,102,0.24)',
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
  lineHeight: 1.7,
  margin: 0,
};

const wordCloudStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 8,
  margin: '20px 0 24px',
  padding: 12,
  borderRadius: 14,
  background: 'rgba(255,122,102,0.075)',
  border: '1px solid rgba(255,122,102,0.18)',
};

const wordTagStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(255,122,102,0.12)',
  color: '#ffb3a5',
  border: '1px solid rgba(255,122,102,0.24)',
  fontSize: 13,
  fontWeight: 800,
};

const primaryButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 46,
  borderRadius: 12,
  border: '1px solid rgba(208,255,90,0.9)',
  background: 'var(--hc-lime)',
  color: '#0e1212',
  fontSize: 14,
  fontWeight: 900,
  cursor: 'pointer',
};
