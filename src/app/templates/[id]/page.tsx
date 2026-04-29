'use client';

import Link from 'next/link';
import { useState } from 'react';

const MOCK_TEMPLATE = {
  id: '1',
  title: 'Epic Battle Theme',
  tags: ['游戏音乐', 'RPG', '史诗', '战斗'],
  producer: { name: '张三', bio: '专注游戏音乐制作', templates: 20, sales: '500+' },
  price: 99,
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  description: '这是一首适合 RPG 游戏的史诗战斗音乐，采用管弦乐编排，营造出紧张激烈的战斗氛围。适合用于游戏的 Boss 战、重要战役场景等。',
  files: [
    { name: '🎵 DAW工程 (.flp)', desc: '50MB - FL Studio 工程文件' },
    { name: '🎧 分轨 (.wav)', desc: '200MB - 所有乐器分轨' },
    { name: '🎹 MIDI (.mid)', desc: '5MB - MIDI 文件' },
    { name: '📄 结构图 (.pdf)', desc: '2MB - 音乐结构图' },
  ],
};

const RELATED = [
  { id: '7', title: 'Mystic Forest', tags: ['游戏音乐', 'Orchestral'], producer: '张三', price: 129, gradient: 'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)' },
  { id: '4', title: 'Cinematic Trailer', tags: ['广告', 'Cinematic'], producer: '赵六', price: 199, gradient: 'linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)' },
  { id: '8', title: 'Dark Dungeon', tags: ['游戏音乐', 'RPG'], producer: '张三', price: 89, gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)' },
  { id: '5', title: 'Neon Dreams', tags: ['电子', 'EDM'], producer: '陈七', price: 119, gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
];

const navLinkStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: '#6B6B6B', textDecoration: 'none',
};

