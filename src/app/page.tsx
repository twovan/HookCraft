'use client';

import Link from 'next/link';
import Image from 'next/image';
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
      <style>{homeStyles}</style>

      <section className="home-hero">
        <div className="hc-container home-hero-grid">
          <div className="home-hero-copy">
            <h1>从一个 Hook 开始，做出能发布的中文 Demo</h1>
            <p>
              浏览签约制作人的模板，输入创作方向，让 HookCraft 帮你生成双版本 Demo，
              再进入分轨工作台完成试听、剪辑和导出。
            </p>
            <div className="home-hero-actions">
              <Link href="/studio" className="hc-button">进入工作台</Link>
              <Link href="/templates" className="hc-button hc-button-secondary">探索模板</Link>
            </div>
          </div>

          <div className="home-console" aria-label="HookCraft product preview">
            <div className="home-console-top">
              <div>
                <span className="home-console-label">正在生成</span>
                <strong>{heroTemplate?.name || 'City Pop 旋律 Hook'}</strong>
              </div>
              <span className="home-live-dot">就绪</span>
            </div>
            <div className="home-album-row">
              <TemplateCover template={heroTemplate} size="large" />
              <div className="home-track-stack">
                {['人声', '鼓组', '贝斯', '键盘'].map((track, index) => (
                  <div className="home-track" key={track}>
                    <span>{track}</span>
                    <div>
                      {Array.from({ length: 20 }).map((_, bar) => (
                        <i key={bar} style={{ height: `${20 + ((bar + index * 3) % 7) * 7}%` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="home-console-footer">
              <span>2 个版本</span>
              <span>版权安全检查</span>
              <span>分轨编辑</span>
            </div>
          </div>
        </div>
      </section>

      <section className="hc-container home-section home-discovery">
        <div className="home-section-head">
          <div>
            <h2 className="hc-section-title">精选模板</h2>
            <p className="hc-section-kicker">从可试听的风格模板开始，比空白提示词更快接近成品。</p>
          </div>
          <Link href="/templates" className="home-text-link">查看全部</Link>
        </div>

        {loading ? (
          <div className="home-empty">正在同步模板...</div>
        ) : featuredTemplates.length === 0 ? (
          <div className="home-empty">暂无模板，稍后再来看看。</div>
        ) : (
          <div className="home-template-grid">
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
            <p className="hc-section-kicker">面向华语商业 Demo 的模板频道，适合副歌、广告歌、短视频和提案小样。</p>
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
              <p className="hc-section-kicker">新模板会保留原有购买、使用和创作入口。</p>
            </div>
          </div>
          <div className="home-template-grid compact">
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
            HookCraft 会在生成前处理版权安全检查，生成后保留版本、下载和分轨编辑路径，
            让 Demo 从灵感进入可管理的作品库。
          </p>
        </div>
        <Link href="/pricing" className="hc-button">查看会员与额度</Link>
      </section>
    </main>
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
        <span className="template-play">试听</span>
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
          <strong>{price > 0 ? `￥${price}` : '已包含'}</strong>
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

  .home-page { padding-bottom: 88px; overflow: hidden; position: relative; }
  .home-page::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: .38;
    background:
      linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: linear-gradient(180deg, black, transparent 72%);
  }
  .home-hero { min-height: calc(100vh - 70px); display: flex; align-items: center; padding: 56px 0 40px; position: relative; }
  .home-hero-grid { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(460px, 1fr); gap: 56px; align-items: center; }
  .home-hero-copy h1 {
    margin: 0;
    max-width: 760px;
    font-family: var(--hc-font-display);
    font-size: clamp(44px, 6vw, 78px);
    line-height: .94;
    font-weight: 950;
    letter-spacing: 0;
    color: var(--hc-text);
    text-wrap: balance;
  }
  .home-hero-copy h1::after {
    content: "";
    display: block;
    width: min(180px, 42vw);
    height: 5px;
    margin-top: 22px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--hc-lime), var(--hc-cyan), var(--hc-coral));
  }
  .home-hero-copy p { max-width: 640px; margin: 24px 0 0; color: var(--hc-text-muted); font-size: 17px; line-height: 1.85; text-wrap: pretty; }
  .home-hero-actions { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 32px; }
  .home-console {
    position: relative;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 18px;
    background:
      linear-gradient(135deg, rgba(255,255,255,.08), transparent 32%),
      linear-gradient(180deg, rgba(24, 26, 34, 0.96), rgba(8, 10, 14, 0.98));
    box-shadow: var(--hc-shadow), inset 0 1px 0 rgba(255,255,255,.08);
    padding: 18px;
    overflow: hidden;
  }
  .home-console::before {
    content: "";
    position: absolute;
    inset: 10px 10px auto 10px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(206,255,53,.42), transparent);
  }
  .home-console-top, .home-console-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .home-console-label { display: block; color: var(--hc-text-weak); font-size: 12px; font-weight: 700; margin-bottom: 6px; }
  .home-console-top strong { color: var(--hc-text); font-size: 18px; }
  .home-live-dot { border: 1px solid rgba(206,255,53,.38); border-radius: 999px; color: var(--hc-lime); padding: 6px 10px; font-size: 12px; font-weight: 800; }
  .home-album-row { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 18px; margin-top: 18px; }
  .template-cover { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: var(--hc-radius); border: 1px solid rgba(255,255,255,.12); display: flex; flex-direction: column; justify-content: space-between; padding: 14px; color: #08090c; }
  .template-cover.large { width: 220px; }
  .template-cover span { position: relative; z-index: 1; width: fit-content; border-radius: 999px; background: rgba(8,9,12,.74); color: var(--hc-text); padding: 6px 10px; font-size: 12px; font-weight: 800; }
  .cover-bars { position: relative; z-index: 1; display: flex; align-items: end; gap: 4px; height: 48px; }
  .cover-bars i { flex: 1; border-radius: 999px; background: rgba(8,9,12,.72); }
  .cover-bars i:nth-child(3n+1) { height: 44%; } .cover-bars i:nth-child(3n+2) { height: 76%; } .cover-bars i:nth-child(3n) { height: 58%; }
  .home-track-stack { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
  .home-track { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.01)); padding: 10px; }
  .home-track span { display: block; color: var(--hc-text-muted); font-size: 12px; font-weight: 800; margin-bottom: 8px; }
  .home-track div { height: 34px; display: flex; align-items: center; gap: 3px; }
  .home-track i { flex: 1; border-radius: 999px; background: var(--hc-cyan); opacity: .82; transform-origin: bottom; animation: home-meter-glow 1.8s ease-in-out infinite; }
  .home-track i:nth-child(2n) { animation-delay: .12s; }
  .home-track i:nth-child(3n) { animation-delay: .22s; }
  .home-track:nth-child(2) i { background: var(--hc-coral); } .home-track:nth-child(3) i { background: var(--hc-lime); } .home-track:nth-child(4) i { background: var(--hc-violet); }
  .home-console-footer { margin-top: 16px; color: var(--hc-text-muted); font-size: 12px; font-weight: 700; }
  .home-section { padding-top: 82px; }
  .home-section-head { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
  .home-text-link { color: var(--hc-lime); text-decoration: none; font-size: 14px; font-weight: 800; white-space: nowrap; }
  .home-empty { border: 1px dashed var(--hc-border); border-radius: var(--hc-radius-lg); background: rgba(255,255,255,.03); color: var(--hc-text-muted); padding: 28px; text-align: center; }
  .home-template-grid, .home-producer-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
  .template-card {
    min-width: 0;
    border: 1px solid var(--hc-border);
    border-radius: var(--hc-radius-lg);
    background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018));
    overflow: hidden;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    box-shadow: var(--hc-shadow-soft);
  }
  .template-card:hover { transform: translateY(-4px); border-color: rgba(206,255,53,.34); box-shadow: 0 20px 52px rgba(0,0,0,.32); }
  .template-card-cover { position: relative; display: block; color: inherit; text-decoration: none; }
  .template-play { position: absolute; right: 12px; bottom: 12px; min-height: 32px; display: inline-flex; align-items: center; border-radius: 999px; background: var(--hc-lime); color: #08090c; padding: 0 12px; font-size: 12px; font-weight: 900; opacity: 0; transform: translateY(4px); transition: opacity 160ms ease, transform 160ms ease; }
  .template-card:hover .template-play { opacity: 1; transform: translateY(0); }
  .template-card-body { padding: 14px; }
  .template-title { display: block; color: var(--hc-text); text-decoration: none; font-size: 16px; line-height: 1.35; font-weight: 800; }
  .template-producer { display: inline-block; margin-top: 7px; color: var(--hc-text-muted); text-decoration: none; font-size: 12px; font-weight: 700; }
  .template-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
  .template-tags span { border-radius: 999px; background: rgba(255,255,255,.06); color: var(--hc-text-muted); padding: 5px 9px; font-size: 11px; font-weight: 800; }
  .template-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
  .template-card-bottom strong { color: var(--hc-lime); font-size: 18px; }
  .template-card-bottom a { min-height: 34px; display: inline-flex; align-items: center; border-radius: 999px; background: rgba(206,255,53,.1); border: 1px solid rgba(206,255,53,.24); color: var(--hc-lime); text-decoration: none; padding: 0 12px; font-size: 12px; font-weight: 900; white-space: nowrap; }
  .home-channel-band, .home-safe-band { border: 1px solid rgba(255,255,255,.13); border-radius: 18px; background: linear-gradient(135deg, rgba(206,255,53,.12), rgba(82,214,198,.06) 46%, rgba(255,90,61,.1)); padding: 28px; display: grid; grid-template-columns: minmax(0, .9fr) minmax(340px, 1fr); gap: 28px; align-items: center; box-shadow: var(--hc-shadow-soft); }
  .home-channel-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .home-channel-list a { min-height: 54px; display: flex; align-items: center; justify-content: center; border-radius: var(--hc-radius); border: 1px solid var(--hc-border); background: rgba(8,9,12,.48); color: var(--hc-text); text-decoration: none; font-size: 14px; font-weight: 850; }
  .home-safe-band { grid-template-columns: minmax(0, 1fr) auto; margin-top: 82px; }
  @media (max-width: 1100px) {
    .home-hero-grid, .home-channel-band, .home-safe-band { grid-template-columns: 1fr; }
    .home-template-grid, .home-producer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .home-hero { min-height: auto; padding: 44px 0 30px; }
    .home-hero-copy p { font-size: 15px; }
    .home-console { padding: 14px; border-radius: 14px; }
    .home-album-row { grid-template-columns: 1fr; }
    .template-cover.large { width: 100%; }
    .home-template-grid, .home-producer-grid, .home-channel-list { grid-template-columns: 1fr; }
    .home-section-head { align-items: start; flex-direction: column; }
    .home-safe-band { margin-top: 56px; }
    .home-safe-band .hc-button { width: 100%; }
  }
`;
