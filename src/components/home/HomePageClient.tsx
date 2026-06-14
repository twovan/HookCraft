'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { ProducerSummary } from '@/types/producer';
import {
  TERENCE_REPRESENTATIVE_WORKS,
  formatRepresentativeWorkLabel,
} from '@/lib/producer/terenceRepresentativeWorks';

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

const GENRE_CHANNELS = ['Chinese POP', 'EDM', 'HIP-POP', 'ROCK', 'LO-FI', 'JAZZ'];
const WORKFLOW_STEPS = [
  { label: '灵感', icon: 'spark' },
  { label: 'HookCraft Original', icon: 'wave' },
  { label: 'Demo', icon: 'play' },
  { label: 'Studio Lite', icon: 'sliders' },
  { label: 'Leonard Finish', icon: 'master' },
  { label: '发布', icon: 'send' },
] as const;
const TEMPLATE_FILTERS = ['全部', '流行', 'R&B', '说唱', '摇滚', '电子'];
const WAVE_COLORS = ['#a855f7', '#d9a441', '#bfff1f', '#2dd4bf', '#f472b6', '#f97316'];
const WAVEFORM_PROFILE = [18, 26, 42, 66, 34, 22, 54, 80, 46, 28, 24, 62, 36, 20, 18, 30, 74, 88, 52, 24, 18, 20, 34, 58, 72, 48, 30, 22, 26, 64, 40, 18, 16, 22, 70, 92, 46, 20, 18, 24, 38, 56];
const STUDIO_SHOWCASE_WEBM = '/showcase/hookcraft-homepage-showcase.webm';
const STUDIO_SHOWCASE_MP4 = '/showcase/hookcraft-homepage-showcase.mp4';
const DEFAULT_HOME_HERO_BACKGROUND_URL = '/home-hero-studio.webp';
async function fetchWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function formatPrice(template: TemplateItem) {
  const price = template.price ? template.price / 100 : 0;
  return price > 0 ? `¥${price.toFixed(2)}` : '免费';
}

function getProducerWorks(producer?: ProducerSummary) {
  const works = producer?.representativeWorks?.filter(Boolean) ?? [];
  const fallbackWorks = TERENCE_REPRESENTATIVE_WORKS.map((work) => `${work.artist} - ${work.title}`);

  return (works.length > 0 ? works : fallbackWorks)
    .slice(0, 8)
    .map((work) => formatRepresentativeWorkLabel(work));
}

function getHomeHeroBackgroundStyle(backgroundImageUrl: string): CSSProperties {
  const safeUrl = backgroundImageUrl.trim() || DEFAULT_HOME_HERO_BACKGROUND_URL;
  return { '--home-hero-bg': `url("${safeUrl.replace(/"/g, '\\"')}")` } as CSSProperties;
}

interface HomePageClientProps {
  initialHeroBackgroundUrl: string;
  initialHeroOverlayEnabled: boolean;
}

