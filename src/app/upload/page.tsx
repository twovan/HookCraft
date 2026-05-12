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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('请输入模板名称'); return; }
    if (!audioFile) { setError('请上传音频文件'); return; }

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
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#999', fontSize: 14 }}>加载中...</span>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D', marginBottom: 12, fontFamily: "'Playfair Display', serif" }}>
            模板提交成功
          </h1>
          <p style={{ color: '#6B6B6B', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
            你的模板已提交，管理员审核通过后将在平台上架。审核通常需要 1-3 个工作日。
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button
              onClick={() => { setSuccess(false); setName(''); setDescription(''); setGenre(''); setAudioFile(null); setAudioPreview(null); setCoverFile(null); setCoverPreview(null); setPrice(0); }}
              style={primaryBtnStyle}
            >
              继续上传
            </button>
            <Link href="/templates" style={{ ...secondaryBtnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              浏览模板
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%)', pointerEvents: 'none', zIndex: 0 }} />

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#2D2D2D', marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>
          上传模板
        </h1>
        <p style={{ color: '#6B6B6B', fontSize: 15, marginBottom: 40 }}>
          分享你的音乐作品，审核通过后将在平台展示
        </p>

        {error && (
          <div style={{ padding: '12px 16px', marginBottom: 20, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Audio Upload - Primary */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>🎵 音频文件 *</h3>
            {audioFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F5E6D3', borderRadius: 12 }}>
                  <span style={{ fontSize: 14, color: '#2D2D2D', fontWeight: 500 }}>🎵 {audioFile.name}</span>
                  <button type="button" onClick={() => { setAudioFile(null); setAudioPreview(null); if (audioInputRef.current) audioInputRef.current.value = ''; }} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                {audioPreview && <audio controls src={audioPreview} style={{ width: '100%', height: 40 }} />}
              </div>
            ) : (
              <div
                onClick={() => audioInputRef.current?.click()}
                style={{ border: '2px dashed #E5E5E5', borderRadius: 16, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#D4A574'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E5E5E5'}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎶</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D', marginBottom: 4 }}>点击上传音频文件</div>
                <div style={{ fontSize: 13, color: '#999' }}>支持 MP3、WAV、OGG、FLAC，最大 20MB</div>
              </div>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,.mp3,.wav,.ogg,.flac"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setAudioFile(file); setAudioPreview(URL.createObjectURL(file)); }
              }}
              style={{ display: 'none' }}
            />
          </div>

          {/* Template Info */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>📝 模板信息</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>模板名称 *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="给你的模板起个名字" style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>描述</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述你的音乐风格、适用场景..." style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>风格</label>
                  <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="如: Pop, Lo-Fi, EDM" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>分类</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                    <option value="free_template">免费模板</option>
                    <option value="paid_template">付费模板</option>
                  </select>
                </div>
              </div>
              {category === 'paid_template' && (
                <div>
                  <label style={labelStyle}>价格（分）</label>
                  <input type="number" value={price} onChange={(e) => setPrice(parseInt(e.target.value) || 0)} placeholder="如: 9900 = ¥99" style={inputStyle} />
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>以分为单位，9900 = ¥99</div>
                </div>
              )}
            </div>
          </div>

          {/* Cover Image */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>🖼️ 封面图片（可选）</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 100, height: 100, borderRadius: 12, overflow: 'hidden', flexShrink: 0, border: '2px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', background: coverPreview ? undefined : '#fafafa' }}>
                {coverPreview ? (
                  <img src={coverPreview} alt="封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, color: '#d1d5db' }}>🖼️</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
                  }}
                  style={{ fontSize: 12 }}
                />
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>JPG、PNG、WebP，最大 5MB</div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={uploading || !name.trim() || !audioFile} style={{ ...primaryBtnStyle, width: '100%', padding: 16, fontSize: 16, opacity: uploading || !name.trim() || !audioFile ? 0.6 : 1, cursor: uploading || !name.trim() || !audioFile ? 'not-allowed' : 'pointer' }}>
            {uploading ? '上传中...' : '提交模板'}
          </button>
        </form>
      </main>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'white', padding: 28, borderRadius: 20, marginBottom: 20,
  boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
};
const sectionTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#2D2D2D', marginBottom: 16 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#2D2D2D', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E5E5E5', fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none', boxSizing: 'border-box' };
const primaryBtnStyle: React.CSSProperties = { padding: '12px 28px', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", boxShadow: '0 6px 20px rgba(212,165,116,0.3)' };
const secondaryBtnStyle: React.CSSProperties = { padding: '12px 28px', borderRadius: 24, border: '1px solid #E5E5E5', background: 'transparent', color: '#6B6B6B', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
