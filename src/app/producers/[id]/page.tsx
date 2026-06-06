'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

const COLLABORATORS = ['张学友', '孙燕姿', '蔡依林', '林俊杰', '莫文蔚', '王心凌'];
const USE_CASES = ['华语流行 Demo', '摇滚编曲', '抒情副歌', '商业广告', '唱作人小样'];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function getBioIntro(bio?: string) {
  if (!bio) return '来自 HookCraft 认证制作人，提供可直接进入工作台创作的模板作品。';
  const marker = '五十首代表作品';
  const intro = bio.includes(marker) ? bio.slice(0, bio.indexOf(marker)).trim() : bio.trim();
  return intro.length > 170 ? `${intro.slice(0, 170)}...` : intro;
}

function getRepresentativeWorks(bio?: string) {
  if (!bio) return ['遇见', 'Lydia', '白月光', '手心的蔷薇'];
  const marker = '五十首代表作品';
  const source = bio.includes(marker) ? bio.slice(bio.indexOf(marker) + marker.length) : bio;
  const works = source
    .replace(/[：:]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.includes('—') || item.includes('-'))
    .slice(0, 10);
  return works.length > 0 ? works : ['遇见', 'Lydia', '白月光', '手心的蔷薇'];
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
    void fetchProducer();
  }, [id]);

  useEffect(() => {
    void fetchTemplates();
  }, [id, selectedGenre]);

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
          <div className="hero-backdrop" />
          <div className="hero-content">
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

              <p>{getBioIntro(producer.bio)}</p>

              <div className="tag-row">
                {producer.styleTags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <Stat value="1500+" label="作品" />
            <Stat value={producer.templateCount} label="模板" />
            <Stat value={formatDate(producer.joinedAt)} label="入驻" />
          </div>
        </section>

        <section className="producer-story-grid">
          <div className="story-panel">
            <div className="section-kicker">PROFILE</div>
            <h2>制作人简介</h2>
            <p>{getBioIntro(producer.bio)}</p>
            <div className="chip-group">
              {getRepresentativeWorks(producer.bio).map((work) => <span key={work}>{work}</span>)}
            </div>
          </div>

          <aside className="scenario-panel">
            <div className="section-kicker">FOR CREATORS</div>
            <h2>创作适用场景</h2>
            <div className="chip-group scenario">
              {USE_CASES.map((item) => <span key={item}>{item}</span>)}
            </div>

            <h3>合作艺人</h3>
            <div className="collab-list">
              {COLLABORATORS.map((name) => <span key={name}>{name}</span>)}
            </div>
          </aside>
        </section>

        <div className="section-heading">
          <div>
            <span>PRODUCER TEMPLATES</span>
            <h2>模板作品</h2>
          </div>
          <div className="tabs">
            <button className={activeTab === 'templates' ? 'active' : ''} onClick={() => setActiveTab('templates')}>模板作品</button>
            <button className={activeTab === 'other' ? 'active' : ''} onClick={() => setActiveTab('other')}>其他内容</button>
          </div>
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
                <p>这位制作人的模板作品暂未上架。</p>
              </section>
            ) : (
              <section className="template-list">
                {templates.map((template) => (
                  <Link key={template.id} href={`/templates/${template.id}`} className="template-row">
                    <div
                      className="template-cover"
                      style={template.coverUrl ? { backgroundImage: `url(${template.coverUrl})` } : { background: getGradient(template.name) }}
                    />
                    <div className="template-body">
                      <h3>{template.name}</h3>
                      <p>适合华语流行 Demo，可进入工作台继续创作。</p>
                      <div className="tag-row small">
                        {(template.genreTags || [template.genre]).filter(Boolean).slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    </div>
                    <div className="template-meta">
                      <strong>{template.price && template.price > 0 ? `¥${Math.round(template.price / 100)}` : '免费'}</strong>
                      {(template.salesCount || 0) > 0 && <span>销量 {template.salesCount}</span>}
                      <em>查看模板</em>
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
            <p>暂无其他内容。</p>
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
    <style dangerouslySetInnerHTML={{ __html: `
      .producer-page {
        min-height: 100vh;
        background:
          linear-gradient(rgba(255,255,255,.026) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px),
          radial-gradient(circle at 16% 12%, rgba(206,255,53,.12), transparent 360px),
          radial-gradient(circle at 82% 20%, rgba(82,214,198,.08), transparent 340px),
          var(--hc-bg);
        background-size: 78px 78px, 78px 78px, auto, auto, auto;
        color: var(--hc-text);
        padding: 42px 22px 78px;
      }

      .producer-page.centered {
        display: grid;
        place-items: center;
      }

      .producer-shell {
        width: min(1180px, calc(100vw - 48px));
        margin: 0 auto;
      }

      .producer-hero,
      .story-panel,
      .scenario-panel,
      .template-row,
      .empty-card,
      .state-card {
        border: 1px solid rgba(255,255,255,.12);
        background: linear-gradient(180deg, rgba(24,26,34,.9), rgba(12,14,18,.9));
        box-shadow: 0 24px 80px rgba(0,0,0,.35);
      }

      .producer-hero {
        position: relative;
        overflow: hidden;
        border-radius: 18px;
        min-height: 300px;
        padding: 34px;
        margin-bottom: 18px;
      }

      .hero-backdrop {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(8,9,12,.92), rgba(8,9,12,.66) 52%, rgba(8,9,12,.92)),
          radial-gradient(circle at 75% 24%, rgba(206,255,53,.22), transparent 260px),
          repeating-linear-gradient(90deg, rgba(206,255,53,.12) 0 1px, transparent 1px 16px);
        opacity: .72;
      }

      .hero-backdrop::after {
        content: "";
        position: absolute;
        left: 46%;
        right: 6%;
        top: 78px;
        height: 92px;
        border-top: 1px solid rgba(206,255,53,.18);
        border-bottom: 1px solid rgba(82,214,198,.14);
        transform: skewY(-5deg);
        opacity: .6;
      }

      .hero-content {
        position: relative;
        display: grid;
        grid-template-columns: 126px minmax(0, 1fr);
        gap: 28px;
        align-items: end;
        max-width: 900px;
      }

      .producer-avatar {
        width: 126px;
        height: 126px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
        background-size: cover;
        background-position: center;
        color: #08090c;
        font-size: 42px;
        font-weight: 950;
        border: 1px solid rgba(255,255,255,.28);
        box-shadow: 0 18px 48px rgba(0,0,0,.42);
      }

      .producer-info {
        min-width: 0;
      }

      .title-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
      }

      .title-row span,
      .section-heading span,
      .section-kicker,
      .state-card span,
      .empty-card span {
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .title-row h1 {
        margin: 8px 0 0;
        font-size: clamp(46px, 6vw, 76px);
        line-height: .95;
        letter-spacing: 0;
      }

      .title-row b {
        border: 1px solid rgba(206,255,53,.34);
        border-radius: 999px;
        background: rgba(206,255,53,.1);
        color: var(--hc-lime);
        padding: 8px 12px;
        font-size: 12px;
        white-space: nowrap;
      }

      .producer-info p,
      .story-panel p,
      .template-body p,
      .empty-card p {
        color: var(--hc-muted);
        line-height: 1.72;
      }

      .producer-info p {
        max-width: 740px;
        margin: 16px 0;
        font-size: 15px;
      }

      .hero-stats {
        position: relative;
        display: flex;
        gap: 42px;
        margin: 34px 0 0 154px;
        flex-wrap: wrap;
      }

      .hero-stats strong {
        display: block;
        color: var(--hc-lime);
        font-size: 28px;
        line-height: 1;
      }

      .hero-stats span {
        display: block;
        margin-top: 8px;
        color: var(--hc-muted);
        font-size: 12px;
      }

      .producer-story-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
        gap: 16px;
        margin: 18px 0 28px;
      }

      .story-panel,
      .scenario-panel {
        border-radius: 16px;
        padding: 22px;
      }

      .story-panel h2,
      .scenario-panel h2,
      .section-heading h2 {
        margin: 8px 0 12px;
        font-size: 24px;
        line-height: 1.1;
      }

      .chip-group,
      .tag-row,
      .collab-list,
      .tabs,
      .filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag-row span,
      .chip-group span,
      .collab-list span {
        border: 1px solid rgba(206,255,53,.26);
        border-radius: 999px;
        background: rgba(206,255,53,.09);
        color: var(--hc-lime);
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 850;
      }

      .chip-group {
        margin-top: 16px;
      }

      .chip-group.scenario span {
        border-color: rgba(82,214,198,.28);
        background: rgba(82,214,198,.08);
        color: #bffcf0;
      }

      .scenario-panel h3 {
        margin: 22px 0 10px;
        color: var(--hc-text);
        font-size: 14px;
      }

      .section-heading {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 18px;
        margin: 28px 0 16px;
      }

      .tabs button,
      .filter-row button {
        border: 1px solid rgba(255,255,255,.12);
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

      .filter-row {
        margin-bottom: 14px;
      }

      .template-list {
        display: grid;
        gap: 12px;
      }

      .template-row {
        display: grid;
        grid-template-columns: 176px minmax(0, 1fr) 178px;
        align-items: center;
        gap: 18px;
        min-height: 132px;
        border-radius: 14px;
        overflow: hidden;
        color: inherit;
        text-decoration: none;
        transition: transform .22s ease, border-color .22s ease, background .22s ease;
      }

      .template-row:hover {
        transform: translateY(-2px);
        border-color: rgba(206,255,53,.36);
        background: linear-gradient(180deg, rgba(28,31,39,.94), rgba(14,16,21,.94));
      }

      .template-cover {
        height: 132px;
        background-size: cover;
        background-position: center;
      }

      .template-body {
        min-width: 0;
        padding: 18px 0;
      }

      .template-body h3 {
        margin: 0 0 8px;
        color: var(--hc-text);
        font-size: 20px;
      }

      .template-body p {
        margin: 0 0 12px;
        font-size: 13px;
      }

      .tag-row.small span {
        padding: 4px 8px;
        font-size: 10px;
      }

      .template-meta {
        display: grid;
        justify-items: end;
        gap: 8px;
        padding-right: 18px;
      }

      .template-meta strong {
        color: var(--hc-lime);
        font-size: 22px;
      }

      .template-meta span {
        color: var(--hc-muted);
        font-size: 11px;
      }

      .template-meta em {
        border: 1px solid rgba(206,255,53,.34);
        border-radius: 999px;
        color: var(--hc-lime);
        font-style: normal;
        font-size: 12px;
        font-weight: 900;
        padding: 8px 12px;
      }

      .empty-card,
      .state-card {
        border-radius: 16px;
        padding: 34px;
        text-align: center;
      }

      .state-card {
        width: min(520px, calc(100vw - 40px));
      }

      @media (max-width: 920px) {
        .producer-shell {
          width: min(100% - 28px, 760px);
        }

        .hero-content,
        .producer-story-grid,
        .template-row {
          grid-template-columns: 1fr;
        }

        .hero-stats {
          margin-left: 0;
        }

        .template-cover {
          height: 180px;
        }

        .template-meta {
          justify-items: start;
          padding: 0 18px 18px;
        }
      }

      @media (max-width: 560px) {
        .producer-page {
          padding: 28px 14px 56px;
        }

        .producer-hero {
          padding: 22px;
        }

        .title-row {
          flex-direction: column;
        }

        .section-heading {
          align-items: start;
          flex-direction: column;
        }
      }
    ` }} />
  );
}