export default function HomePageClient({
  initialHeroBackgroundUrl,
  initialHeroOverlayEnabled,
}: HomePageClientProps) {
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

  const originalTemplates = useMemo(() => templates.slice(0, 4), [templates]);
  const producer = featuredProducers[0];
  const producerWorks = useMemo(() => getProducerWorks(producer), [producer]);
  const producerHref = producer ? `/producers/${producer.id}` : '/templates';
  const producerName = producer?.displayName || 'Terence Teo';
  const producerMeta = producer?.styleTags?.slice(0, 2).join(' / ') || '华语流行 / 摇滚编曲';

  return (
    <main className="hc-shell home-page">
      <style dangerouslySetInnerHTML={{ __html: homeStyles }} />

      <section className="home-hero" aria-label="HookCraft AI Demo 工作站">
        <div
          className={`home-hero-bg${initialHeroOverlayEnabled ? ' has-overlay' : ''}`}
          aria-hidden="true"
          style={getHomeHeroBackgroundStyle(initialHeroBackgroundUrl)}
        />
        <div className="hc-container home-hero-inner">
          <div className="home-hero-copy">
            <span className="home-eyebrow">HOOKCRAFT ORIGINAL</span>
            <h1>
              华语音乐 AI Demo 工作站
              <small>从灵感到可发布 Demo</small>
            </h1>
            <p className="home-route">生成 -&gt; 修改 -&gt; 优化 -&gt; 发布</p>
          </div>

          <div className="home-start-panel">
            <span>CREATE A SONG</span>
            <h2>在 HookCraft 完成一首歌</h2>
            <p>从灵感到商业 Demo，支持 AI 生成、Studio Lite 修改、Leonard Finish 优化和商业提案导出。</p>
            <div>
              <Link href="/templates" className="hc-button hc-button-secondary">查看模板</Link>
              <Link href="/studio" className="hc-button">开始创作</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="hc-container home-section home-workflow" aria-label="HookCraft Workflow">
        <SectionTitle eyebrow="HOOKCRAFT WORKFLOW" title="从灵感到发行的工作流" />
        <div className="workflow-track">
          {WORKFLOW_STEPS.map((step, index) => (
            <div className="workflow-step" key={step.label}>
              <span>
                <WorkflowIcon name={step.icon} />
              </span>
              <strong>{step.label}</strong>
              {index < WORKFLOW_STEPS.length - 1 && <i aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      <section className="hc-container home-section">
        <SectionTitle eyebrow="PRODUCER IN RESIDENCE" title="入驻音乐人" />
        <div className="producer-spotlight">
          <Link href={producerHref} className="producer-avatar" aria-label={`查看 ${producerName}`}>
            {producer?.avatarUrl ? <Image src={producer.avatarUrl} alt={producerName} fill sizes="96px" /> : <span>{producerName.charAt(0)}</span>}
          </Link>
          <div className="producer-copy">
            <h2>{producerName}</h2>
            <p>张瑞成，新加坡籍音乐制作人、编曲家。长期为华语歌手提供编曲与 Demo 支持。</p>
            <b>{producerMeta}</b>
          </div>
          <div className="producer-works">
            <span>代表作</span>
            <div>
              {producerWorks.map((work) => <em key={work}>{work}</em>)}
            </div>
          </div>
          <Link href={producerHref} className="producer-signature">
            <strong>{producerName.split(' ')[0]} Signature Templates</strong>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="hc-container home-section">
        <div className="home-section-line">
          <SectionTitle eyebrow="HOOKCRAFT ORIGINAL" title="模板作品" />
          <Link href="/templates" className="home-text-link">全部 &gt;</Link>
        </div>

        {loading ? (
          <div className="template-row" aria-label="模板加载中">
            {Array.from({ length: 4 }).map((_, index) => <TemplateSkeleton key={index} index={index} />)}
          </div>
        ) : originalTemplates.length === 0 ? (
          <div className="home-empty">暂无模板，稍后再来看看。</div>
        ) : (
          <div className="template-row">
            {originalTemplates.map((template) => <TemplateCard key={template.id} template={template} />)}
          </div>
        )}
      </section>

      <section className="hc-container home-section">
        <div className="studio-lite-showcase">
          <div className="studio-lite-copy">
            <span className="studio-lite-kicker">Studio Lite</span>

            <div className="studio-lite-feature">
              <h3>专业编辑器 <span aria-hidden="true">&gt;</span></h3>
              <p>12类专业分轨结果，解锁 WAV 和高级制作功能。</p>
              <small>多分轨结果 高级制作 WAV/批量导出</small>
            </div>

            <div className="studio-lite-feature">
              <h3>基础编辑器 <span aria-hidden="true">&gt;</span></h3>
              <p>2轨: 人声+伴奏，支持完整片段编辑，导出 MP3。</p>
              <small>人声+伴奏 片段剪辑 MP3导出</small>
            </div>

            <Link href="/studio" className="studio-lite-cta">立即体验</Link>
          </div>

          <div className="studio-lite-video-wrap" aria-label="Studio Lite 编辑器演示">
            <div className="studio-lite-video-stage">
              <video
                className="studio-lite-video"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster="/showcase/hookcraft-homepage-showcase-poster.png"
              >
                <source src={STUDIO_SHOWCASE_WEBM} type="video/webm" />
                <source src={STUDIO_SHOWCASE_MP4} type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </section>

      <section className="hc-container home-section">
        <div className="style-finder">
          <h2>按风格找灵感</h2>
          <div className="style-chip-grid">
            {GENRE_CHANNELS.map((genre) => (
              <Link key={genre} href={`/templates?genre=${encodeURIComponent(genre)}`}>{genre}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="hc-container home-section commercial-band">
        <div>
          <span>COMMERCIAL READY</span>
          <h2>商业创作需要可控流程</h2>
          <p>HookCraft 在生成前处理版权安全检查，生成后保留版本、下载和分轨编辑路径，让 Demo 从灵感进入可管理的作品库。</p>
        </div>
        <Link href="/pricing" className="hc-button hc-button-secondary">查看会员</Link>
      </section>
    </main>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="section-title">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

function WorkflowIcon({ name }: { name: (typeof WORKFLOW_STEPS)[number]['icon'] }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === 'spark' && <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Z" />}
      {name === 'wave' && <path d="M3 13c2.1 0 2.1-5 4.2-5s2.1 8 4.2 8 2.1-8 4.2-8 2.1 5 5.4 5" />}
      {name === 'play' && <path d="M8 6v12l10-6L8 6Z" />}
      {name === 'sliders' && <path d="M5 7h9M18 7h1M5 12h2M11 12h8M5 17h11M20 17h-1M14 5v4M7 10v4M16 15v4" />}
      {name === 'master' && <path d="M4 15c3.5-6 6.5-6 10 0M7 18c2-3 4-3 6 0M15 6l5 5M20 6l-5 5" />}
      {name === 'send' && <path d="M4 12 20 5l-6 15-3-6-7-2Z" />}
    </svg>
  );
}

function TemplateSkeleton({ index }: { index: number }) {
  return (
    <article className="template-card template-card-skeleton">
      <div className="template-wave" style={{ '--wave-color': WAVE_COLORS[index % WAVE_COLORS.length] } as CSSProperties}>
        {Array.from({ length: 40 }).map((_, bar) => (
          <i key={bar} style={{ height: `${WAVEFORM_PROFILE[(bar + index * 5) % WAVEFORM_PROFILE.length]}%` }} />
        ))}
      </div>
      <div className="template-card-body">
        <span className="skeleton-line wide" />
        <span className="skeleton-line" />
      </div>
    </article>
  );
}

function TemplateCard({ template }: { template: TemplateItem }) {
  const waveColor = WAVE_COLORS[Math.abs(template.name.length + template.id.length) % WAVE_COLORS.length];
  const waveOffset = Math.abs(template.name.length * 3 + template.id.length) % WAVEFORM_PROFILE.length;
  const tags = [template.genre, formatPrice(template)].filter(Boolean);

  return (
    <article className="template-card" style={{ '--wave-color': waveColor } as CSSProperties}>
      <Link href={`/templates/${template.id}`} className="template-media" aria-label={`查看模板 ${template.name}`}>
        {template.coverUrl ? (
          <Image src={template.coverUrl} alt={template.name} fill sizes="(max-width: 720px) 100vw, 25vw" />
        ) : (
          <div className="template-wave">
            {Array.from({ length: 46 }).map((_, index) => (
              <i key={index} style={{ height: `${WAVEFORM_PROFILE[(index + waveOffset) % WAVEFORM_PROFILE.length]}%` }} />
            ))}
          </div>
        )}
      </Link>
      <div className="template-card-body">
        <Link href={`/templates/${template.id}`} className="template-title">{template.name}</Link>
        <div className="template-tags">
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>
    </article>
  );
}

const homeStyles = `
  .home-page {
    position: relative;
    padding-bottom: 96px;
    overflow: hidden;
    background:
      linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
      #05070a;
    background-size: 96px 96px;
  }

  .home-page::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 8%, rgba(206,255,53,.08), transparent 28%),
      radial-gradient(circle at 78% 10%, rgba(128,74,255,.12), transparent 31%);
  }

  .home-hero {
    position: relative;
    z-index: 1;
    min-height: 440px;
    border-bottom: 1px solid rgba(255,255,255,.08);
    overflow: hidden;
  }

  .home-hero-bg {
    position: absolute;
    inset: 0;
    background: var(--home-hero-bg, url('/home-hero-studio.webp')) center / cover;
    opacity: .95;
  }

  .home-hero-bg.has-overlay {
    background:
      radial-gradient(circle at 68% 34%, rgba(206,255,53,.36), transparent 18%),
      radial-gradient(circle at 74% 45%, rgba(255,255,255,.2), transparent 16%),
      linear-gradient(90deg, rgba(5,7,10,.94), rgba(5,7,10,.62) 45%, rgba(5,7,10,.9)),
      var(--home-hero-bg, url('/home-hero-studio.webp')) center / cover;
  }

  .home-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(115deg, transparent 54%, rgba(206,255,53,.18) 55%, transparent 66%);
    mix-blend-mode: screen;
    opacity: .78;
  }

  .home-hero-inner {
    position: relative;
    z-index: 1;
    min-height: 440px;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(360px, .58fr);
    gap: 64px;
    align-items: center;
    padding-top: 52px;
    padding-bottom: 54px;
  }

  .home-eyebrow,
  .section-title span,
  .commercial-band span {
    display: block;
    color: var(--hc-lime);
    font-size: 12px;
    font-weight: 900;
    line-height: 1;
  }

  .home-hero-copy h1 {
    margin: 16px 0 0;
    color: #f7f8f2;
    font-family: var(--hc-font-display);
    max-width: 880px;
    font-size: clamp(38px, 4.2vw, 62px);
    font-weight: 950;
    line-height: 1.02;
    letter-spacing: 0;
  }

  .home-hero-copy h1 small {
    display: block;
    margin-top: 24px;
    color: rgba(247,248,242,.92);
    font-size: clamp(30px, 3vw, 44px);
    font-weight: 860;
    line-height: 1.08;
  }

  .home-route {
    margin: 28px 0 0;
    color: rgba(247,248,242,.72);
    font-size: 22px;
    font-weight: 760;
  }

  .home-start-panel {
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 20px;
    background: rgba(12,15,20,.74);
    padding: 30px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
    backdrop-filter: blur(18px);
  }

  .home-start-panel h2 {
    margin: 10px 0 0;
    color: #f7f8f2;
    font-size: 26px;
    line-height: 1.18;
  }

  .home-start-panel p {
    margin: 18px 0 0;
    color: rgba(225,229,217,.72);
    font-size: 15px;
    line-height: 1.7;
  }

  .home-start-panel div {
    display: flex;
    gap: 14px;
    margin-top: 30px;
  }

  .home-section {
    position: relative;
    z-index: 1;
    padding-top: 54px;
  }

  .section-title {
    margin-bottom: 22px;
  }

  .section-title h2 {
    margin: 8px 0 0;
    color: #f7f8f2;
    font-size: 30px;
    line-height: 1.12;
    letter-spacing: 0;
  }

  .home-section-line {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }

  .home-section-line .section-title {
    margin-bottom: 0;
  }

  .home-text-link {
    margin-top: 8px;
    color: var(--hc-lime);
    text-decoration: none;
    font-weight: 900;
  }

  .workflow-track {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0;
    align-items: start;
  }

  .workflow-step {
    position: relative;
    min-width: 0;
    display: grid;
    justify-items: center;
    gap: 12px;
    color: rgba(247,248,242,.78);
    text-align: center;
    transition: color .18s ease, transform .18s ease;
  }

  .workflow-step span {
    width: 58px;
    height: 58px;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: rgba(12,15,20,.72);
    color: var(--hc-lime);
    font-size: 14px;
    font-weight: 900;
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }

  .workflow-step svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .workflow-step:hover {
    color: #f7f8f2;
    transform: translateY(-3px);
  }

  .workflow-step:hover span {
    border-color: rgba(206,255,53,.62);
    background: rgba(206,255,53,.16);
    box-shadow: 0 0 0 6px rgba(206,255,53,.07), 0 16px 34px rgba(0,0,0,.28);
  }

  .workflow-step strong {
    min-height: 42px;
    font-size: 15px;
    line-height: 1.3;
  }

  .workflow-step i {
    position: absolute;
    left: calc(50% + 38px);
    top: 28px;
    width: calc(100% - 76px);
    height: 1px;
    background: linear-gradient(90deg, rgba(206,255,53,.66), rgba(255,255,255,.22));
  }

  .workflow-step i::after {
    content: "";
    position: absolute;
    right: -2px;
    top: -4px;
    border-left: 8px solid rgba(206,255,53,.82);
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }

  .producer-spotlight {
    display: grid;
    grid-template-columns: 104px minmax(180px, .58fr) minmax(300px, 1fr) 310px;
    gap: 28px;
    align-items: center;
    border-top: 1px solid rgba(255,255,255,.12);
    border-bottom: 1px solid rgba(255,255,255,.12);
    padding: 32px 0;
  }

  .producer-avatar {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 999px;
    overflow: hidden;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,255,255,.18);
    background: rgba(206,255,53,.1);
    color: var(--hc-lime);
    font-size: 34px;
    font-weight: 950;
    text-decoration: none;
  }

  .producer-avatar img {
    object-fit: cover;
  }

  .producer-copy h2 {
    margin: 0;
    color: #f7f8f2;
    font-size: 28px;
    line-height: 1.1;
  }

  .producer-copy p {
    margin: 10px 0 0;
    color: rgba(225,229,217,.72);
    font-size: 14px;
    line-height: 1.55;
  }

  .producer-copy b {
    display: block;
    margin-top: 12px;
    color: var(--hc-lime);
    font-size: 12px;
  }

  .producer-works span {
    color: #f7f8f2;
    font-size: 13px;
    font-weight: 900;
  }

  .producer-works div {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 18px;
    margin-top: 12px;
  }

  .producer-works em {
    min-width: 0;
    color: rgba(225,229,217,.7);
    font-size: 12px;
    font-style: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .producer-signature {
    min-height: 76px;
    border-radius: 999px;
    background: rgba(206,255,53,.16);
    border: 1px solid rgba(206,255,53,.35);
    color: #f7f8f2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 0 26px 0 30px;
    text-decoration: none;
    transition: transform .18s ease, background .18s ease;
  }

  .producer-signature:hover {
    transform: translateY(-2px);
    background: rgba(206,255,53,.22);
  }

  .producer-signature strong {
    font-size: 20px;
    line-height: 1.12;
  }

  .producer-signature span {
    color: var(--hc-lime);
    font-size: 30px;
  }

  .template-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 26px;
  }

  .template-card {
    min-width: 0;
  }

  .template-card:hover .template-media {
    border-color: rgba(206,255,53,.42);
  }

  .template-media,
  .template-wave {
    position: relative;
    height: 126px;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 18px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 8px;
    background: color-mix(in srgb, var(--wave-color, #8b5cf6) 22%, rgba(8, 12, 20, .92));
    transition: border-color .18s ease;
  }

  .template-media img {
    object-fit: cover;
  }

  .template-wave i {
    flex: 1;
    min-width: 2px;
    border-radius: 999px;
    background: var(--wave-color, #8b5cf6);
    opacity: .86;
  }

  .template-card-body {
    padding-top: 14px;
  }

  .template-title {
    color: #f7f8f2;
    text-decoration: none;
    font-size: 19px;
    line-height: 1.25;
    font-weight: 950;
  }

  .template-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .template-tags span {
    min-width: 64px;
    min-height: 28px;
    padding: 0 12px;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(247,248,242,.78);
    font-size: 12px;
    font-weight: 820;
  }

  .skeleton-line {
    display: block;
    width: 42%;
    height: 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.14);
    margin-top: 10px;
  }

  .skeleton-line.wide {
    width: 70%;
    height: 16px;
    margin-top: 0;
  }

  .home-empty {
    border: 1px dashed rgba(255,255,255,.16);
    border-radius: 8px;
    color: rgba(247,248,242,.66);
    padding: 32px;
    text-align: center;
  }

  .studio-lite-showcase {
    display: grid;
    grid-template-columns: minmax(280px, .34fr) minmax(0, .66fr);
    align-items: center;
    gap: clamp(28px, 4vw, 72px);
    min-height: 360px;
    padding: 34px 40px 30px;
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 10px;
    background:
      linear-gradient(90deg, rgba(12,15,20,.86), rgba(12,15,20,.42) 48%, rgba(12,15,20,.08)),
      radial-gradient(circle at 72% 48%, rgba(206,255,53,.1), transparent 34%);
    overflow: hidden;
  }

  .studio-lite-copy {
    min-width: 0;
  }

  .studio-lite-kicker {
    display: block;
    color: #f7f8f2;
    font-size: 28px;
    font-weight: 950;
    line-height: 1;
  }

  .studio-lite-feature {
    margin-top: 30px;
  }

  .studio-lite-feature h3 {
    margin: 0;
    color: #f7f8f2;
    font-size: 22px;
    line-height: 1.12;
  }

  .studio-lite-feature h3 span {
    color: var(--hc-lime);
  }

  .studio-lite-feature p {
    margin: 14px 0 0;
    color: rgba(225,229,217,.78);
    font-size: 15px;
    line-height: 1.45;
  }

  .studio-lite-feature small {
    display: block;
    margin-top: 6px;
    color: rgba(247,248,242,.55);
    font-size: 12px;
    line-height: 1.5;
  }

  .studio-lite-cta {
    min-height: 46px;
    margin-top: 30px;
    border: 1px solid rgba(255,255,255,.42);
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f7f8f2;
    text-decoration: none;
    font-size: 14px;
    font-weight: 920;
    background: rgba(255,255,255,.05);
    transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease;
  }

  .studio-lite-cta:hover {
    transform: translateY(-2px);
    border-color: rgba(206,255,53,.68);
    background: rgba(206,255,53,.16);
    color: var(--hc-lime);
  }

  .studio-lite-video-wrap {
    position: relative;
    min-height: 340px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .studio-lite-video-stage {
    --studio-video-x: 4%;
    display: block;
    width: min(1040px, 118%);
    max-width: none;
    transform: translateX(var(--studio-video-x));
    filter: drop-shadow(0 26px 54px rgba(0,0,0,.38));
  }

  .studio-lite-video {
    display: block;
    width: 100%;
    max-width: none;
    height: auto;
  }

  .style-finder {
    display: grid;
    grid-template-columns: minmax(260px, .8fr) minmax(0, 1fr);
    gap: 44px;
    align-items: center;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 10px;
    padding: 36px 42px;
    background: rgba(12,15,20,.58);
  }

  .style-finder h2,
  .commercial-band h2 {
    margin: 0;
    color: #f7f8f2;
    font-size: 34px;
    line-height: 1.1;
  }

  .style-chip-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .style-chip-grid a {
    min-height: 44px;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 7px;
    display: grid;
    place-items: center;
    color: rgba(247,248,242,.82);
    text-decoration: none;
    font-size: 14px;
    font-weight: 900;
    background: rgba(255,255,255,.035);
    transition: transform .18s ease, background .18s ease, border-color .18s ease, color .18s ease, box-shadow .18s ease;
  }

  .style-chip-grid a:hover {
    transform: translateY(-2px);
    border-color: rgba(206,255,53,.58);
    background: rgba(206,255,53,.13);
    color: #f7f8f2;
    box-shadow: 0 12px 28px rgba(0,0,0,.24);
  }

  .commercial-band {
    margin-top: 22px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 32px;
    align-items: center;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 10px;
    padding: 48px 58px;
    background:
      linear-gradient(90deg, rgba(206,255,53,.1), rgba(255,255,255,.05)),
      rgba(18,20,24,.88);
  }

  .commercial-band p {
    max-width: 780px;
    margin: 18px 0 0;
    color: rgba(225,229,217,.72);
    font-size: 15px;
    line-height: 1.7;
  }

  @media (max-width: 1100px) {
    .home-hero-inner,
    .producer-spotlight,
    .studio-lite-showcase,
    .style-finder,
    .commercial-band {
      grid-template-columns: 1fr;
    }

    .studio-lite-showcase {
      padding: 30px 24px;
    }

    .studio-lite-video-wrap {
      min-height: 260px;
    }

    .studio-lite-video-stage {
      --studio-video-x: 0%;
      width: 110%;
    }

    .template-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .workflow-track {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      row-gap: 28px;
    }

    .workflow-step i {
      display: none;
    }
  }

  @media (max-width: 720px) {
    .home-hero,
    .home-hero-inner {
      min-height: auto;
    }

    .home-hero-inner {
      padding-top: 58px;
      padding-bottom: 42px;
      gap: 32px;
    }

    .home-start-panel div,
    .home-section-line {
      align-items: stretch;
      flex-direction: column;
    }

    .home-section-line {
      gap: 12px;
    }

    .home-text-link {
      margin-top: 0;
    }

    .workflow-track,
    .template-row,
    .producer-works div,
    .style-chip-grid {
      grid-template-columns: 1fr;
    }

    .producer-spotlight,
    .studio-lite-showcase,
    .style-finder,
    .commercial-band {
      padding-left: 22px;
      padding-right: 22px;
    }

    .studio-lite-kicker {
      font-size: 26px;
    }

    .studio-lite-video-wrap {
      min-height: 210px;
      margin: 0 -16px;
    }

    .studio-lite-video-stage {
      width: 118%;
    }

    .producer-signature {
      min-height: 64px;
    }
  }
`;
