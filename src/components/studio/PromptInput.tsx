'use client';

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}

/**
 * Prompt 输入组件
 * - Textarea 用于输入提示词
 * - Placeholder 引导用户
 */
export default function PromptInput({
  value,
  onChange,
  disabled = false,
  maxLength = 500,
}: PromptInputProps) {
  return (
    <div>
      <label
        htmlFor="prompt-input"
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 600,
          color: '#e8e8f0',
          marginBottom: '8px',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}
      >
        创作提示词
      </label>
      <textarea
        id="prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={maxLength}
        placeholder="描述你想要的音乐风格，例如：一首轻快的流行歌曲，带有吉他和钢琴伴奏，适合夏天听的感觉..."
        style={{
          width: '100%',
          minHeight: '100px',
          padding: '14px 16px',
          borderRadius: '12px',
          border: '1px solid #2a2a40',
          background: disabled ? '#F7F7F7' : '#0d0d14',
          fontSize: '14px',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          color: '#e8e8f0',
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.currentTarget.style.borderColor = '#7536d5';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#2a2a40';
        }}
        aria-label="创作提示词输入"
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '6px',
          fontSize: '12px',
          color: '#999',
        }}
      >
        <span>可选：输入提示词或选择模板，也可以两者结合</span>
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
