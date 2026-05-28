'use client';

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}

export default function PromptInput({
  value,
  onChange,
  disabled = false,
  maxLength = 500,
}: PromptInputProps) {
  return (
    <div>
      <div style={headerStyle}>
        <label htmlFor="prompt-input" style={labelStyle}>
          创作提示词
        </label>
        <div
          style={helpWrapStyle}
          onMouseEnter={(e) => {
            const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement | null;
            if (tip) tip.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            const tip = e.currentTarget.querySelector('[data-tip]') as HTMLElement | null;
            if (tip) tip.style.opacity = '0';
          }}
        >
          <span style={helpDotStyle}>i</span>
          <div style={tipStyle}>
            请避免输入未经授权的公众人物、歌手、乐队、受版权保护曲目名称，以及暴力、仇恨、色情等违规内容。
          </div>
        </div>
      </div>
      <textarea
        id="prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={maxLength}
        placeholder="描述你想要的音乐风格，例如：一首轻快的华语流行歌，带吉他和钢琴伴奏，适合夏天傍晚听。"
        style={{
          ...textareaStyle,
          background: disabled ? 'rgba(255,255,255,.04)' : '#0d0f14',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onFocus={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = 'var(--hc-lime)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--hc-line)';
        }}
        aria-label="创作提示词输入"
      />
      <div style={metaStyle}>
        <span>可选：输入提示词或选择模板，也可以两者结合。</span>
        <span>{value.length}/{maxLength}</span>
      </div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 9,
};

const labelStyle: React.CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 14,
  fontWeight: 900,
};

const helpWrapStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
};

const helpDotStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid rgba(206,255,53,.36)',
  background: 'rgba(206,255,53,.12)',
  color: 'var(--hc-lime)',
  fontSize: 11,
  fontWeight: 900,
  cursor: 'help',
};

const tipStyle: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: 'calc(100% + 8px)',
  transform: 'translateX(-50%)',
  width: 280,
  padding: '11px 13px',
  borderRadius: 12,
  border: '1px solid var(--hc-line)',
  background: '#15181f',
  color: 'var(--hc-muted)',
  boxShadow: 'var(--hc-shadow)',
  fontSize: 12,
  lineHeight: 1.6,
  zIndex: 20,
  opacity: 0,
  pointerEvents: 'none',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 110,
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid var(--hc-line)',
  color: 'var(--hc-text)',
  fontSize: 14,
  lineHeight: 1.6,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color .2s ease, background .2s ease',
};

const metaStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 7,
  color: 'var(--hc-muted)',
  fontSize: 12,
};
