'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import ProducerCard from '@/components/producer/ProducerCard';
import type { ProducerSummary } from '@/types/producer';

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  previewUrl?: string;
  coverUrl?: string;
  price?: number;
  salesCount?: number;
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
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export default function HomePage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredProducers, setFeaturedProducers] = useState<ProducerSummary[]>([]);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(Array.isArray(data) ? data : data.templates ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  useEffect(() => {
    async function fetchProducers() {
      try {
        const res = await fetch('/api/producers/featured');
        if (res.ok) {
          const data = await res.json();
          setFeaturedProducers(data.producers || []);
        }
      } catch {
        // Silently fail
      }
    }
    fetchProducers();
  }, []);

  // Split templates: first half = hot, second half = new
  const half = Math.ceil(templates.length / 2);
  const hotTemplates = templates.slice(0, half);
  const newTemplates = templates.slice(half);

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(117, 54, 213, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(117, 54, 213, 0.05) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero Banner */}
        <section style={{
          textAlign: 'center', padding: '80px 24px 90px',
          position: 'relative', overflow: 'hidden',
          backgroundImage: 'url(/banner_bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          {/* Dark overlay for text readability */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Logo icon */}
            <div style={{ marginBottom: 20 }}>
              <img src="/logo.svg" alt="" style={{ height: 48, opacity: 0.9 }} />
            </div>
            <h1 style={{
              fontSize: 48, fontWeight: 700, color: '#ffffff', marginBottom: 12,
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: 1, lineHeight: 1.2,
            }}>
              华语流行音乐的
              <br />
              AI Demo 创作与发布平台
            </h1>
            <p style={{
              fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 36,
              maxWidth: 500, margin: '0 auto 36px',
            }}>
              AI 驱动创作灵感 · 释放无限音乐可能
            </p>
            <Link href="/studio" style={{
              padding: '14px 36px', borderRadius: 24, border: 'none',
              background: 'rgba(117, 54, 213, 0.85)', color: 'white',
              fontSize: 16, fontWeight: 600, textDecoration: 'none',
              boxShadow: '0 6px 24px rgba(117, 54, 213, 0.4)',
              backdropFilter: 'blur(8px)',
            }}>
              ✦ 开始创作
            </Link>
          </div>
        </section>

        {/* 热门模板 */}
        <section style={{ maxWidth: 1400, margin: '0 auto', padding: '80px 48px 0' }}>
          <h2 style={{
            fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#e8e8f0',
            fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
            position: 'relative', display: 'inline-block',
          }}>
            热门模板
            <span style={{
              position: 'absolute', bottom: -12, left: 0, width: 60, height: 3,
              background: 'linear-gradient(90deg, #7536d5, transparent)', borderRadius: 2,
            }} />
          </h2>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>加载中...</div>
          ) : hotTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>暂无模板</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 48 }}>
              {hotTemplates.map((t) => (
                <TemplateCard key={t.id} template={t} hovered={hoveredCard === t.id} onHover={setHoveredCard} />
              ))}
            </div>
          )}
        </section>

        {/* 新品上架 */}
        {newTemplates.length > 0 && (
          <section style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 48px 80px' }}>
            <h2 style={{
              fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#e8e8f0',
              fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
              position: 'relative', display: 'inline-block',
            }}>
              新品上架
              <span style={{
                position: 'absolute', bottom: -12, left: 0, width: 60, height: 3,
                background: 'linear-gradient(90deg, #7536d5, transparent)', borderRadius: 2,
              }} />
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {newTemplates.map((t) => (
                <TemplateCard key={t.id} template={t} hovered={hoveredCard === t.id} onHover={setHoveredCard} />
              ))}
            </div>
          </section>
        )}

        {/* 推荐创作者 */}
        {featuredProducers.length > 0 && (
          <section style={{ maxWidth: 1400, margin: '0 auto', padding: '0 48px 80px' }}>
            <h2 style={{
              fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#e8e8f0',
              fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
              position: 'relative', display: 'inline-block',
            }}>
              推荐创作者
              <span style={{
                position: 'absolute', bottom: -12, left: 0, width: 60, height: 3,
                background: 'linear-gradient(90deg, #7536d5, transparent)', borderRadius: 2,
              }} />
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {featuredProducers.map((producer) => (
                <ProducerCard key={producer.id} producer={producer} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, hovered, onHover }: {
  template: TemplateItem;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const gradient = getGradient(template.name);
  const tags = [
    template.category === 'free_template' ? '免费' : '付费',
    template.genre,
  ].filter(Boolean);
  const price = template.price ? Math.round(template.price / 100) : 0;

  return (
    <Link
      href={`/templates/${template.id}`}
      style={{
        background: '#1a1a2e', borderRadius: 20, overflow: 'hidden',
        boxShadow: hovered ? '0 12px 40px rgba(117, 54, 213,0.25)' : '0 4px 20px rgba(117, 54, 213, 0.1)',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer', textDecoration: 'none', color: 'inherit',
        transform: hovered ? 'translateY(-8px) scale(1.02)' : 'none',
        display: 'block',
      }}
      onMouseEnter={() => onHover(template.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden' }}>
        {template.coverUrl ? (
          <Image src={template.coverUrl} alt={template.name} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 25vw" />
        ) : (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: gradient }} />
        )}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>▶</div>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: '#e8e8f0', lineHeight: 1.3 }}>
          {template.name}
        </div>
        {template.producerName && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
            by{' '}
            <Link
              href={`/producers/${template.producerId}`}
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#7536d5', textDecoration: 'none', fontWeight: 500 }}
            >
              {template.producerName}
            </Link>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {tags.map((tag) => (
            <span key={tag} style={{
              padding: '5px 14px', background: 'rgba(117, 54, 213, 0.15)', color: '#7536d5',
              fontSize: 11, fontWeight: 600, borderRadius: 12,
            }}>{tag}</span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#7536d5' }}>
            {price > 0 ? `￥${price}` : '免费'}
          </div>
          <Link href={`/studio?templateId=${template.id}`} onClick={(e) => e.stopPropagation()} style={{
            padding: '8px 16px', borderRadius: 24,
            background: 'linear-gradient(135deg, #7536d5, #5a2db8)', color: 'white',
            fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            使用模板
          </Link>
        </div>
      </div>
    </Link>
  );
}
