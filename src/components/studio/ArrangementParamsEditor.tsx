'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ArrangementParams } from '@/types/arrangement';

export interface ArrangementParamsEditorProps {
  params: ArrangementParams;
  onChange: (params: ArrangementParams) => void;
  extractedLyrics: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled: boolean;
  coverMode: 'one-step' | 'two-step';
  onCoverModeChange: (mode: 'one-step' | 'two-step') => void;
}

const STRUCTURE_TAGS = [
  '[Intro]',
  '[Verse]',
  '[Pre Chorus]',
  '[Chorus]',
  '[Bridge]',
  '[Hook]',
  '[Interlude]',
  '[Outro]',
  '[Inst]',
];

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

  useEffect(() => {
    if (extractedLyrics && !lyricsInitialized.current && coverMode === 'two-step') {
      lyricsInitialized.current = true;
      onChange({ ...params, lyrics: extractedLyrics });
    }
  }, [coverMode, extractedLyrics, onChange, params]);

  const updateParam = <K extends keyof ArrangementParams>(key: K, value: ArrangementParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const isLocked = disabled || isGenerating;
  const promptLimit = coverMode === 'one-step' ? 300 : 2000;
  const lyricLimit = coverMode === 'one-step' ? 1000 : 3500;

  const insertTag = (tag: string) => {
    if (isLocked) return;

    const textarea = lyricsRef.current;
    if (!textarea) {
      updateParam('lyrics', `${params.lyrics}\n${tag}\n`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextLyrics = `${params.lyrics.substring(0, start)}${tag}\n${params.lyrics.substring(end)}`;
    updateParam('lyrics', nextLyrics);

    window.setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length + 1;
      textarea.focus();
    }, 0);
  };

  return (
    <div style={panelStyle}>
      <Section
        title="创作模式"
        description={coverMode === 'one-step' ? '直接上传参考音频生成，适合快速得到完整版本。' : '先提取歌词与结构，再微调文本后生成，适合需要控制段落的翻唱。'}
      >
        <div style={segmentStyle}>
          <ModeButton
            active={coverMode === 'one-step'}
            title="快速创作"
            detail="一步生成"
            onClick={() => onCoverModeChange('one-step')}
          />
          <ModeButton
            active={coverMode === 'two-step'}
            title="精修创作"
            detail="两步生成"
            onClick={() => onCoverModeChange('two-step')}
          />
        </div>
      </Section>

      <Section title="音乐风格描述" required description="写清楚目标风格、情绪、速度、乐器和人声方向。">
        <textarea
          value={params.prompt}
          onChange={(event) => updateParam('prompt', event.target.value)}
          disabled={isLocked}
          maxLength={2000}
          placeholder="例如：明亮的 indie pop，120 BPM，干净电吉他和轻快鼓组，副歌更开阔，女声带一点空气感。"
          aria-label="音乐风格描述"
          style={textareaStyle(isLocked, 104)}
        />
        <FieldFooter
          hint={coverMode === 'one-step' ? '建议 10-300 字，越具体越容易贴近目标。' : '两步模式可写得更详细，最多 2000 字。'}
          current={params.prompt.length}
          max={promptLimit}
        />
      </Section>

      <Section title="歌词与结构" description="可插入段落标签，让生成结果更接近真实歌曲编排。">
        <div style={tagGridStyle}>
          {STRUCTURE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => insertTag(tag)}
              disabled={isLocked}
              style={tagButtonStyle(isLocked)}
            >
              {tag}
            </button>
          ))}
        </div>
        <textarea
          ref={lyricsRef}
          value={params.lyrics}
          onChange={(event) => updateParam('lyrics', event.target.value)}
          disabled={isLocked}
          maxLength={lyricLimit}
          placeholder={
            coverMode === 'one-step'
              ? '可选。留空时会尽量从参考音频中提取歌词。'
              : '输入或编辑歌词，例如：[Verse]、[Chorus]。两步模式下建议补齐主歌和副歌。'
          }
          aria-label="歌词编辑器"
          style={textareaStyle(isLocked, 188)}
        />
        <FieldFooter
          hint={coverMode === 'one-step' ? '可选内容，适合只想保留参考曲旋律时留空。' : '建议至少 10 字，并用结构标签标记段落。'}
          current={params.lyrics.length}
          max={lyricLimit}
        />
      </Section>

      <div style={advancedShellStyle}>
        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          style={advancedToggleStyle}
          aria-expanded={showAdvanced}
        >
          <span style={toggleIconStyle}>{showAdvanced ? '-' : '+'}</span>
          高级设置
        </button>

        {showAdvanced && (
          <div style={advancedGridStyle}>
            <Field label="采样率">
              <select disabled={isLocked} style={selectStyle(isLocked)} defaultValue={44100}>
                <option value={44100}>44100 Hz，推荐</option>
                <option value={32000}>32000 Hz</option>
                <option value={24000}>24000 Hz</option>
                <option value={16000}>16000 Hz</option>
              </select>
            </Field>
            <Field label="比特率">
              <select disabled={isLocked} style={selectStyle(isLocked)} defaultValue={256000}>
                <option value={256000}>256 kbps，推荐</option>
                <option value={128000}>128 kbps</option>
                <option value={64000}>64 kbps</option>
                <option value={32000}>32 kbps</option>
              </select>
            </Field>
            <Field label="输出格式">
              <div style={formatGroupStyle}>
                {(['mp3', 'wav'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => updateParam('outputFormat', format)}
                    disabled={isLocked}
                    style={formatButtonStyle(params.outputFormat === format, isLocked)}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Seed">
              <input
                type="number"
                min={0}
                max={1000000}
                placeholder="可选，0-1000000"
                disabled={isLocked}
                style={inputStyle(isLocked)}
              />
            </Field>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        aria-label="生成音乐"
        style={generateButtonStyle(disabled || isGenerating)}
      >
        {isGenerating ? (
          <>
            <span style={spinnerStyle} />
            生成中...
          </>
        ) : (
          '生成音乐'
        )}
      </button>
    </div>
  );
}

function Section({
  title,
  description,
  required,
  children,
}: {
  title: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <label style={labelStyle}>
          {title}
          {required && <span style={requiredStyle}>*</span>}
        </label>
        {description && <p style={descriptionStyle}>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function FieldFooter({ hint, current, max }: { hint: string; current: number; max: number }) {
  const isNearLimit = current > max * 0.9;

  return (
    <div style={footerStyle}>
      <span>{hint}</span>
      <span style={{ color: isNearLimit ? '#ff7a66' : 'var(--hc-muted)' }}>{current}/{max}</span>
    </div>
  );
}

function ModeButton({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={modeButtonStyle(active)}>
      <span style={modeTitleStyle}>{title}</span>
      <span style={modeDetailStyle(active)}>{detail}</span>
    </button>
  );
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
};

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelStyle: CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.3,
};

const requiredStyle: CSSProperties = {
  color: 'var(--hc-coral)',
  marginLeft: 4,
};

const descriptionStyle: CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  lineHeight: 1.55,
  margin: 0,
};

const segmentStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  padding: 6,
  borderRadius: 14,
  border: '1px solid var(--hc-line)',
  background: 'rgba(255,255,255,0.04)',
};

const modeTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
};

function modeDetailStyle(active: boolean): CSSProperties {
  return {
    color: active ? 'rgba(14, 18, 18, 0.72)' : 'var(--hc-muted)',
    fontSize: 11,
    fontWeight: 700,
  };
}

function modeButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    minHeight: 54,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    border: active ? '1px solid rgba(208, 255, 90, 0.9)' : '1px solid transparent',
    borderRadius: 10,
    background: active ? 'var(--hc-lime)' : 'transparent',
    color: active ? '#0e1212' : 'var(--hc-text)',
    cursor: 'pointer',
    transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
  };
}

const tagGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

function tagButtonStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: 32,
    padding: '0 10px',
    borderRadius: 999,
    border: '1px solid var(--hc-line)',
    background: 'rgba(255,255,255,0.045)',
    color: 'var(--hc-text)',
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  };
}

function textareaStyle(disabled: boolean, minHeight: number): CSSProperties {
  return {
    width: '100%',
    minHeight,
    padding: '13px 14px',
    borderRadius: 12,
    border: '1px solid var(--hc-line)',
    background: disabled ? 'rgba(255,255,255,0.035)' : 'rgba(6,8,10,0.72)',
    color: 'var(--hc-text)',
    fontSize: 14,
    lineHeight: 1.65,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    opacity: disabled ? 0.58 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  };
}

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--hc-muted)',
  fontSize: 11,
  lineHeight: 1.5,
};

const advancedShellStyle: CSSProperties = {
  borderTop: '1px solid var(--hc-line)',
  paddingTop: 14,
};

const advancedToggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--hc-text)',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  padding: 0,
};

const toggleIconStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 20,
  height: 20,
  borderRadius: 999,
  border: '1px solid var(--hc-line)',
  color: 'var(--hc-lime)',
};

const advancedGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  marginTop: 14,
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  minWidth: 0,
};

const fieldLabelStyle: CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  fontWeight: 700,
};

function selectStyle(disabled: boolean): CSSProperties {
  return inputStyle(disabled);
}

function inputStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    minHeight: 40,
    padding: '0 12px',
    borderRadius: 10,
    border: '1px solid var(--hc-line)',
    background: disabled ? 'rgba(255,255,255,0.035)' : 'rgba(6,8,10,0.72)',
    color: 'var(--hc-text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const formatGroupStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
};

function formatButtonStyle(active: boolean, disabled: boolean): CSSProperties {
  return {
    minHeight: 40,
    borderRadius: 10,
    border: active ? '1px solid var(--hc-lime)' : '1px solid var(--hc-line)',
    background: active ? 'rgba(208,255,90,0.14)' : 'rgba(255,255,255,0.035)',
    color: active ? 'var(--hc-lime)' : 'var(--hc-text)',
    fontSize: 12,
    fontWeight: 900,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}

function generateButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    minHeight: 52,
    borderRadius: 12,
    border: disabled ? '1px solid var(--hc-line)' : '1px solid rgba(208,255,90,0.9)',
    background: disabled
      ? 'rgba(255,255,255,0.045)'
      : 'linear-gradient(135deg, var(--hc-lime), #73f7d7)',
    color: disabled ? 'var(--hc-muted)' : '#0e1212',
    fontSize: 15,
    fontWeight: 900,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 18px 50px rgba(208,255,90,0.18)',
  };
}

const spinnerStyle: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  border: '2px solid rgba(14,18,18,0.24)',
  borderTopColor: '#0e1212',
  animation: 'spin 0.8s linear infinite',
};
