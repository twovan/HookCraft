import { createElement, type CSSProperties, type ReactNode } from 'react';

interface FloatingGenerateButtonProps {
  children: ReactNode;
  creditLabel: string;
  disabled?: boolean;
  onClick: () => void;
  busy?: boolean;
  className?: string;
}

export default function FloatingGenerateButton({
  children,
  creditLabel,
  disabled = false,
  onClick,
  busy = false,
  className,
}: FloatingGenerateButtonProps) {
  const inactive = disabled || busy;

  return createElement(
    'div',
    { className, style: wrapperStyle },
    createElement(
      'button',
      {
        type: 'button',
        disabled,
        onClick,
        style: buttonStyle(inactive),
        onMouseEnter: (event: { currentTarget: HTMLButtonElement }) => {
          if (!inactive) event.currentTarget.style.transform = 'translateY(-3px)';
        },
        onMouseLeave: (event: { currentTarget: HTMLButtonElement }) => {
          event.currentTarget.style.transform = 'translateY(0)';
        },
      },
      createElement('span', { style: labelStyle }, createElement('span', { style: musicIconStyle }, '♪'), children),
      createElement('span', { style: creditStyle(inactive) }, createElement('span', { style: coinStyle }, 'C'), creditLabel),
    ),
  );
}

const wrapperStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 24,
  transform: 'translateX(-50%)',
  zIndex: 60,
  width: 'min(1240px, calc(100vw - 48px))',
  padding: '0 clamp(0px, 1vw, 18px)',
  pointerEvents: 'none',
};

const labelStyle: CSSProperties = {
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  fontSize: 17,
  fontWeight: 950,
  lineHeight: 1,
};

const musicIconStyle: CSSProperties = {
  fontSize: 19,
  lineHeight: 1,
};

const coinStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #ffe270, #ffb51f)',
  color: '#140009',
  fontSize: 10,
  fontWeight: 950,
};

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    minHeight: 58,
    padding: '0 clamp(18px, 3vw, 30px)',
    borderRadius: 999,
    border: 'none',
    background: disabled
      ? 'linear-gradient(90deg, rgba(255,255,255,.13), rgba(255,255,255,.08))'
      : 'linear-gradient(90deg, #e9086f, #d934b4)',
    color: disabled ? 'var(--hc-text-weak)' : '#fff',
    fontFamily: 'var(--hc-font)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled
      ? 'none'
      : '0 18px 46px rgba(233,8,111,.34), inset 0 1px 0 rgba(255,255,255,.24)',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 14,
    letterSpacing: 0,
    pointerEvents: 'auto',
  };
}

function creditStyle(disabled: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 34,
    padding: '0 13px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,.22)',
    background: disabled ? 'rgba(0,0,0,.12)' : 'rgba(0,0,0,.2)',
    color: disabled ? 'var(--hc-text-weak)' : 'rgba(255,255,255,.92)',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
}
