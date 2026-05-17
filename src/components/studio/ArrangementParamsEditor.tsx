'use client';

import { useEffect, useRef } from 'react';
import type { ArrangementParams, MusicalKey, MusicalScale, ArrangementDuration } from '@/types/arrangement';

export interface ArrangementParamsEditorProps {
  params: ArrangementParams;
  onChange: (params: ArrangementParams) => void;
  extractedLyrics: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

/** 时长选项 */
const DURATION_OPTIONS: ArrangementDuration[] = [30, 60, 90, 120];

/** 12 个半音 */
const MUSICAL_KEYS: MusicalKey[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 音阶选项及中文标签 */
const SCALE_OPTIONS: { value: MusicalScale; label: string }[] = [
  { value: 'major', label: '大调 (Major)' },
  { value: 'minor', label: '小调 (Minor)' },
  { value: 'dorian', label: '多利亚 (Dorian)' },
  { value: 'mixolydian', label: '混合利底亚 (Mixolydian)' },
  { value: 'pentatonic', label: '五声音阶 (Pentatonic)' },
];

/** 常用乐器列表 */
const COMMON_INSTRUMENTS: string[] = [
  'piano', 'guitar', 'bass', 'drums', 'strings', 'synth',
  'violin', 'cello', 'flute', 'saxophone', 'trumpet', 'organ',
  'harp', 'ukulele', 'mandolin', 'accordion', 'harmonica',
  'erhu', 'pipa', 'guzheng',
];

/** 乐器中文标签映射 */
const INSTRUMENT_LABELS: Record<string, string> = {
  piano: '钢琴', guitar: '吉他', bass: '贝斯', drums: '鼓',
  strings: '弦乐', synth: '合成器', violin: '小提琴', cello: '大提琴',
  flute: '长笛', saxophone: '萨克斯', trumpet: '小号', organ: '管风琴',
  harp: '竖琴', ukulele: '尤克里里', mandolin: '曼陀林',
  accordion: '手风琴', harmonica: '口琴', erhu: '二胡', pipa: '琵琶', guzheng: '古筝',
};

/**
 * 编曲参数编辑面板
 * - 时长选择按钮组（30/60/90/120s，默认 60s）
 * - BPM 滑块（60-200，步进 1，默认 120）
 * - 调性选择器（12 个半音，默认 C）
 * - 音阶选择器（major/minor/dorian/mixolydian/pentatonic，默认 major）
 * - 乐器多选标签（1-10 个）
 * - 风格描述 Prompt 输入（最大 2000 字符，可选）
 * - 歌词编辑器（预填充提取歌词，最大 3500 字符）
 * - 纯器乐模式切换（启用时禁用歌词编辑器，保留内容）
 * - 输出格式选择（MP3/WAV，默认 MP3）
 * - 预处理未完成时禁用生成按钮和参数控件
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

  const toggleInstrument = (instrument: string) => {
    if (disabled) return;
    const current = params.instruments;
    if (current.includes(instrument)) {
      if (current.length > 1) {
        updateParam('instruments', current.filter((i) => i !== instrument));
      }
    } else {
      if (current.length < 10) {
        updateParam('instruments', [...current, instrument]);
      }
    }
  };

  const isButtonDisabled = disabled || isGenerating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 时长选择 */}
      <Section title="生成时长">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="radiogroup" aria-label="生成时长选择">
          {DURATION_OPTIONS.map((d) => {
            const isSelected = params.duration === d;
            return (
              <button
                key={d}
                onClick={() => updateParam('duration', d)}
                disabled={isButtonDisabled}
                role="radio"
                aria-checked={isSelected}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid #7536d5' : '1px solid #2a2a40',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(117, 54, 213, 0.15) 0%, #0d0d14 100%)'
                    : '#1a1a2e',
                  color: isSelected ? '#7536d5' : '#e8e8f0',
                  fontSize: '14px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
                  opacity: isButtonDisabled ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                }}
              >
                {d}s
              </button>
            );
          })}
        </div>
      </Section>

      {/* BPM 滑块 */}
      <Section title="BPM (速度)">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min={60}
            max={200}
            step={1}
            value={params.bpm}
            onChange={(e) => updateParam('bpm', Number(e.target.value))}
            disabled={isButtonDisabled}
            aria-label="BPM 滑块"
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '3px',
              cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
              accentColor: '#7536d5',
            }}
          />
          <span
            style={{
              minWidth: '44px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: '#7536d5',
              background: '#1a1a2e',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #2a2a40',
            }}
          >
            {params.bpm}
          </span>
        </div>
      </Section>

      {/* 调性 & 音阶 */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <Section title="调性" style={{ flex: 1 }}>
          <select
            value={params.musicalKey}
            onChange={(e) => updateParam('musicalKey', e.target.value as MusicalKey)}
            disabled={isButtonDisabled}
            aria-label="调性选择"
            style={selectStyle(isButtonDisabled)}
          >
            {MUSICAL_KEYS.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </Section>

        <Section title="音阶" style={{ flex: 1 }}>
          <select
            value={params.scale}
            onChange={(e) => updateParam('scale', e.target.value as MusicalScale)}
            disabled={isButtonDisabled}
            aria-label="音阶选择"
            style={selectStyle(isButtonDisabled)}
          >
            {SCALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Section>
      </div>

      {/* 乐器多选标签 */}
      <Section title={`乐器选择 (${params.instruments.length}/10)`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {COMMON_INSTRUMENTS.map((inst) => {
            const isSelected = params.instruments.includes(inst);
            const atMax = params.instruments.length >= 10 && !isSelected;
            return (
              <button
                key={inst}
                onClick={() => toggleInstrument(inst)}
                disabled={isButtonDisabled || atMax}
                aria-pressed={isSelected}
                title={INSTRUMENT_LABELS[inst] || inst}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  border: isSelected ? '1.5px solid #7536d5' : '1px solid #2a2a40',
                  background: isSelected ? 'rgba(117, 54, 213, 0.15)' : '#1a1a2e',
                  color: isSelected ? '#7536d5' : '#e8e8f0',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: isButtonDisabled || atMax ? 'not-allowed' : 'pointer',
                  opacity: isButtonDisabled ? 0.5 : atMax ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                }}
              >
                {INSTRUMENT_LABELS[inst] || inst}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 风格描述 Prompt */}
      <Section title="风格描述 (可选)">
        <textarea
          value={params.prompt}
          onChange={(e) => updateParam('prompt', e.target.value)}
          disabled={isButtonDisabled}
          maxLength={2000}
          placeholder="描述你想要的编曲风格，例如：梦幻感的电子流行编曲，带有空灵的合成器音色..."
          aria-label="风格描述输入"
          style={textareaStyle(isButtonDisabled, '80px')}
          onFocus={(e) => { if (!isButtonDisabled) e.currentTarget.style.borderColor = '#7536d5'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#2a2a40'; }}
        />
        <CharCount current={params.prompt.length} max={2000} />
      </Section>

      {/* 纯器乐模式切换 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e8f0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
          纯器乐模式
        </span>
        <label
          style={{
            position: 'relative',
            display: 'inline-block',
            width: '44px',
            height: '24px',
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
            opacity: isButtonDisabled ? 0.5 : 1,
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
      <Section title="歌词">
        <textarea
          value={params.lyrics}
          onChange={(e) => updateParam('lyrics', e.target.value)}
          disabled={isButtonDisabled || params.isInstrumental}
          maxLength={3500}
          placeholder={params.isInstrumental ? '纯器乐模式已启用，歌词编辑已禁用' : '输入或编辑歌词，支持结构标签如 [verse]、[chorus]...'}
          aria-label="歌词编辑器"
          style={textareaStyle(isButtonDisabled || params.isInstrumental, '140px')}
          onFocus={(e) => { if (!isButtonDisabled && !params.isInstrumental) e.currentTarget.style.borderColor = '#7536d5'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#2a2a40'; }}
        />
        <CharCount current={params.lyrics.length} max={3500} />
      </Section>

      {/* 输出格式 */}
      <Section title="输出格式">
        <div style={{ display: 'flex', gap: '12px' }} role="radiogroup" aria-label="输出格式选择">
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
                  padding: '8px 24px',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid #7536d5' : '1px solid #2a2a40',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(117, 54, 213, 0.15) 0%, #0d0d14 100%)'
                    : '#1a1a2e',
                  color: isSelected ? '#7536d5' : '#e8e8f0',
                  fontSize: '14px',
                  fontWeight: isSelected ? 700 : 500,
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
    </div>
  );
}

/** 区块标题包装组件 */
function Section({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
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
      </label>
      {children}
    </div>
  );
}

/** 字符计数组件 */
function CharCount({ current, max }: { current: number; max: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '4px',
        fontSize: '12px',
        color: current > max * 0.9 ? '#e74c3c' : '#666',
      }}
    >
      {current}/{max}
    </div>
  );
}

/** 下拉选择框样式 */
function selectStyle(isDisabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #2a2a40',
    background: isDisabled ? '#12121e' : '#0d0d14',
    color: '#e8e8f0',
    fontSize: '14px',
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
