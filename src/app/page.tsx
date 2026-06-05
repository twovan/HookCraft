'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
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

const COVER_GRADIENTS = [
  'linear-gradient(135deg, #ceff35 0%, #52d6c6 48%, #15181f 100%)',
  'linear-gradient(135deg, #ff5a3d 0%, #f5c542 42%, #15181f 100%)',
  'linear-gradient(135deg, #52d6c6 0%, #8b5cf6 50%, #15181f 100%)',
  'linear-gradient(135deg, #f5c542 0%, #ceff35 38%, #15181f 100%)',
  'linear-gradient(135deg, #ff5a3d 0%, #8b5cf6 52%, #15181f 100%)',
];

const GENRE_CHANNELS = ['Chinese Pop', 'EDM', 'Hip-Hop', 'Lo-Fi', 'Rock', 'Jazz'];
const WORKFLOW_STEPS = ['选择模板', '生成双版本', '分轨编辑', '导出交付'];
const HERO_FEATURES = [
  { title: '一站式创作', detail: '词曲编录混导出' },
  { title: 'AI 加速创作', detail: '灵感到成品更快' },
  { title: '可商用发布', detail: '版权清晰更安心' },
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
}

async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function HomePage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [featuredProducers, setFeaturedProducers] = useState<ProducerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetchWithTimeout('/api/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(Array.isArray(data) ? data : data.templates ?? []);
        }
      } catch {
        // Keep the homepage usable when templates are temporarily unavailable.
      } finally {
        setLoading(false);
      }
    }

    void fetchTemplates();
  }, []);

  useEffect(() => {
    async function fetchProducers() {
      try {
        const res = await fetchWithTimeout('/api/producers/featured', 5000);
        if (res.ok) {
          const data = await res.json();
          setFeaturedProducers(data.producers || []);
        }
      } catch {
        // Producer recommendations are optional on the landing surface.
      }
    }

    void fetchProducers();
  }, []);

  const featuredTemplates = useMemo(() => templates.slice(0, 8), [templates]);
  const newTemplates = useMemo(() => templates.slice(8, 12), [templates]);
  const heroTemplate = featuredTemplates[0];

  return (
    <main className="hc-shell home-page">
      <style dangerouslySetInnerHTML={{ __html: homeStyles }} />

      <section className="home-hero" aria-label="HookCraft AI 音乐创作">
        <div className="home-hero-bg" aria-hidden="true" />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="hc-container home-hero-content">
          <div className="home-hero-copy">
            <span className="home-eyebrow">新一代 AI 音乐工作站</span>
            <h1>
              <span>HookCraft</span> AI 音乐创作
              <small>从一个 Hook 开始<br />生成可发布的<span>华语成品 Demo</span></small>
            </h1>
            <p>
              AI 编曲、人声克隆、混音母带、一键导出 WAV。
            </p>
            <div className="home-hero-actions">
              <Link href="/studio" className="hc-button">进入工作台</Link>
              <Link href="/templates" className="hc-button hc-button-secondary">探索模板</Link>
            </div>
            <div className="home-feature-row" aria-label="核心能力">
              {HERO_FEATURES.map((item) => (
                <span key={item.title}>
                  <i aria-hidden="true">◎</i>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="hc-container home-workflow" aria-label="创作流程">
        {WORKFLOW_STEPS.map((step, index) => (
          <div className="home-workflow-step" key={step}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </section>

      <section className="hc-container home-section home-discovery">
        <div className="home-section-head">
          <div>
            <h2 className="hc-section-title">精选模板</h2>
            <p className="hc-section-kicker">从可套用的风格模板开始，比空白提示词更快接近成品。</p>
          </div>
          <Link href="/templates" className="home-text-link">查看全部</Link>
        </div>

        {loading ? (
          <div className="home-template-grid home-template-strip" aria-label="模板加载中">
            {Array.from({ length: 6 }).map((_, index) => (
              <TemplateSkeleton key={index} index={index} />
            ))}
          </div>
        ) : featuredTemplates.length === 0 ? (
          <div className="home-empty">暂无模板，稍后再来看看。</div>
        ) : (
          <div className="home-template-grid home-template-strip">
            {featuredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </section>

      <section className="hc-container home-section">
        <div className="home-channel-band">
          <div>
            <h2 className="hc-section-title">按风格找灵感</h2>
            <p className="hc-section-kicker">面向中文商业 Demo 的模板频道，适合副歌、广告歌、短视频和提案小样。</p>
          </div>
          <div className="home-channel-list">
            {GENRE_CHANNELS.map((genre) => (
              <Link key={genre} href={`/templates?genre=${encodeURIComponent(genre)}`}>
                {genre}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {newTemplates.length > 0 && (
        <section className="hc-container home-section">
          <div className="home-section-head">
            <div>
              <h2 className="hc-section-title">新品上架</h2>
              <p className="hc-section-kicker">新模板保留原有购买、使用和创作入口。</p>
            </div>
          </div>
          <div className="home-template-grid compact home-template-strip">
            {newTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </section>
      )}

      {featuredProducers.length > 0 && (
        <section className="hc-container home-section">
          <div className="home-section-head">
            <div>
              <h2 className="hc-section-title">推荐创作者</h2>
              <p className="hc-section-kicker">从制作人出发发现模板，沿用现有制作人详情与模板交易功能。</p>
            </div>
          </div>
          <div className="home-producer-grid">
            {featuredProducers.slice(0, 4).map((producer) => (
              <ProducerCard key={producer.id} producer={producer} />
            ))}
          </div>
        </section>
      )}

      <section className="hc-container home-section home-safe-band">
        <div>
          <h2 className="hc-section-title">商业创作需要可控流程</h2>
          <p className="hc-section-kicker">
            HookCraft 在生成前处理版权安全检查，生成后保留版本、下载和分轨编辑路径，
            让 Demo 从灵感进入可管理的作品库。
          </p>
        </div>
        <Link href="/pricing" className="hc-button">查看会员与额度</Link>
      </section>
    </main>
  );
}

function TemplateSkeleton({ index }: { index: number }) {
  const colors = ['#c084fc', '#ef4444', '#84cc16', '#2dd4bf', '#f472b6', '#f97316'];
  return (
    <article className="template-card template-card-skeleton">
      <div className="template-skeleton-wave" style={{ '--wave-color': colors[index % colors.length] } as CSSProperties}>
        {Array.from({ length: 28 }).map((_, bar) => (
          <i key={bar} style={{ height: `${28 + ((bar + index * 4) % 9) * 6}%` }} />
        ))}
      </div>
      <div className="template-card-body">
        <span className="template-skeleton-title" />
        <span className="template-skeleton-meta" />
      </div>
    </article>
  );
}

function TemplateCover({ template, size = 'normal' }: { template?: TemplateItem; size?: 'normal' | 'large' }) {
  const label = template?.genre || 'Hook';
  return (
    <div className={`template-cover ${size}`} style={{ background: getGradient(template?.name || label) }}>
      {template?.coverUrl ? (
        <Image src={template.coverUrl} alt={template.name} fill style={{ objectFit: 'cover' }} sizes={size === 'large' ? '320px' : '25vw'} />
      ) : (
        <>
          <span>{label}</span>
          <div className="cover-bars">
            {Array.from({ length: 14 }).map((_, index) => <i key={index} />)}
          </div>
        </>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: TemplateItem }) {
  const tags = [template.genre, template.category === 'free_template' ? '免费' : '付费'].filter(Boolean);
  const price = template.price ? Math.round(template.price / 100) : 0;

  return (
    <article className="template-card">
      <Link href={`/templates/${template.id}`} className="template-card-cover" aria-label={`查看模板 ${template.name}`}>
        <TemplateCover template={template} />
      </Link>
      <div className="template-card-body">
        <Link href={`/templates/${template.id}`} className="template-title">{template.name}</Link>
        {template.producerName && template.producerId && (
          <Link href={`/producers/${template.producerId}`} className="template-producer">
            by {template.producerName}
          </Link>
        )}
        <div className="template-tags">
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className="template-card-bottom">
          <strong>{price > 0 ? `¥${price}` : '已包含'}</strong>
          <Link href={`/studio?templateId=${template.id}`}>使用模板</Link>
        </div>
      </div>
    </article>
  );
}

const homeStyles = `
  @keyframes home-meter-glow {
    0%, 100% { opacity: .58; transform: scaleY(.78); }
    50% { opacity: 1; transform: scaleY(1); }
  }

  .home-page {
    position: relative;
    padding-bottom: 88px;
    overflow: hidden;
    background: #05080e;
  }

  .home-hero {
    position: relative;
    min-height: 660px;
    display: flex;
    align-items: stretch;
    overflow: hidden;
  }

  .home-hero-bg {
    position: absolute;
    inset: 0;
    background-image: url('/home-hero-studio.png');
    background-size: cover;
    background-position: center center;
    transform: scale(1.01);
  }

  .home-hero-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(5, 8, 14, .96) 0%, rgba(5, 8, 14, .72) 34%, rgba(5, 8, 14, .18) 65%, rgba(5, 8, 14, .38) 100%),
      linear-gradient(180deg, rgba(5, 8, 14, .08), rgba(5, 8, 14, .7) 72%, rgba(5, 8, 14, .94));
  }

  .home-hero-content {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 650px) minmax(360px, 1fr);
    align-items: center;
    gap: 56px;
    min-height: 660px;
    padding-top: 34px;
    padding-bottom: 42px;
  }

  .home-hero-copy {
    max-width: 690px;
    padding-top: 0;
  }

  .home-eyebrow {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid rgba(206, 255, 53, .28);
    background: rgba(9, 13, 21, .42);
    color: var(--hc-lime);
    font-size: 12px;
    font-weight: 860;
  }

  .home-hero-copy h1 {
    margin: 18px 0 0;
    max-width: 700px;
    font-family: var(--hc-font-display);
    font-size: clamp(34px, 3.7vw, 58px);
    line-height: 1.08;
    font-weight: 950;
    letter-spacing: 0;
    color: #f8fafc;
    text-wrap: balance;
  }

  .home-hero-copy h1 span {
    color: var(--hc-lime);
    font-size: clamp(56px, 6vw, 94px);
    line-height: .95;
  }

  .home-hero-copy h1 small {
    display: block;
    margin-top: 14px;
    color: #f8fafc;
    font-size: clamp(32px, 3.4vw, 52px);
    line-height: 1.12;
    font-weight: 940;
  }

  .home-hero-copy h1 small span {
    font-size: inherit;
    line-height: inherit;
    color: var(--hc-lime);
  }

  .home-hero-copy p {
    max-width: 640px;
    margin: 18px 0 0;
    color: #b9c3d4;
    font-size: 17px;
    line-height: 1.55;
    text-wrap: pretty;
  }

  .home-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 24px;
  }

  .home-feature-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 26px;
    margin-top: 28px;
    color: #9ca8ba;
    font-size: 12px;
    font-weight: 760;
  }

  .home-feature-row span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .home-feature-row i {
    width: 30px;
    height: 30px;
    border: 1px solid rgba(151, 165, 196, .32);
    border-radius: 7px;
    color: #ccecff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-style: normal;
    font-size: 12px;
  }

  .home-feature-row strong {
    color: #dfe7f3;
    font-size: 12px;
    font-weight: 860;
  }

  .home-feature-row em {
    color: #7f8aa0;
    font-style: normal;
    font-size: 11px;
    font-weight: 700;
  }

  .home-workflow {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    transform: translateY(-18px);
    border: 1px solid rgba(100, 113, 143, .22);
    border-radius: 8px;
    background: rgba(7, 10, 18, .84);
    backdrop-filter: blur(18px);
    overflow: hidden;
  }

  .home-workflow-step {
    min-height: 74px;
    padding: 17px 20px;
    border-right: 1px solid rgba(100, 113, 143, .18);
  }

  .home-workflow-step:last-child {
    border-right: 0;
  }

  .home-workflow-step span {
    display: block;
    color: #6f7b91;
    font-size: 10px;
    font-weight: 900;
  }

  .home-workflow-step strong {
    display: block;
    margin-top: 7px;
    color: #f1f5f9;
    font-size: 15px;
    font-weight: 900;
  }

  .home-section {
    padding-top: 44px;
  }

  .home-section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }

  .home-text-link {
    color: var(--hc-lime);
    text-decoration: none;
    font-size: 14px;
    font-weight: 820;
    white-space: nowrap;
  }

  .home-empty {
    border: 1px dashed rgba(100, 113, 143, .28);
    border-radius: 8px;
    background: rgba(8, 12, 20, .52);
    color: #9ca3af;
    padding: 28px;
    text-align: center;
  }

  .home-template-grid,
  .home-producer-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .home-template-strip {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 18px;
  }

  .template-card {
    min-width: 0;
    border: 1px solid rgba(100, 113, 143, .22);
    border-radius: 8px;
    background: rgba(10, 14, 22, .74);
    overflow: hidden;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
    box-shadow: none;
  }

  .template-card:hover {
    transform: translateY(-3px);
    border-color: rgba(206, 255, 53, .32);
    background: rgba(14, 19, 30, .88);
  }

  .template-card-skeleton {
    pointer-events: none;
  }

  .template-skeleton-wave {
    height: 72px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 12px;
    border-bottom: 1px solid rgba(100, 113, 143, .18);
    background: color-mix(in srgb, var(--wave-color, #8b5cf6) 20%, rgba(8, 12, 20, .9));
  }

  .template-skeleton-wave i {
    flex: 1;
    border-radius: 999px;
    background: var(--wave-color, #8b5cf6);
    opacity: .7;
  }

  .template-skeleton-title,
  .template-skeleton-meta {
    display: block;
    border-radius: 999px;
    background: rgba(151, 165, 196, .18);
  }

  .template-skeleton-title {
    width: 56%;
    height: 12px;
  }

  .template-skeleton-meta {
    width: 38%;
    height: 9px;
    margin-top: 10px;
  }

  .template-card-cover {
    position: relative;
    display: block;
    color: inherit;
    text-decoration: none;
  }

  .template-cover {
    position: relative;
    aspect-ratio: 2.65;
    overflow: hidden;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 8px;
    color: #08090c;
  }

  .template-cover span {
    position: relative;
    z-index: 1;
    width: fit-content;
    border-radius: 999px;
    background: rgba(8, 9, 12, .76);
    color: #f8fafc;
    padding: 5px 9px;
    font-size: 11px;
    font-weight: 820;
  }

  .cover-bars {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: end;
    gap: 4px;
    height: 34px;
  }

  .cover-bars i {
    flex: 1;
    border-radius: 999px;
    background: rgba(8, 9, 12, .72);
  }

  .cover-bars i:nth-child(3n+1) { height: 44%; }
  .cover-bars i:nth-child(3n+2) { height: 76%; }
  .cover-bars i:nth-child(3n) { height: 58%; }

  .template-card-body {
    padding: 10px 11px 11px;
  }

  .template-title {
    display: block;
    color: #f8fafc;
    text-decoration: none;
    font-size: 13px;
    line-height: 1.35;
    font-weight: 900;
  }

  .template-producer {
    display: inline-block;
    margin-top: 4px;
    color: #8f9ab2;
    text-decoration: none;
    font-size: 12px;
    font-weight: 720;
  }

  .template-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .template-tags span {
    border-radius: 999px;
    background: rgba(255, 255, 255, .055);
    color: #98a2b3;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 800;
  }

  .template-card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 10px;
  }

  .template-card-bottom strong {
    color: var(--hc-lime);
    font-size: 13px;
  }

  .template-card-bottom a {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    border-radius: 7px;
    background: rgba(206, 255, 53, .08);
    border: 1px solid rgba(206, 255, 53, .2);
    color: #e3ff9a;
    text-decoration: none;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 900;
    white-space: nowrap;
  }

  .home-channel-band,
  .home-safe-band {
    border: 1px solid rgba(100, 113, 143, .22);
    border-radius: 8px;
    background: rgba(8, 12, 20, .58);
    padding: 26px;
    display: grid;
    grid-template-columns: minmax(0, .9fr) minmax(340px, 1fr);
    gap: 28px;
    align-items: center;
    box-shadow: none;
  }

  .home-channel-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .home-channel-list a {
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    border: 1px solid rgba(100, 113, 143, .22);
    background: rgba(12, 17, 27, .62);
    color: #eef2ff;
    text-decoration: none;
    font-size: 14px;
    font-weight: 850;
  }

  .home-safe-band {
    grid-template-columns: minmax(0, 1fr) auto;
    margin-top: 68px;
  }

  @media (max-width: 1100px) {
    .home-hero-content,
    .home-channel-band,
    .home-safe-band {
      grid-template-columns: 1fr;
    }

    .home-hero-content {
      align-items: end;
      gap: 28px;
    }

    .home-hero-console {
      max-width: 560px;
    }

    .home-template-grid,
    .home-producer-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .home-hero {
      min-height: auto;
    }

    .home-hero-bg {
      background-position: 58% center;
    }

    .home-hero-content {
      min-height: auto;
      padding-top: 64px;
      padding-bottom: 34px;
    }

    .home-hero-copy {
      padding-bottom: 0;
    }

    .home-hero-copy p {
      font-size: 15px;
    }

    .home-hero-console {
      display: none;
    }

    .home-workflow,
    .home-template-grid,
    .home-producer-grid,
    .home-channel-list {
      grid-template-columns: 1fr;
    }

    .home-workflow {
      transform: none;
      margin-top: 18px;
    }

    .home-workflow-step {
      border-right: 0;
      border-bottom: 1px solid rgba(100, 113, 143, .18);
    }

    .home-section-head {
      align-items: start;
      flex-direction: column;
    }

    .home-safe-band {
      margin-top: 52px;
    }

    .home-safe-band .hc-button {
      width: 100%;
    }
  }
`;
