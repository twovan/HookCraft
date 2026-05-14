'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  previewUrl?: string;
  coverUrl?: string;
  analysisStatus: string;
  price?: number;
  producerId?: string;
  producerName?: string;
}

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)',
  'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
  'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)',
  'linear-gradient(135deg, #3a1c71 0%, #d76d77 100%)',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

const GENRES = ['Pop', 'Rock', 'EDM', 'Jazz', 'Hip-Hop', 'Classical', 'Lo-Fi'];

export default function TemplatesPage() {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchTemplates() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/templates?tier=business');
        if (!res.ok) {
          setError('加载模板失败，请稍后重试');
          return;
        }
        const data = await res.json();
        setTemplates(data);
      } catch {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
    setCurrentPage(1);
  };

  // Filter templates by selected genres
  const filteredTemplates = (() => {
    let result = templates;
    
    // Genre filter
    if (selectedGenres.length > 0) {
      result = result.filter((t) =>
        selectedGenres.some((g) => t.genre.toLowerCase().includes(g.toLowerCase()))
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'price-low':
        result = [...result].sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        result = [...result].sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'popular':
        // Keep original order (API default)
        break;
      case 'newest':
      default:
        // Keep original order (API default is newest)
        break;
    }
    
    return result;
  })();

  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTemplates = filteredTemplates.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,165,116,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

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
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
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
              onClick={() => { setSelectedGenres([]); setCurrentPage(1); }}
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

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                <span style={{ color: '#999', fontSize: 15 }}>加载中...</span>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>🎵</div>
                <p style={{ color: '#999', fontSize: 15, marginBottom: 16 }}>{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '10px 24px', borderRadius: 24, border: 'none',
                    background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  重试
                </button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>🔍</div>
                <p style={{ color: '#999', fontSize: 15 }}>没有找到匹配的模板</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 48 }}>
                  {paginatedTemplates.map((t) => {
                    const gradient = getGradient(t.name);
                    const price = t.price ? Math.round(t.price / 100) : 0;
                    const tags = [t.category === 'free_template' ? '免费' : '付费', t.genre].filter(Boolean);

                    return (
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
                          {t.coverUrl && t.coverUrl.startsWith('http') ? (
                            <img src={t.coverUrl} alt={t.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: gradient }} />
                          )}
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
                          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: '#2D2D2D' }}>{t.name}</div>
                          {t.producerName && (
                            <div style={{ fontSize: 12, color: '#6B6B6B', marginBottom: 8 }}>
                              by <span style={{ color: '#D4A574', fontWeight: 500 }}>{t.producerName}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            {tags.map((tag) => (
                              <span key={tag} style={{ padding: '5px 14px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', borderRadius: 12 }}>{tag}</span>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 26, fontWeight: 700, color: '#D4A574', letterSpacing: -0.5 }}>
                              {price > 0 ? `￥${price}` : '免费'}
                            </div>
                            {price > 0 ? (
                              <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); addItem({ template_id: t.id, name: t.name, price: t.price || 0, cover_url: t.coverUrl || null, genre: t.genre, added_at: new Date().toISOString() }); }} style={{
                                padding: '8px 16px', borderRadius: 24, background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
                                color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              }}>加入购物车</span>
                            ) : (
                              <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/studio?templateId=${t.id}`); }} style={{
                                padding: '8px 16px', borderRadius: 24, background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
                                color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              }}>立即使用</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          width: 40, height: 40, borderRadius: 12, border: 'none',
                          background: safePage === page ? 'linear-gradient(135deg, #D4A574, #C9A86A)' : 'white',
                          color: safePage === page ? 'white' : '#6B6B6B',
                          fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
