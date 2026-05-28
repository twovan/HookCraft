'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [category, setCategory] = useState('paid_template');
  const [price, setPrice] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirectTo=/upload');
    }
  }, [authLoading, user, router]);

  const resetForm = () => {
    setSuccess(false);
    setName('');
    setDescription('');
    setGenre('');
    setAudioFile(null);
    setAudioPreview(null);
    setCoverFile(null);
    setCoverPreview(null);
    setPrice(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入模板名称');
      return;
    }
    if (!audioFile) {
      setError('请上传音频文件');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description);
      formData.append('genre', genre);
      formData.append('category', category);
      formData.append('price', String(price));
      formData.append('audio', audioFile);
      if (coverFile) formData.append('cover', coverFile);

      const res = await fetch('/api/templates/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '上传失败' }));
        throw new Error(data.error);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="upload-page centered">
        <div className="state-card">
          <span>上传</span>
          <p>正在加载上传工作台...</p>
        </div>
        <UploadStyles />
      </main>
    );
  }

  if (success) {
    return (
      <main className="upload-page centered">
        <section className="success-card">
          <span>已提交审核</span>
          <h1>模板提交成功</h1>
          <p>你的模板已提交，管理员审核通过后会在平台上架。审核通常需要 1-3 个工作日。</p>
          <div className="action-row">
            <button onClick={resetForm} className="hc-button hc-button-primary">继续上传</button>
            <Link href="/templates" className="hc-button hc-button-ghost">浏览模板</Link>
          </div>
        </section>
        <UploadStyles />
      </main>
    );
  }

  return (
    <main className="upload-page">
      <div className="upload-shell">
        <header className="upload-header">
          <span>制作人上传</span>
          <h1>上传模板</h1>
          <p>分享你的音乐作品，审核通过后将在平台展示并可被创作者购买或使用。</p>
        </header>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit} className="upload-form">
          <section className="panel">
            <h2>音频文件 *</h2>
            {audioFile ? (
              <div className="selected-audio">
                <div>
                  <strong>{audioFile.name}</strong>
                  <span>{(audioFile.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAudioFile(null);
                    setAudioPreview(null);
                    if (audioInputRef.current) audioInputRef.current.value = '';
                  }}
                >
                  移除
                </button>
                {audioPreview && <audio controls src={audioPreview} />}
              </div>
            ) : (
              <div className="drop-zone" onClick={() => audioInputRef.current?.click()}>
                <span>音频</span>
                <strong>点击上传音频文件</strong>
                <p>支持 MP3、WAV、OGG、FLAC，最大 20MB。</p>
              </div>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,.mp3,.wav,.ogg,.flac"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setAudioFile(file);
                  setAudioPreview(URL.createObjectURL(file));
                }
              }}
              style={{ display: 'none' }}
            />
          </section>

          <section className="panel">
            <h2>模板信息</h2>
            <div className="field-stack">
              <Field label="模板名称 *">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="给你的模板起个名字" required />
              </Field>
              <Field label="描述">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述音乐风格、适用场景和亮点..." />
              </Field>
              <div className="two-col">
                <Field label="风格">
                  <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="如 Pop, Lo-Fi, EDM" />
                </Field>
                <Field label="分类">
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="free_template">免费模板</option>
                    <option value="paid_template">付费模板</option>
                  </select>
                </Field>
              </div>
              {category === 'paid_template' && (
                <Field label="价格（分）">
                  <input type="number" value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 0)} placeholder="如 9900 = ¥99" />
                  <small>以分为单位，9900 = ¥99。</small>
                </Field>
              )}
            </div>
          </section>

          <section className="panel cover-panel">
            <h2>封面图片（可选）</h2>
            <div className="cover-row">
              <div className="cover-preview">
                {coverPreview ? <img src={coverPreview} alt="封面预览" /> : <span>封面</span>}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setCoverFile(file);
                      setCoverPreview(URL.createObjectURL(file));
                    }
                  }}
                />
                <p>JPG、PNG、WebP，最大 5MB。</p>
              </div>
            </div>
          </section>

          <button type="submit" disabled={uploading || !name.trim() || !audioFile} className="submit-button">
            {uploading ? '上传中...' : '提交模板'}
          </button>
        </form>
      </div>
      <UploadStyles />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function UploadStyles() {
  return (
    <style>{`
      .upload-page {
        min-height: 100vh;
        background:
          radial-gradient(circle at 10% 12%, rgba(206,255,53,.10), transparent 300px),
          radial-gradient(circle at 88% 20%, rgba(82,214,198,.08), transparent 340px),
          var(--hc-bg);
        color: var(--hc-text);
        padding: 42px 22px 72px;
      }

      .upload-page.centered {
        display: grid;
        place-items: center;
      }

      .upload-shell {
        max-width: 820px;
        margin: 0 auto;
      }

      .upload-header {
        margin-bottom: 28px;
      }

      .upload-header span,
      .success-card span,
      .state-card span {
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .1em;
        text-transform: uppercase;
      }

      .upload-header h1,
      .success-card h1 {
        margin: 8px 0;
        font-size: clamp(40px, 6vw, 70px);
        line-height: 1;
      }

      .upload-header p,
      .success-card p,
      .state-card p,
      .drop-zone p,
      .cover-row p {
        color: var(--hc-muted);
        line-height: 1.7;
      }

      .upload-form {
        display: grid;
        gap: 18px;
      }

      .panel,
      .success-card,
      .state-card {
        border: 1px solid var(--hc-line);
        border-radius: var(--hc-radius-lg);
        background: rgba(24,26,34,.88);
        box-shadow: var(--hc-shadow);
      }

      .panel {
        padding: 24px;
      }

      .panel h2 {
        margin: 0 0 16px;
        font-size: 19px;
      }

      .drop-zone {
        border: 1px dashed rgba(206,255,53,.34);
        border-radius: var(--hc-radius);
        background: rgba(206,255,53,.06);
        padding: 38px 20px;
        text-align: center;
        cursor: pointer;
      }

        .drop-zone span,
        .cover-preview span {
          color: var(--hc-lime);
          font-size: 11px;
          font-weight: 950;
        }

      .drop-zone strong {
        display: block;
        margin: 8px 0 4px;
        font-size: 17px;
      }

      .selected-audio {
        display: grid;
        gap: 12px;
      }

        .selected-audio div:first-child {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          border: 1px solid rgba(206,255,53,.28);
        border-radius: 12px;
        background: rgba(206,255,53,.08);
        padding: 12px 14px;
      }

      .selected-audio span {
        color: var(--hc-muted);
      }

      .selected-audio button {
        width: fit-content;
        border: 1px solid var(--hc-line);
        border-radius: 999px;
        background: transparent;
        color: var(--hc-muted);
        padding: 7px 12px;
        cursor: pointer;
      }

      .field-stack {
        display: grid;
        gap: 16px;
      }

      .field {
        display: grid;
        gap: 7px;
      }

      .field span {
        color: var(--hc-text);
        font-size: 13px;
        font-weight: 900;
      }

      .field input,
      .field textarea,
      .field select {
        width: 100%;
        border: 1px solid var(--hc-line);
        border-radius: 12px;
        background: #0d0f14;
        color: var(--hc-text);
        padding: 12px 14px;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
      }

      .field textarea {
        min-height: 92px;
        resize: vertical;
      }

      .field small {
        color: var(--hc-muted);
        font-size: 11px;
      }

      .two-col {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

        .cover-row {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .cover-preview {
          width: 110px;
          height: 110px;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        border: 1px dashed rgba(206,255,53,.34);
        border-radius: 14px;
        background: rgba(206,255,53,.06);
        overflow: hidden;
      }

      .cover-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .submit-button {
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 16px 20px;
        background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
        color: #08090c;
        font-size: 16px;
        font-weight: 950;
        cursor: pointer;
      }

      .submit-button:disabled {
        cursor: not-allowed;
        opacity: .55;
      }

      .error-box {
        border: 1px solid rgba(255,90,61,.34);
        border-radius: 12px;
        background: rgba(255,90,61,.1);
        color: #ff8b76;
        padding: 12px 14px;
        font-size: 14px;
        font-weight: 800;
      }

      .success-card,
      .state-card {
        width: min(560px, calc(100vw - 40px));
        padding: 34px;
        text-align: center;
      }

      .action-row {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 24px;
      }

      @media (max-width: 640px) {
        .upload-page {
          padding: 28px 14px 56px;
        }

        .cover-row input {
          max-width: 100%;
          color: var(--hc-muted);
        }

        .two-col,
        .cover-row {
          grid-template-columns: 1fr;
        }

        .cover-row {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `}</style>
  );
}
