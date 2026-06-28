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
    createElement('style', null, animationStyles),
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

const animationStyles = `
@keyframes studioGenerateGradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes studioGenerateGlow {
  0%, 100% { box-shadow: 0 18px 46px rgba(233,8,111,.34), inset 0 1px 0 rgba(255,255,255,.24); }
  50% { box-shadow: 0 20px 56px rgba(233,8,111,.46), 0 0 22px rgba(217,52,180,.26), inset 0 1px 0 rgba(255,255,255,.3); }
}
`;

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
    background: disabled ? '#26272b' : 'linear-gradient(90deg, #e9086f, #d934b4)',
    backgroundSize: disabled ? '100% 100%' : '220% 100%',
    color: disabled ? '#8a8d94' : '#fff',
    fontFamily: 'var(--hc-font)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled
      ? 'none'
      : '0 18px 46px rgba(233,8,111,.34), inset 0 1px 0 rgba(255,255,255,.24)',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease',
    animation: disabled ? 'none' : 'studioGenerateGradient 4.8s ease-in-out infinite, studioGenerateGlow 2.8s ease-in-out infinite',
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
    background: disabled ? '#1b1c20' : 'rgba(0,0,0,.2)',
    color: disabled ? '#a5a8af' : 'rgba(255,255,255,.92)',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
}
