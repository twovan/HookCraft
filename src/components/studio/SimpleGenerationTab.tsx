'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SimpleGenerationTab() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('请输入生成描述');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/kie/simple-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, instrumental }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || '生成失败，请稍后重试');
        return;
      }

      router.push(data.creationUrl || `/account/creations?expand=${data.batchId}`);
    } catch {
      setError('生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section
      className="studio-card"
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: 24,
        borderRadius: 14,
        border: '1px solid var(--hc-border)',
        background: 'var(--hc-panel)',
        boxShadow: 'var(--hc-shadow-soft)',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            margin: '0 0 8px',
            color: 'var(--hc-text)',
            fontSize: 22,
            fontWeight: 900,
            fontFamily: 'var(--hc-font)',
          }}
        >
          简单模式
        </h2>
        <p
          style={{
            margin: 0,
            color: 'var(--hc-text-muted)',
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          输入一句创作描述，系统会自动完成风格、歌词与生成配置。
        </p>
      </div>

      <label
        htmlFor="simple-generation-prompt"
        style={{
          display: 'block',
          marginBottom: 8,
          color: 'var(--hc-text)',
          fontSize: 13,
          fontWeight: 800,
          fontFamily: 'var(--hc-font)',
        }}
      >
        生成描述
      </label>
      <textarea
        id="simple-generation-prompt"
        value={prompt}
        maxLength={500}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="例如：一首适合短视频开场的明亮流行歌，旋律轻快，有夏日感"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 150,
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid var(--hc-border)',
          background: '#0b0c10',
          color: 'var(--hc-text)',
          fontSize: 14,
          lineHeight: 1.7,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'var(--hc-font)',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 10,
          color: 'var(--hc-text-muted)',
          fontSize: 12,
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={instrumental}
            onChange={(event) => setInstrumental(event.target.checked)}
            style={{ accentColor: '#ceff35' }}
          />
          纯音乐
        </label>
        <span>{prompt.length}/500</span>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(229, 57, 53, 0.32)',
            background: 'rgba(229, 57, 53, 0.1)',
            color: '#ff8a80',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        style={{
          width: '100%',
          marginTop: 20,
          padding: '14px 24px',
          borderRadius: 999,
          border: 'none',
          background: isGenerating ? '#20222b' : '#ceff35',
          color: isGenerating ? 'var(--hc-text-weak)' : '#08090c',
          fontSize: 15,
          fontWeight: 900,
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--hc-font)',
          transition: 'all 0.2s ease',
        }}
      >
        {isGenerating ? '生成中...' : '开始生成'}
      </button>
    </section>
  );
}
