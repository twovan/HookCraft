'use client';

import { useEffect, useRef } from 'react';
import type { ArrangementParams } from '@/types/arrangement';

export interface ArrangementParamsEditorProps {
  params: ArrangementParams;
  onChange: (params: ArrangementParams) => void;
  extractedLyrics: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

/**
 * 编曲参数编辑面板（精简版）
 *
 * 根据 MiniMax music-cover API 文档，实际有效参数为：
 * - prompt: 风格描述（必填，最多 2000 字符）
 * - lyrics: 歌词（可选，支持结构标签）
 * - sample_rate / bitrate / format: 音频输出设置
 *
 * BPM、调性、音阶、乐器等不是 API 独立参数，
 * 用户可以在风格描述中自由表达这些意图。
 */
export default function ArrangementParamsEditor({
  params,
  onChange,
  extractedLyrics,
  onGenerate,
  isGenerating,
  disabled,
}: ArrangementParamsEditorProps) {
  const lyricsInitialized = useRef(false);

  // 当 extractedLyrics 变化时预填充歌词
  useEffect(() => {
    if (extractedLyrics && !lyricsInitialized.current) {
      lyricsInitialized.current = true;
      onChange({ ...params, lyrics: extractedLyrics });
    }
  }, [extractedLyrics]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateParam = <K extends keyof ArrangementParams>(key: K, value: ArrangementParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const isButtonDisabled = disabled || isGenerating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 风格描述 Prompt（核心参数） */}
      <Section title="风格描述" required>
        <textarea
          value={params.prompt}
          onChange={(e) => updateParam('prompt', e.target.value)}
          disabled={isButtonDisabled}
          maxLength={2000}
          placeholder="描述你想要的翻唱/编曲风格，例如：&#10;• Jazz arrangement, saxophone lead, smooth female vocal&#10;• EDM remix, 128 BPM, synth bass, driving beat&#10;• 民谣风格，木吉他伴奏，温暖男声&#10;• Lo-fi hip hop, vinyl crackle, chill beat"
          aria-label="风格描述输入"
          style={textareaStyle(isButtonDisabled, '120px')}
          onFocus={(e) => { if (!isButtonDisabled) e.currentTarget.style.borderColor = '#7536d5'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#2a2a40'; }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{
            fontSize: '12px',
            color: '#6b7280',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}>
            可包含风格、乐器、BPM、情绪等描述
          </span>
          <CharCount current={params.prompt.length} max={2000} />
        </div>
      </Section>

      {/* 纯器乐模式切换 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#12121e',
        borderRadius: '10px',
        border: '1px solid #2a2a40',
      }}>
        <div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e8f0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
            纯器乐模式
          </span>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
            开启后不使用歌词，仅生成器乐版本
          </p>
        </div>
        <label
          style={{
            position: 'relative',
            display: 'inline-block',
            width: '44px',
            height: '24px',
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
            opacity: isButtonDisabled ? 0.5 : 1,
            flexShrink: 0,
          }}
          aria-label="纯器乐模式切换"
        >
          <input
            type="checkbox"
            checked={params.isInstrumental}
            onChange={(e) => updateParam('isInstrumental', e.target.checked)}
            disabled={isButtonDisabled}
            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '12px',
              background: params.isInstrumental ? '#7536d5' : '#2a2a40',
              transition: 'background 0.3s ease',
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: '3px',
              left: params.isInstrumental ? '23px' : '3px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.3s ease',
            }}
          />
        </label>
      </div>

      {/* 歌词编辑器 */}
      {!params.isInstrumental && (
        <Section title="歌词">
          <textarea
            value={params.lyrics}
            onChange={(e) => updateParam('lyrics', e.target.value)}
            disabled={isButtonDisabled}
            maxLength={3500}
            placeholder="输入或编辑歌词，支持结构标签如 [verse]、[chorus]、[bridge]...&#10;&#10;预处理后会自动填充提取的歌词，你可以在此基础上修改。"
            aria-label="歌词编辑器"
            style={textareaStyle(isButtonDisabled, '160px')}
            onFocus={(e) => { if (!isButtonDisabled) e.currentTarget.style.borderColor = '#7536d5'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#2a2a40'; }}
          />
          <CharCount current={params.lyrics.length} max={3500} />
        </Section>
      )}

      {/* 输出设置 */}
      <Section title="输出设置">
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* 输出格式 */}
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#9ca3af',
              marginBottom: '6px',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}>
              格式
            </label>
            <div style={{ display: 'flex', gap: '8px' }} role="radiogroup" aria-label="输出格式选择">
              {(['mp3', 'wav'] as const).map((fmt) => {
                const isSelected = params.outputFormat === fmt;
                return (
                  <button
                    key={fmt}
                    onClick={() => updateParam('outputFormat', fmt)}
                    disabled={isButtonDisabled}
                    role="radio"
                    aria-checked={isSelected}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '6px',
                      border: isSelected ? '1.5px solid #7536d5' : '1px solid #2a2a40',
                      background: isSelected ? 'rgba(117, 54, 213, 0.12)' : '#1a1a2e',
                      color: isSelected ? '#7536d5' : '#e8e8f0',
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
                      opacity: isButtonDisabled ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      textTransform: 'uppercase',
                    }}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 采样率 */}
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#9ca3af',
              marginBottom: '6px',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}>
              采样率
            </label>
            <select
              value={44100}
              disabled={isButtonDisabled}
              aria-label="采样率选择"
              style={selectStyle(isButtonDisabled)}
            >
              <option value={44100}>44100 Hz</option>
              <option value={32000}>32000 Hz</option>
              <option value={24000}>24000 Hz</option>
              <option value={16000}>16000 Hz</option>
            </select>
          </div>

          {/* 比特率 */}
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              color: '#9ca3af',
              marginBottom: '6px',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}>
              比特率
            </label>
            <select
              value={256000}
              disabled={isButtonDisabled}
              aria-label="比特率选择"
              style={selectStyle(isButtonDisabled)}
            >
              <option value={256000}>256 kbps</option>
              <option value={128000}>128 kbps</option>
              <option value={64000}>64 kbps</option>
              <option value={32000}>32 kbps</option>
            </select>
          </div>
        </div>
      </Section>

      {/* 生成按钮 */}
      <button
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        aria-label="生成编曲"
        style={{
          width: '100%',
          padding: '14px 24px',
          borderRadius: '12px',
          border: 'none',
          background: disabled || isGenerating
            ? '#2a2a40'
            : 'linear-gradient(135deg, #7536d5 0%, #9b59b6 100%)',
          color: disabled || isGenerating ? '#666' : '#fff',
          fontSize: '16px',
          fontWeight: 700,
          cursor: disabled || isGenerating ? 'not-allowed' : 'pointer',
          opacity: disabled || isGenerating ? 0.6 : 1,
          transition: 'all 0.3s ease',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          boxShadow: disabled || isGenerating ? 'none' : '0 4px 16px rgba(117, 54, 213, 0.3)',
        }}
      >
        {isGenerating ? '生成中...' : '生成编曲'}
      </button>

      {/* 提示信息 */}
      {disabled && (
        <p style={{
          fontSize: '12px',
          color: '#6b7280',
          textAlign: 'center',
          margin: 0,
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}>
          请先上传音频并完成分析后再编辑参数
        </p>
      )}
    </div>
  );
}

/** 区块标题包装组件 */
function Section({
  title,
  children,
  style,
  required,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  required?: boolean;
}) {
  return (
    <div style={style}>
      <label
        style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 600,
          color: '#e8e8f0',
          marginBottom: '8px',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}
      >
        {title}
        {required && <span style={{ color: '#7536d5', marginLeft: '4px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/** 字符计数组件 */
function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <span
      style={{
        fontSize: '12px',
        color: current > max * 0.9 ? '#e74c3c' : '#6b7280',
      }}
    >
      {current}/{max}
    </span>
  );
}

/** 下拉选择框样式 */
function selectStyle(isDisabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #2a2a40',
    background: isDisabled ? '#12121e' : '#0d0d14',
    color: '#e8e8f0',
    fontSize: '13px',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    outline: 'none',
    appearance: 'auto',
  };
}

/** 文本域样式 */
function textareaStyle(isDisabled: boolean, minHeight: string): React.CSSProperties {
  return {
    width: '100%',
    minHeight,
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #2a2a40',
    background: isDisabled ? '#12121e' : '#0d0d14',
    color: '#e8e8f0',
    fontSize: '14px',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s ease',
    opacity: isDisabled ? 0.5 : 1,
    cursor: isDisabled ? 'not-allowed' : 'text',
  };
}
