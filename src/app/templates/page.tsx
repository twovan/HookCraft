'use client';

import Link from 'next/link';
import { useState } from 'react';

const ALL_TEMPLATES = [
  { id: '1', title: 'Epic Battle Theme', tags: ['游戏音乐', 'RPG'], producer: '张三', price: 99, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: '2', title: 'Urban Vibes', tags: ['短视频', 'Lo-fi'], producer: '李四', price: 79, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: '3', title: 'Pop Sensation', tags: ['流行歌曲', 'Pop'], producer: '王五', price: 149, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: '4', title: 'Cinematic Score', tags: ['广告', 'Cinematic'], producer: '赵六', price: 129, gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: '5', title: 'Neon Dreams', tags: ['电子', 'EDM'], producer: '陈七', price: 119, gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: '6', title: 'Jazz Café', tags: ['爵士', 'Jazz'], producer: '周八', price: 89, gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: '7', title: 'Dark Dungeon', tags: ['游戏音乐', 'RPG'], producer: '张三', price: 89, gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)' },
  { id: '8', title: 'Summer Pop', tags: ['流行', 'Pop'], producer: '王五', price: 109, gradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' },
  { id: '9', title: 'Lo-Fi Study', tags: ['Lo-Fi', 'Chill'], producer: '李四', price: 69, gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
  { id: '10', title: 'Classical Piano', tags: ['古典', 'Classical'], producer: '孙九', price: 159, gradient: 'linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)' },
  { id: '11', title: 'Hip-Hop Beat', tags: ['嘻哈', 'Hip-Hop'], producer: '周八', price: 99, gradient: 'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)' },
  { id: '12', title: 'Rock Anthem', tags: ['摇滚', 'Rock'], producer: '赵六', price: 139, gradient: 'linear-gradient(135deg, #3a1c71 0%, #d76d77 100%)' },
];

const GENRES = ['Pop', 'Rock', 'EDM', 'Jazz', 'Hip-Hop', 'Classical', 'Lo-Fi'];

const navLinkStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: '#6B6B6B',
  textDecoration: 'none',
};

export default function TemplatesPage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

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
        padding: '0 48px',
        boxShadow: '0 2px 20px rgba(212,165,116,0.08)',
      }}>
        <Link href="/" style={{ fontSize: 32, fontWeight: 700, color: '#D4A574', fontFamily: "'Playfair Display', serif", letterSpacing: -0.5, textDecoration: 'none' }}>
          HookCraft
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <input type="text" placeholder="搜索模板..." style={{
            width: 320, padding: '11px 18px', border: '1px solid #E5E5E5', borderRadius: 24,
            fontSize: 14, background: '#FDFBF7', fontFamily: "'Inter', sans-serif", outline: 'none',
          }} />
          <Link href="/studio" style={navLinkStyle}>AI 创作</Link>
          <Link href="/pricing" style={navLinkStyle}>定价</Link>
          <Link href="/account" style={navLinkStyle}>账户</Link>
          <Link href="/cart" style={{ position: 'relative', fontSize: 24, textDecoration: 'none' }}>
            🛒<span style={{ position: 'absolute', top: -8, right: -8, background: '#D4A574', color: 'white', fontSize: 12, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 48px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 32 }}>
          {/* Filter Sidebar */}
          <aside style={{
            background: 'white', padding: 28, borderRadius: 20, height: 'fit-content',
            position: 'sticky', top: 140,
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
          }}>
            {/* Genre */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#2D2D2D', letterSpacing: 0.3, textTransform: 'uppercase' }}>风格</h3>
              {GENRES.map((genre) => (
                <label key={genre} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(genre)}
                    onChange={() => toggleGenre(genre)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 500, color: selectedGenres.includes(genre) ? '#D4A574' : '#2D2D2D', letterSpacing: 0.1 }}>{genre}</span>
                </label>
              ))}
            </div>

            {/* BPM Range */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#2D2D2D', letterSpacing: 0.3, textTransform: 'uppercase' }}>BPM 范围</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" placeholder="60" style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
                  fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none',
                }} />
                <span style={{ color: '#999' }}>-</span>
                <input type="number" placeholder="200" style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
                  fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none',
                }} />
              </div>
            </div>

            {/* Price Range */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#2D2D2D', letterSpacing: 0.3, textTransform: 'uppercase' }}>价格范围</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" placeholder="¥0" style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
                  fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none',
                }} />
                <span style={{ color: '#999' }}>-</span>
                <input type="number" placeholder="¥500" style={{
                  width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
                  fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none',
                }} />
              </div>
            </div>

            {/* Sort */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: '#2D2D2D', letterSpacing: 0.3, textTransform: 'uppercase' }}>排序</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
                  fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="newest">最新上架</option>
                <option value="popular">最受欢迎</option>
                <option value="price-low">价格：低到高</option>
                <option value="price-high">价格：高到低</option>
              </select>
            </div>

            <button
              onClick={() => setSelectedGenres([])}
              style={{
                width: '100%', padding: '12px 28px', border: '1px solid #E5E5E5', borderRadius: 24,
                background: 'transparent', color: '#6B6B6B', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
              }}
            >
              清除筛选
            </button>
          </aside>

          {/* Template Grid */}
          <div>
            <h2 style={{
              fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#2D2D2D',
              fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
              position: 'relative', display: 'inline-block',
            }}>
              所有模板
              <span style={{
                position: 'absolute', bottom: -12, left: 0, width: 60, height: 3,
                background: 'linear-gradient(90deg, #D4A574, transparent)', borderRadius: 2,
              }} />
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 48 }}>
              {ALL_TEMPLATES.map((t) => (
                <Link
                  key={t.id}
                  href={`/templates/${t.id}`}
                  style={{
                    background: 'white', borderRadius: 20, overflow: 'hidden',
                    boxShadow: hoveredCard === t.id ? '0 12px 40px rgba(212,165,116,0.25)' : '0 4px 20px rgba(0,0,0,0.06)',
                    transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    cursor: 'pointer', textDecoration: 'none', color: 'inherit',
                    transform: hoveredCard === t.id ? 'translateY(-8px) scale(1.02)' : 'none',
                    display: 'block',
                  }}
                  onMouseEnter={() => setHoveredCard(t.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: t.gradient }} />
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: hoveredCard === t.id ? 1 : 0, transition: 'opacity 0.3s',
                    }}>
                      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>▶</div>
                    </div>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: '#2D2D2D' }}>{t.title}</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {t.tags.map((tag) => (
                        <span key={tag} style={{ padding: '5px 14px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', borderRadius: 12 }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ color: '#6B6B6B', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>👤 {t.producer}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: '#D4A574', letterSpacing: -0.5 }}>￥{t.price}</div>
                      <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{
                        padding: '8px 16px', borderRadius: 24, background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
                        color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>加入购物车</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    width: 40, height: 40, borderRadius: 12, border: 'none',
                    background: currentPage === page ? 'linear-gradient(135deg, #D4A574, #C9A86A)' : 'white',
                    color: currentPage === page ? 'white' : '#6B6B6B',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