export default function TemplateDetailPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredRelated, setHoveredRelated] = useState<string | null>(null);
  const t = MOCK_TEMPLATE;

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,165,116,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, height: 70, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212,165,116,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', boxShadow: '0 2px 20px rgba(212,165,116,0.08)',
      }}>
        <Link href="/" style={{ fontSize: 32, fontWeight: 700, color: '#D4A574', fontFamily: "'Playfair Display', serif", letterSpacing: -0.5, textDecoration: 'none' }}>HookCraft</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <input type="text" placeholder="搜索模板..." style={{ width: 320, padding: '11px 18px', border: '1px solid #E5E5E5', borderRadius: 24, fontSize: 14, background: '#FDFBF7', fontFamily: "'Inter', sans-serif", outline: 'none' }} />
          <Link href="/studio" style={navLinkStyle}>AI 创作</Link>
          <Link href="/pricing" style={navLinkStyle}>定价</Link>
          <Link href="/cart" style={{ position: 'relative', fontSize: 24, textDecoration: 'none' }}>
            🛒<span style={{ position: 'absolute', top: -8, right: -8, background: '#D4A574', color: 'white', fontSize: 12, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 48, position: 'relative', zIndex: 1 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>首页</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <Link href="/templates" style={{ color: '#999', textDecoration: 'none' }}>模板列表</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <span style={{ color: '#2D2D2D', fontWeight: 500 }}>{t.title}</span>
        </nav>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          {/* Left - Cover + Player */}
          <div style={{ position: 'sticky', top: 140, height: 'fit-content' }}>
            {/* Cover */}
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 24, overflow: 'hidden',
              marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', position: 'relative',
            }}>
              <div style={{ width: '100%', height: '100%', background: t.gradient }} />
            </div>

            {/* Audio Player */}
            <div style={{
              background: 'white', padding: 28, borderRadius: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
            }}>
              <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>试听播放器</h3>

              {/* Waveform */}
              <div style={{
                background: '#F5E6D3', height: 80, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                padding: '0 20px', marginBottom: 16, overflow: 'hidden',
              }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} style={{
                    width: 4, height: 60, borderRadius: 2,
                    background: 'linear-gradient(180deg, #D4A574 0%, #C9A86A 100%)',
                    transformOrigin: 'bottom center',
                    animation: isPlaying ? `wave 1.2s ease-in-out ${i * 0.1}s infinite` : 'none',
                    transform: isPlaying ? undefined : `scaleY(${0.2 + Math.random() * 0.8})`,
                  }} />
                ))}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', background: 'white',
                    border: 'none', fontSize: 20, cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <div style={{ flex: 1, height: 4, background: '#E5E5E5', borderRadius: 2, position: 'relative' }}>
                  <div style={{ width: '35%', height: '100%', background: '#D4A574', borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#6B6B6B' }}>
                <span>1:23</span>
                <span>3:45</span>
              </div>
            </div>
          </div>

          {/* Right - Details */}
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, fontFamily: "'Playfair Display', serif", color: '#2D2D2D' }}>{t.title}</h1>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {t.tags.map((tag) => (
                <span key={tag} style={{ padding: '5px 14px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', borderRadius: 12 }}>{tag}</span>
              ))}
            </div>

            {/* Producer Card */}
            <div style={{
              background: 'white', padding: 28, borderRadius: 20, marginBottom: 24,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#D4A574', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24, fontWeight: 700 }}>
                  {t.producer.name[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2D2D2D', margin: 0 }}>{t.producer.name}</h3>
                  <p style={{ color: '#6B6B6B', fontSize: 14, margin: '4px 0 0' }}>{t.producer.bio}</p>
                  <p style={{ color: '#6B6B6B', fontSize: 12, margin: '4px 0 0' }}>{t.producer.templates} 个模板 | {t.producer.sales} 销量</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ background: 'white', padding: 24, borderRadius: 16, marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>描述</h3>
              <p style={{ color: '#6B6B6B', lineHeight: 1.8, margin: 0 }}>{t.description}</p>
            </div>

            {/* File List */}
            <div style={{
              background: 'white', padding: 28, borderRadius: 20, marginBottom: 24,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
            }}>
              <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>文件内容</h3>
              {t.files.map((file, i) => (
                <div key={i} style={{
                  padding: 16,
                  borderBottom: i < t.files.length - 1 ? '1px solid rgba(245,230,211,0.5)' : 'none',
                }}>
                  <div style={{ fontWeight: 600, color: '#2D2D2D' }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 4 }}>{file.desc}</div>
                </div>
              ))}
            </div>

            {/* Price + Actions */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'white', padding: 24, borderRadius: 16,
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#D4A574', letterSpacing: -0.5 }}>￥{t.price}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <button style={{
                  padding: '12px 28px', border: '1px solid #E5E5E5', borderRadius: 24,
                  background: 'transparent', color: '#6B6B6B', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}>
                  加入购物车
                </button>
                <Link href="/checkout" style={{
                  padding: '12px 28px', borderRadius: 24, border: 'none',
                  background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  display: 'flex', alignItems: 'center',
                }}>
                  立即购买
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        <section style={{ marginTop: 64 }}>
          <h2 style={{
            fontSize: 24, fontWeight: 700, marginBottom: 32, color: '#2D2D2D',
            fontFamily: "'Playfair Display', serif", position: 'relative', display: 'inline-block',
          }}>
            相关推荐
            <span style={{ position: 'absolute', bottom: -12, left: 0, width: 60, height: 3, background: 'linear-gradient(90deg, #D4A574, transparent)', borderRadius: 2 }} />
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {RELATED.map((r) => (
              <Link
                key={r.id}
                href={`/templates/${r.id}`}
                style={{
                  background: 'white', borderRadius: 20, overflow: 'hidden',
                  boxShadow: hoveredRelated === r.id ? '0 12px 40px rgba(212,165,116,0.25)' : '0 4px 20px rgba(0,0,0,0.06)',
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  cursor: 'pointer', textDecoration: 'none', color: 'inherit',
                  transform: hoveredRelated === r.id ? 'translateY(-8px) scale(1.02)' : 'none',
                  display: 'block',
                }}
                onMouseEnter={() => setHoveredRelated(r.id)}
                onMouseLeave={() => setHoveredRelated(null)}
              >
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: r.gradient }} />
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: hoveredRelated === r.id ? 1 : 0, transition: 'opacity 0.3s',
                  }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>▶</div>
                  </div>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: '#2D2D2D' }}>{r.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {r.tags.map((tag) => (
                      <span key={tag} style={{ padding: '5px 14px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, borderRadius: 12 }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ color: '#6B6B6B', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>👤 {r.producer}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#D4A574' }}>￥{r.price}</div>
                    <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{
                      padding: '8px 16px', borderRadius: 24, background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
                      color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>加入购物车</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.33); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
