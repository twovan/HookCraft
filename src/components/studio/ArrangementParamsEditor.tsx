'use client';

import { useEffect, useRef, useState } from 'react';
import type { ArrangementParams } from '@/types/arrangement';

export interface ArrangementParamsEditorProps {
  params: ArrangementParams;
  onChange: (params: ArrangementParams) => void;
  extractedLyrics: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled: boolean;
  /** 翻唱模式：one-step 一步模式，two-step 两步模式 */
  coverMode: 'one-step' | 'two-step';
  onCoverModeChange: (mode: 'one-step' | 'two-step') => void;
}

/** 歌词结构标签 */
const STRUCTURE_TAGS = [
  '[Intro]', '[Verse]', '[Pre Chorus]', '[Chorus]',
  '[Bridge]', '[Outro]', '[Interlude]', '[Hook]', '[Inst]',
];

/**
 * 编曲参数编辑面板
 * 
 * 参照 MiniMax 官方 music-cover 界面：
 * - 翻唱模式切换（一步/两步）
 * - 风格描述（必填，10-300字符）
 * - 歌词结构标签（点击插入）
 * - 歌词编辑（可选，不填则自动从参考音频提取）
 * - 高级设置（采样率、比特率、音频格式、Seed、水印）
 */
export default function ArrangementParamsEditor({
  params,
  onChange,
  extractedLyrics,
  onGenerate,
  isGenerating,
  disabled,
  coverMode,
  onCoverModeChange,
}: ArrangementParamsEditorProps) {
  const lyricsInitialized = useRef(false);
  const lyricsRef = useRef<HTMLTextAreaElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 两步模式下，预处理完成后预填充歌词
  useEffect(() => {
    if (extractedLyrics && !lyricsInitialized.current && coverMode === 'two-step') {
      lyricsInitialized.current = true;
      onChange({ ...params, lyrics: extractedLyrics });
    }
  }, [extractedLyrics]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateParam = <K extends keyof ArrangementParams>(key: K, value: ArrangementParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const isButtonDisabled = disabled || isGenerating;

  /** 插入歌词结构标签到光标位置 */
  const insertTag = (tag: string) => {
    if (isButtonDisabled) return;
    const textarea = lyricsRef.current;
    if (!textarea) {
      updateParam('lyrics', params.lyrics + '\n' + tag + '\n');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = params.lyrics;
    const newText = text.substring(0, start) + tag + '\n' + text.substring(end);
    updateParam('lyrics', newText);
    // 恢复光标位置
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length + 1;
      textarea.focus();
    }, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 模式切换 - 不受 disabled 控制，随时可切换 */}
      <Section title="创作模式">
        <div style={{ display: 'flex', gap: '4px', background: '#12121e', borderRadius: '10px', padding: '4px' }}>
          <button
            onClick={() => onCoverModeChange('one-step')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: coverMode === 'one-step' ? 'rgba(117, 54, 213, 0.2)' : 'transparent',
              color: coverMode === 'one-step' ? '#e8e8f0' : '#9ca3af',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              borderBottom: coverMode === 'one-step' ? '2px solid #7536d5' : '2px solid transparent',
            }}
          >
            快速创作（一步）
          </button>
          <button
            onClick={() => onCoverModeChange('two-step')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: coverMode === 'two-step' ? 'rgba(117, 54, 213, 0.2)' : 'transparent',
              color: coverMode === 'two-step' ? '#e8e8f0' : '#9ca3af',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              borderBottom: coverMode === 'two-step' ? '2px solid #7536d5' : '2px solid transparent',
            }}
          >
            自定义创作（两步）
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0 0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
          {coverMode === 'one-step'
            ? '直接传入音频生成，歌词自动提取'
            : '先上传音频预处理提取歌词，再修改歌词生成'}
        </p>
      </Section>

      {/* 风格描述（必填） */}
      <Section title="音乐风格描述" required>
        <textarea
          value={params.prompt}
          onChange={(e) => updateParam('prompt', e.target.value)}
          disabled={isButtonDisabled}
          maxLength={2000}
          placeholder="描述目标风格，例如：摇滚,热血,叛逆,青春,吉他,激情"
          aria-label="风格描述输入"
          style={textareaStyle(isButtonDisabled, '80px')}
          onFocus={(e) => { if (!isButtonDisabled) e.currentTarget.style.borderColor = '#7536d5'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#2a2a40'; }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
            {coverMode === 'one-step' ? '必填，10-300 字符' : '必填，10-2000 字符'}
          </span>
          <CharCount current={params.prompt.length} max={coverMode === 'one-step' ? 300 : 2000} />
        </div>
      </Section>

      {/* 歌词编辑 */}
      <Section title="歌词">
        <textarea
          ref={lyricsRef}
          value={params.lyrics}
          onChange={(e) => updateParam('lyrics', e.target.value)}
          disabled={isButtonDisabled}
          maxLength={coverMode === 'one-step' ? 1000 : 3500}
          placeholder={coverMode === 'one-step'
            ? '（可选，不填则自动从参考音频提取）'
            : '输入或编辑歌词，支持结构标签如 [Verse]、[Chorus]...'}
          aria-label="歌词编辑器"
          style={textareaStyle(isButtonDisabled, '160px')}
          onFocus={(e) => { if (!isButtonDisabled) e.currentTarget.style.borderColor = '#7536d5'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#2a2a40'; }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
            {coverMode === 'one-step' ? '可选，不填则自动从参考音频提取' : '两步模式下歌词必填，10-1000 字符'}
          </span>
          <CharCount current={params.lyrics.length} max={coverMode === 'one-step' ? 1000 : 3500} />
        </div>
      </Section>

      {/* 高级设置折叠 */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}
        >
          ⚙ 高级设置 {showAdvanced ? '▲' : '▼'}
        </button>

        {showAdvanced && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 采样率 & 比特率 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>采样率</label>
                <select disabled={isButtonDisabled} style={selectStyle(isButtonDisabled)} defaultValue={44100}>
                  <option value={44100}>44100 Hz (推荐)</option>
                  <option value={32000}>32000 Hz</option>
                  <option value={24000}>24000 Hz</option>
                  <option value={16000}>16000 Hz</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>比特率</label>
                <select disabled={isButtonDisabled} style={selectStyle(isButtonDisabled)} defaultValue={256000}>
                  <option value={256000}>256 kbps (推荐)</option>
                  <option value={128000}>128 kbps</option>
                  <option value={64000}>64 kbps</option>
                  <option value={32000}>32 kbps</option>
                </select>
              </div>
            </div>

            {/* 音频格式 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>音频格式</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['mp3', 'wav'] as const).map((fmt) => {
                    const isSelected = params.outputFormat === fmt;
                    return (
                      <button
                        key={fmt}
                        onClick={() => updateParam('outputFormat', fmt)}
                        disabled={isButtonDisabled}
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
                          textTransform: 'uppercase',
                          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                        }}
                      >
                        {fmt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Seed */}
            <div>
              <label style={labelStyle}>Seed（可选，相同 seed + 相同输入可复现结果）</label>
              <input
                type="number"
                min={0}
                max={1000000}
                placeholder="0 - 1000000"
                disabled={isButtonDisabled}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #2a2a40',
                  background: isButtonDisabled ? '#12121e' : '#0d0d14',
                  color: '#e8e8f0',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  opacity: isButtonDisabled ? 0.5 : 1,
                }}
              />
            </div>

            {/* AI 音频水印 - 已移除 */}
          </div>
        )}
      </div>

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
            : 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
          color: disabled || isGenerating ? '#666' : '#fff',
          fontSize: '16px',
          fontWeight: 700,
          cursor: disabled || isGenerating ? 'not-allowed' : 'pointer',
          opacity: disabled || isGenerating ? 0.6 : 1,
          transition: 'all 0.3s ease',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          boxShadow: disabled || isGenerating ? 'none' : '0 4px 16px rgba(231, 76, 60, 0.3)',
        }}
      >
        {isGenerating ? '生成中...' : '🎵 生成音乐'}
      </button>

      {/* 使用提示 - 已移到左侧面板 */}
    </div>
  );
}

/** 区块标题 */
function Section({ title, children, required }: { title: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#e8e8f0', marginBottom: '8px', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
        {title}{required && <span style={{ color: '#e74c3c', marginLeft: '4px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <span style={{ fontSize: '11px', color: current > max * 0.9 ? '#e74c3c' : '#6b7280' }}>
      {current}/{max} 字符
    </span>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

function selectStyle(isDisabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #2a2a40',
    background: isDisabled ? '#12121e' : '#0d0d14', color: '#e8e8f0', fontSize: '13px',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1, outline: 'none', appearance: 'auto' as const,
  };
}

function textareaStyle(isDisabled: boolean, minHeight: string): React.CSSProperties {
  return {
    width: '100%', minHeight, padding: '12px 14px', borderRadius: '10px', border: '1px solid #2a2a40',
    background: isDisabled ? '#12121e' : '#0d0d14', color: '#e8e8f0', fontSize: '14px',
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", lineHeight: 1.6,
    resize: 'vertical', outline: 'none', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s ease', opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'text',
  };
}
