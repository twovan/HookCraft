'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { ProducerProfile } from '@/types/producer';

interface TemplateItem {
  id: string;
  name: string;
  genre: string;
  genreTags?: string[];
  category: string;
  coverUrl?: string;
  previewUrl?: string;
  price?: number;
  salesCount?: number;
}

const gradients = [
  'linear-gradient(135deg, #ceff35 0%, #52d6c6 48%, #15181f 100%)',
  'linear-gradient(135deg, #ff5a3d 0%, #f5c542 44%, #15181f 100%)',
  'linear-gradient(135deg, #52d6c6 0%, #8b5cf6 48%, #15181f 100%)',
  'linear-gradient(135deg, #f5c542 0%, #ceff35 42%, #15181f 100%)',
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeout = 10000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function ProducerProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [producer, setProducer] = useState<ProducerProfile | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'other'>('templates');

  useEffect(() => {
    fetchProducer();
    fetchTemplates();
  }, [id]);

  useEffect(() => {
    fetchTemplates();
  }, [selectedGenre]);

  const fetchProducer = async () => {
    setLoading(true);
    try {
      const res = await fetchWithTimeout(`/api/producers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProducer(data.producer);
      } else {
        setError('制作人不存在');
      }
    } catch {
      setError('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const query = new URLSearchParams();
      if (selectedGenre) query.set('genre', selectedGenre);
      const res = await fetchWithTimeout(`/api/producers/${id}/templates?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      setTemplates([]);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <main className="producer-page centered">
        <StateCard title="正在加载制作人..." />
        <ProducerStyles />
      </main>
    );
  }

  if (error || !producer) {
    return (
      <main className="producer-page centered">
        <section className="state-card">
          <span>制作人暂不可用</span>
          <h1>{error || '制作人不存在'}</h1>
          <Link href="/" className="hc-button hc-button-primary">返回首页</Link>
        </section>
        <ProducerStyles />
      </main>
    );
  }

  return (
    <main className="producer-page">
      <div className="producer-shell">
        <section className="producer-hero">
          <div
            className="producer-avatar"
            style={producer.avatarUrl ? { backgroundImage: `url(${producer.avatarUrl})` } : undefined}
          >
            {!producer.avatarUrl && producer.displayName.charAt(0)}
          </div>

          <div className="producer-info">
            <div className="title-row">
              <div>
                <span>认证制作人</span>
                <h1>{producer.displayName}</h1>
              </div>
              <b>已认证</b>
            </div>

            {producer.bio && <p>{producer.bio}</p>}

            <div className="tag-row">
              {producer.styleTags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>

            <div className="stat-row">
              <Stat value={producer.templateCount} label="模板" />
              <Stat value={producer.totalSales || 0} label="销量" />
              <Stat value={formatDate(producer.joinedAt)} label="入驻时间" />
            </div>
          </div>
        </section>

        <div className="tabs">
          <button className={activeTab === 'templates' ? 'active' : ''} onClick={() => setActiveTab('templates')}>模板作品</button>
          <button className={activeTab === 'other' ? 'active' : ''} onClick={() => setActiveTab('other')}>其他内容</button>
        </div>

        {activeTab === 'templates' && (
          <>
            <div className="filter-row">
              <button className={!selectedGenre ? 'active' : ''} onClick={() => setSelectedGenre(null)}>全部</button>
              {producer.styleTags.map((tag) => (
                <button key={tag} className={selectedGenre === tag ? 'active' : ''} onClick={() => setSelectedGenre(tag)}>
                  {tag}
                </button>
              ))}
            </div>

            {templates.length === 0 ? (
              <section className="empty-card">
                <span>暂无模板</span>
                <p>暂无模板</p>
              </section>
            ) : (
              <section className="template-grid">
                {templates.map((template) => (
                  <Link key={template.id} href={`/templates/${template.id}`} className="template-card">
                    <div
                      className="template-cover"
                      style={template.coverUrl ? { backgroundImage: `url(${template.coverUrl})` } : { background: getGradient(template.name) }}
                    />
                    <div className="template-body">
                      <h3>{template.name}</h3>
                      <div className="tag-row small">
                        {(template.genreTags || [template.genre]).filter(Boolean).slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                      <div className="template-meta">
                        <strong>{template.price && template.price > 0 ? `¥${Math.round(template.price / 100)}` : '免费'}</strong>
                        {(template.salesCount || 0) > 0 && <span>销量 {template.salesCount}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </section>
            )}
          </>
        )}

        {activeTab === 'other' && (
          <section className="empty-card">
            <span>即将上线</span>
            <p>暂无其他内容</p>
          </section>
        )}
      </div>
      <ProducerStyles />
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StateCard({ title }: { title: string }) {
  return (
    <section className="state-card">
      <span>制作人</span>
      <h1>{title}</h1>
    </section>
  );
}

function ProducerStyles() {
  return (
    <style>{`
      .producer-page {
        min-height: 100vh;
        background:
          radial-gradient(circle at 10% 12%, rgba(206,255,53,.10), transparent 320px),
          radial-gradient(circle at 88% 20%, rgba(82,214,198,.08), transparent 340px),
          var(--hc-bg);
        color: var(--hc-text);
        padding: 42px 22px 72px;
      }

      .producer-page.centered {
        display: grid;
        place-items: center;
      }

      .producer-shell {
        max-width: 1180px;
        margin: 0 auto;
      }

      .producer-hero,
      .template-card,
      .empty-card,
      .state-card {
        border: 1px solid var(--hc-line);
        border-radius: var(--hc-radius-lg);
        background: rgba(24,26,34,.88);
        box-shadow: var(--hc-shadow);
      }

      .producer-hero {
        display: flex;
        gap: 24px;
        align-items: flex-start;
        padding: 28px;
        margin-bottom: 24px;
      }

      .producer-avatar {
        width: 92px;
        height: 92px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
        background-size: cover;
        background-position: center;
        color: #08090c;
        font-size: 34px;
        font-weight: 950;
      }

      .producer-info {
        min-width: 0;
        flex: 1;
      }

      .title-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
      }

      .title-row span,
      .state-card span,
      .empty-card span {
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .1em;
        text-transform: uppercase;
      }

      .title-row h1 {
        margin: 8px 0 0;
        font-size: clamp(34px, 5vw, 58px);
        line-height: 1;
      }

      .title-row b {
        border: 1px solid rgba(206,255,53,.34);
        border-radius: 999px;
        background: rgba(206,255,53,.1);
        color: var(--hc-lime);
        padding: 7px 11px;
        font-size: 12px;
        white-space: nowrap;
      }

      .producer-info p {
        margin: 16px 0;
        color: var(--hc-muted);
        line-height: 1.75;
      }

      .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag-row span {
        border: 1px solid rgba(206,255,53,.28);
        border-radius: 999px;
        background: rgba(206,255,53,.1);
        color: var(--hc-lime);
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 900;
      }

      .tag-row.small span {
        padding: 4px 8px;
        font-size: 10px;
      }

      .stat-row {
        display: flex;
        gap: 30px;
        margin-top: 20px;
        flex-wrap: wrap;
      }

      .stat-row strong {
        display: block;
        color: var(--hc-lime);
        font-size: 22px;
      }

      .stat-row span {
        color: var(--hc-muted);
        font-size: 12px;
      }

      .tabs,
      .filter-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }

      .tabs button,
      .filter-row button {
        border: 1px solid var(--hc-line);
        border-radius: 999px;
        background: rgba(24,26,34,.72);
        color: var(--hc-muted);
        padding: 9px 14px;
        font-weight: 900;
        cursor: pointer;
      }

      .tabs button.active,
      .filter-row button.active {
        border-color: rgba(206,255,53,.36);
        background: rgba(206,255,53,.12);
        color: var(--hc-lime);
      }

      .template-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }

      .template-card {
        overflow: hidden;
        color: inherit;
        text-decoration: none;
        transition: transform .22s ease, border-color .22s ease;
      }

      .template-card:hover {
        transform: translateY(-4px);
        border-color: rgba(206,255,53,.36);
      }

      .template-cover {
        height: 132px;
        background-size: cover;
        background-position: center;
      }

      .template-body {
        padding: 14px;
      }

      .template-body h3 {
        margin: 0 0 10px;
        color: var(--hc-text);
        font-size: 15px;
      }

      .template-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
      }

      .template-meta strong {
        color: var(--hc-lime);
        font-size: 18px;
      }

      .template-meta span {
        color: var(--hc-muted);
        font-size: 11px;
      }

      .empty-card,
      .state-card {
        padding: 34px;
        text-align: center;
      }

      .state-card {
        width: min(520px, calc(100vw - 40px));
      }

      @media (max-width: 920px) {
        .producer-hero {
          flex-direction: column;
        }

        .template-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 560px) {
        .producer-page {
          padding: 28px 14px 56px;
        }

        .template-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
