'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCartStore } from '@/store/cartStore';

interface TemplateDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  previewUrl?: string;
  coverUrl?: string;
  analysisResult?: string;
  analysisStatus: string;
  price?: number;
  salesCount?: number;
  producerId?: string;
  producerName?: string;
  producerAvatarUrl?: string;
}

interface RelatedTemplate {
  id: string;
  name: string;
  category: string;
  genre: string;
  price?: number;
}

// 根据模板名称生成一个稳定的渐变色
function getGradient(name: string): string {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)',
    'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const addItem = useCartStore((s) => s.addItem);
  const hasItem = useCartStore((s) => s.hasItem);

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [related, setRelated] = useState<RelatedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredRelated, setHoveredRelated] = useState<string | null>(null);
  const [isPurchased, setIsPurchased] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplate() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('模板不存在');
          } else {
            setError('加载失败，请重试');
          }
          return;
        }
        const data = await res.json();
        setTemplate(data.template);
        setRelated(data.related || []);
      } catch {
        setError('网络错误，请重试');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchTemplate();
  }, [id]);

  // Check if user has purchased this template
  useEffect(() => {
    async function checkPurchased() {
      if (!user || !id) return;
      try {
        const res = await fetch('/api/templates/purchased');
        if (res.ok) {
          const data = await res.json();
          const purchased = (data.templates || []).some(
            (t: { id: string }) => t.id === id
          );
          setIsPurchased(purchased);
        }
      } catch {
        // Silently fail
      }
    }
    checkPurchased();
  }, [user, id]);

  const handlePurchase = async () => {
    if (!user) {
      router.push(`/login?redirectTo=/templates/${id}`);
      return;
    }
    setPurchasing(true);
    setPurchaseMessage(null);
    try {
      const res = await fetch(`/api/templates/${id}/purchase`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIsPurchased(true);
        setPurchaseMessage('购买成功！');
        setTimeout(() => setPurchaseMessage(null), 3000);
      } else {
        setPurchaseMessage(data.error || '购买失败');
        setTimeout(() => setPurchaseMessage(null), 3000);
      }
    } catch {
      setPurchaseMessage('网络错误，请重试');
      setTimeout(() => setPurchaseMessage(null), 3000);
    } finally {
      setPurchasing(false);
    }
  };

  const handleAddToCart = () => {
    if (!template) return;
    const result = addItem({
      template_id: template.id,
      name: template.name,
      price: template.price || 0,
      cover_url: template.coverUrl || null,
      genre: template.genre,
      added_at: new Date().toISOString(),
    });
    setCartMessage(result.message || null);
    setTimeout(() => setCartMessage(null), 3000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#999', fontSize: 14 }}>加载中...</span>
      </div>
    );
  }

  const retryFetch = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/templates/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) setError('模板不存在');
          else setError('加载失败，请重试');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setTemplate(data.template);
          setRelated(data.related || []);
        }
      })
      .catch(() => setError('网络错误，请重试'))
      .finally(() => setLoading(false));
  };

  if (error || !template) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span style={{ fontSize: 48 }}>🎵</span>
        <span style={{ color: '#999', fontSize: 16 }}>{error || '模板不存在'}</span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button
            onClick={retryFetch}
            style={{
              padding: '10px 24px', borderRadius: 24, border: 'none',
              background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            重试
          </button>
          <Link href="/templates" style={{ color: '#D4A574', textDecoration: 'none', fontWeight: 600 }}>← 返回模板列表</Link>
        </div>
      </div>
    );
  }

  const gradient = getGradient(template.name);
  const tags = [template.category === 'free_template' ? '免费' : '付费', template.genre].filter(Boolean);
  const price = template.price ? Math.round(template.price / 100) : 0;
  const isPaidTemplate = template.category === 'paid_template' && price > 0;
  const inCart = hasItem(template.id);

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,165,116,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 48, position: 'relative', zIndex: 1 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>首页</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <Link href="/templates" style={{ color: '#999', textDecoration: 'none' }}>模板列表</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <span style={{ color: '#2D2D2D', fontWeight: 500 }}>{template.name}</span>
        </nav>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          {/* Left - Cover + Player */}
          <div style={{ position: 'sticky', top: 140, height: 'fit-content' }}>
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 24, overflow: 'hidden',
              marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', position: 'relative',
            }}>
              {template.coverUrl ? (
                <Image src={template.coverUrl} alt={template.name} fill style={{ objectFit: 'cover' }} sizes="50vw" />
              ) : (
                <div style={{ width: '100%', height: '100%', background: gradient }} />
              )}
            </div>

            {/* Audio Player */}
            <div style={{
              background: 'white', padding: 28, borderRadius: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
            }}>
              <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>试听播放器</h3>
              {template.previewUrl ? (
                <>
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
                  <audio
                    controls
                    src={template.previewUrl}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    style={{ width: '100%', height: 40 }}
                  />
                </>
              ) : (
                <div style={{
                  background: '#F5E6D3', height: 120, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 8,
                }}>
                  <span style={{ fontSize: 32, opacity: 0.5 }}>🎵</span>
                  <span style={{ fontSize: 13, color: '#999' }}>暂无试听音频</span>
                </div>
              )}
            </div>
          </div>

          {/* Right - Details */}
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16, fontFamily: "'Playfair Display', serif", color: '#2D2D2D' }}>
              {template.name}
            </h1>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {tags.map((tag) => (
                <span key={tag} style={{ padding: '5px 14px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, borderRadius: 12 }}>{tag}</span>
              ))}
            </div>

            {/* Description */}
            <div style={{ background: 'white', padding: 24, borderRadius: 16, marginBottom: 24 }}>
              <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>描述</h3>
              <p style={{ color: '#6B6B6B', lineHeight: 1.8, margin: 0 }}>{template.description}</p>
            </div>

            {/* Analysis Result */}
            {template.analysisResult && (
              <div style={{ background: 'white', padding: 24, borderRadius: 16, marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>AI 分析结果</h3>
                <p style={{ color: '#6B6B6B', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{template.analysisResult}</p>
              </div>
            )}

            {/* Template Info */}
            <div style={{
              background: 'white', padding: 28, borderRadius: 20, marginBottom: 24,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
            }}>
              <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>模板信息</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 12, background: '#FDFBF7', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>风格</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2D2D' }}>{template.genre}</div>
                </div>
                <div style={{ padding: 12, background: '#FDFBF7', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>分类</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2D2D' }}>{template.category === 'free_template' ? '免费模板' : '付费模板'}</div>
                </div>
                <div style={{ padding: 12, background: '#FDFBF7', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>分析状态</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: template.analysisStatus === 'completed' ? '#22c55e' : '#f59e0b' }}>
                    {template.analysisStatus === 'completed' ? '已分析' : template.analysisStatus === 'analyzing' ? '分析中' : '待分析'}
                  </div>
                </div>
                <div style={{ padding: 12, background: '#FDFBF7', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>销量</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2D2D' }}>{template.salesCount || 0}</div>
                </div>
              </div>
            </div>

            {/* Producer Info */}
            {template.producerId && template.producerName && (
              <div style={{
                background: 'white', padding: 20, borderRadius: 20, marginBottom: 24,
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
              }}>
                <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#2D2D2D' }}>制作人</h3>
                <Link
                  href={`/producers/${template.producerId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textDecoration: 'none',
                    color: 'inherit',
                    padding: 8,
                    borderRadius: 12,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: template.producerAvatarUrl
                      ? `url(${template.producerAvatarUrl}) center/cover`
                      : 'linear-gradient(135deg, #D4A574, #C9A86A)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: 'white',
                    flexShrink: 0,
                  }}>
                    {!template.producerAvatarUrl && template.producerName.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#2D2D2D' }}>
                      {template.producerName}
                    </div>
                    <div style={{ fontSize: 12, color: '#D4A574' }}>查看主页 →</div>
                  </div>
                </Link>
              </div>
            )}

            {/* Price + Actions */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'white', padding: 24, borderRadius: 16, flexWrap: 'wrap', gap: 12,
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#D4A574' }}>
                {price > 0 ? `￥${price}` : '免费'}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {isPaidTemplate && !isPurchased ? (
                  <>
                    <button
                      onClick={handlePurchase}
                      disabled={purchasing}
                      style={{
                        padding: '12px 28px', borderRadius: 24, border: 'none',
                        background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
                        fontSize: 14, fontWeight: 600, cursor: purchasing ? 'not-allowed' : 'pointer',
                        fontFamily: "'Inter', sans-serif",
                        opacity: purchasing ? 0.7 : 1,
                      }}
                    >
                      {purchasing ? '购买中...' : '购买模板'}
                    </button>
                    <button
                      onClick={handleAddToCart}
                      disabled={inCart}
                      style={{
                        padding: '12px 28px', borderRadius: 24,
                        border: '1px solid #D4A574',
                        background: 'transparent', color: '#D4A574',
                        fontSize: 14, fontWeight: 600,
                        cursor: inCart ? 'not-allowed' : 'pointer',
                        fontFamily: "'Inter', sans-serif",
                        opacity: inCart ? 0.6 : 1,
                      }}
                    >
                      {inCart ? '已在购物车' : '加入购物车'}
                    </button>
                  </>
                ) : (
                  <Link href={`/studio?templateId=${template.id}`} style={{
                    padding: '12px 28px', borderRadius: 24, border: 'none',
                    background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
                    fontSize: 14, fontWeight: 600, textDecoration: 'none',
                    display: 'flex', alignItems: 'center',
                  }}>
                    使用此模板创作
                  </Link>
                )}
              </div>
            </div>

            {/* Purchase/Cart message */}
            {(purchaseMessage || cartMessage) && (
              <div style={{
                marginTop: 12, padding: '10px 16px', borderRadius: 12,
                background: (purchaseMessage === '购买成功！' || cartMessage?.includes('已加入'))
                  ? '#f0fdf4' : '#fef2f2',
                color: (purchaseMessage === '购买成功！' || cartMessage?.includes('已加入'))
                  ? '#16a34a' : '#dc2626',
                fontSize: 14, fontWeight: 500,
              }}>
                {purchaseMessage || cartMessage}
              </div>
            )}
          </div>
        </div>

        {/* Related Templates */}
        {related.length > 0 && (
          <section style={{ marginTop: 64 }}>
            <h2 style={{
              fontSize: 24, fontWeight: 700, marginBottom: 32, color: '#2D2D2D',
              fontFamily: "'Playfair Display', serif", position: 'relative', display: 'inline-block',
            }}>
              更多模板
              <span style={{ position: 'absolute', bottom: -12, left: 0, width: 60, height: 3, background: 'linear-gradient(90deg, #D4A574, transparent)', borderRadius: 2 }} />
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {related.map((r) => (
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
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: getGradient(r.name) }} />
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#2D2D2D' }}>{r.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <span style={{ padding: '3px 10px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, borderRadius: 10 }}>{r.genre}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#D4A574' }}>
                      {r.price && r.price > 0 ? `￥${Math.round(r.price / 100)}` : '免费'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
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
