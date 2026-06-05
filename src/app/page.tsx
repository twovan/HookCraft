'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
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

const GENRE_CHANNELS = ['Chinese Pop', 'EDM', 'Hip-Hop', 'Lo-Fi', 'Rock', 'Jazz'];
const TEMPLATE_FILTERS = ['全部', '流行', 'R&B', '说唱', '摇滚', '电子', '国风', '...'];
const HERO_FEATURES = [
  { title: '一站式创作', detail: '词曲编录混导出', icon: 'mix' },
  { title: 'AI 加速创作', detail: '灵感到成品更快', icon: 'spark' },
  { title: '可商用发布', detail: '版权清晰更安心', icon: 'safe' },
];
const WAVE_COLORS = ['#c084fc', '#ef4444', '#84cc16', '#2dd4bf', '#f472b6', '#f97316'];
const WAVEFORM_PROFILE = [18, 26, 42, 66, 34, 22, 54, 80, 46, 28, 24, 62, 36, 20, 18, 30, 74, 88, 52, 24, 18, 20, 34, 58, 72, 48, 30, 22, 26, 64, 40, 18, 16, 22, 70, 92, 46, 20, 18, 24, 38, 56];
const PRODUCER_PLACEHOLDERS = [
  { name: 'Fisherman', meta: '代表作《深海月序》' },
  { name: '陈令韬', meta: '代表作《孤勇者》' },
  { name: '彭飞', meta: '代表作《万物不如你》' },
  { name: 'h3R3', meta: '代表作《说散就散》' },
  { name: '刘凤瑶', meta: '代表作《达尔文》' },
  { name: '王嘉诚', meta: '代表作《星辰大海》' },
  { name: 'Z.H 刘维伦', meta: '代表作《告白》' },
];

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

  const featuredTemplates = useMemo(() => templates.slice(0, 6), [templates]);
  const newTemplates = useMemo(() => templates.slice(6, 10), [templates]);
  const heroTemplate = featuredTemplates[0];
  const producerShowcase = useMemo(() => {
    const realProducers = featuredProducers.slice(0, 8).map((producer) => ({
      id: producer.id,
      name: producer.displayName,
      meta: producer.styleTags.slice(0, 2).join(' / ') || `${producer.templateCount} 个模板`,
      avatarUrl: producer.avatarUrl,
      href: `/producers/${producer.id}`,
    }));
    const filler = PRODUCER_PLACEHOLDERS.slice(0, Math.max(0, 8 - realProducers.length)).map((producer, index) => ({
      id: `placeholder-${index}`,
      name: producer.name,
      meta: producer.meta,
      avatarUrl: '',
      avatarIndex: index,
      href: '/templates',
    }));
    return [...realProducers, ...filler].slice(0, 8);
  }, [featuredProducers]);

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
              <span className="home-brand-line"><span>HookCraft</span> AI 音乐创作</span>
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
                  <i className={`home-feature-icon ${item.icon}`} aria-hidden="true"><b /></i>
                  <strong>{item.title}</strong>
                  <em>{item.detail}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="hc-container home-section home-discovery">
        <div className="home-section-head">
          <div>
            <h2 className="hc-section-title">精选模板 <span className="section-spark">✦</span></h2>
            <p className="hc-section-kicker">从可套用的风格模板开始，比空白提示词更快接近成品。</p>
          </div>
          <Link href="/templates" className="home-text-link">查看全部模板 <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-filter-row" aria-label="模板分类">
          {TEMPLATE_FILTERS.map((filter, index) => (
            <Link
              key={filter}
              href={index === 0 ? '/templates' : `/templates?genre=${encodeURIComponent(filter)}`}
              className={index === 0 ? 'active' : ''}
            >
              {filter}
            </Link>
          ))}
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

      <section className="hc-container home-section home-producer-section">
        <div className="home-section-head">
          <div>
            <h2 className="hc-section-title">知名制作人 <span className="section-badge">Pro</span></h2>
            <p className="hc-section-kicker">他们正在使用 HookCraft 创作。</p>
          </div>
          <Link href="/templates" className="home-text-link">查看全部 <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-producer-strip">
          {producerShowcase.map((producer) => (
            <ProducerPill key={producer.id} producer={producer} />
          ))}
        </div>
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
  return (
    <article className="template-card template-card-skeleton">
      <div className="template-skeleton-wave" style={{ '--wave-color': WAVE_COLORS[index % WAVE_COLORS.length] } as CSSProperties}>
        {Array.from({ length: 38 }).map((_, bar) => (
          <i key={bar} style={{ height: `${WAVEFORM_PROFILE[(bar + index * 5) % WAVEFORM_PROFILE.length]}%` }} />
        ))}
      </div>
      <div className="template-card-body">
        <span className="template-skeleton-title" />
        <span className="template-skeleton-meta" />
      </div>
    </article>
  );
}

function TemplateCard({ template }: { template: TemplateItem }) {
  const tags = [template.genre, template.category === 'free_template' ? '免费' : '付费'].filter(Boolean);
  const price = template.price ? Math.round(template.price / 100) : 0;
  const waveColor = WAVE_COLORS[Math.abs(template.name.length + template.id.length) % WAVE_COLORS.length];
  const waveOffset = Math.abs(template.name.length * 3 + template.id.length) % WAVEFORM_PROFILE.length;

  return (
    <article className="template-card" style={{ '--wave-color': waveColor } as CSSProperties}>
      <Link href={`/templates/${template.id}`} className="template-wave-link" aria-label={`查看模板 ${template.name}`}>
        <div className="template-wave">
          {Array.from({ length: 46 }).map((_, index) => (
            <i key={index} style={{ height: `${WAVEFORM_PROFILE[(index + waveOffset) % WAVEFORM_PROFILE.length]}%` }} />
          ))}
        </div>
      </Link>
      <div className="template-card-body">
        <div className="template-title-row">
          <Link href={`/templates/${template.id}`} className="template-play" aria-label={`播放预览 ${template.name}`}>▶</Link>
          <Link href={`/templates/${template.id}`} className="template-title">{template.name}</Link>
        </div>
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

function ProducerPill({ producer }: { producer: { name: string; meta: string; avatarUrl?: string; avatarIndex?: number; href: string } }) {
  return (
    <Link href={producer.href} className="home-producer-pill">
      <span
        className={`home-producer-avatar ${producer.avatarUrl ? '' : 'is-faux'}`}
        style={!producer.avatarUrl ? { backgroundPosition: `-${(producer.avatarIndex ?? 0) * 50}px center` } : undefined}
      >
        {producer.avatarUrl ? (
          <Image src={producer.avatarUrl} alt={producer.name} fill sizes="56px" />
        ) : null}
      </span>
      <span>
        <strong>{producer.name}</strong>
        <em>{producer.meta}</em>
      </span>
    </Link>
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
    min-height: 560px;
    display: flex;
    align-items: stretch;
    overflow: hidden;
  }

  .home-hero-bg {
    position: absolute;
    inset: -14px -24px -10px 0;
    background-image: url('/home-hero-studio.webp');
    background-size: cover;
    background-position: 66% 44%;
    transform: scale(1.035);
  }

  .home-hero-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(5, 8, 14, .96) 0%, rgba(5, 8, 14, .78) 30%, rgba(5, 8, 14, .18) 58%, rgba(5, 8, 14, .28) 100%),
      linear-gradient(180deg, rgba(5, 8, 14, .02), rgba(5, 8, 14, .55) 74%, rgba(5, 8, 14, .92));
  }

  .home-hero-content {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 650px) minmax(360px, 1fr);
    align-items: center;
    gap: 56px;
    min-height: 560px;
    padding-top: 18px;
    padding-bottom: 18px;
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
    margin: 12px 0 0;
    max-width: 780px;
    font-family: var(--hc-font-display);
    font-size: clamp(31px, 3.25vw, 50px);
    line-height: 1.08;
    font-weight: 950;
    letter-spacing: 0;
    color: #f8fafc;
    text-wrap: balance;
  }

  .home-brand-line {
    display: block;
    white-space: nowrap;
  }

  .home-brand-line span {
    color: var(--hc-lime);
    font-size: clamp(52px, 5.25vw, 80px);
    line-height: .95;
  }

  .home-hero-copy h1 small {
    display: block;
    margin-top: 8px;
    color: #f8fafc;
    font-size: clamp(30px, 3.15vw, 48px);
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
    margin: 12px 0 0;
    color: #b9c3d4;
    font-size: 17px;
    line-height: 1.55;
    text-wrap: pretty;
  }

  .home-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 18px;
  }

  .home-feature-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 26px;
    margin-top: 18px;
    color: #9ca8ba;
    font-size: 12px;
    font-weight: 760;
  }

  .home-feature-row span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .home-feature-icon {
    position: relative;
    width: 30px;
    height: 30px;
    border: 1px solid rgba(151, 165, 196, .32);
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-style: normal;
    color: #dcefff;
  }

  .home-feature-icon::before,
  .home-feature-icon::after,
  .home-feature-icon b {
    content: "";
    position: absolute;
    display: block;
  }

  .home-feature-icon.mix::before,
  .home-feature-icon.mix::after,
  .home-feature-icon.mix b {
    width: 13px;
    height: 1px;
    left: 8px;
    border-radius: 999px;
    background: currentColor;
    box-shadow: 0 0 8px rgba(206, 255, 53, .12);
  }

  .home-feature-icon.mix::before { top: 10px; }
  .home-feature-icon.mix b { top: 15px; width: 10px; }
  .home-feature-icon.mix::after { top: 20px; width: 15px; }

  .home-feature-icon.spark::before {
    width: 12px;
    height: 12px;
    border: 1px solid currentColor;
    transform: rotate(45deg);
    border-radius: 3px;
  }

  .home-feature-icon.spark::after {
    width: 4px;
    height: 4px;
    right: 7px;
    top: 7px;
    border-radius: 999px;
    background: var(--hc-lime);
  }

  .home-feature-icon.safe::before {
    width: 13px;
    height: 15px;
    border: 1px solid currentColor;
    border-radius: 8px 8px 6px 6px;
    clip-path: polygon(50% 0, 100% 22%, 88% 100%, 12% 100%, 0 22%);
  }

  .home-feature-icon.safe::after {
    width: 5px;
    height: 8px;
    border-right: 1px solid var(--hc-lime);
    border-bottom: 1px solid var(--hc-lime);
    transform: rotate(38deg);
    top: 9px;
    left: 12px;
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

  .home-section {
    padding-top: 20px;
  }

  .home-section-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 10px;
  }

  .hc-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-spark {
    color: var(--hc-lime);
    font-size: .72em;
    line-height: 1;
    transform: translateY(-5px);
  }

  .section-badge {
    display: inline-flex;
    align-items: center;
    min-height: 18px;
    border-radius: 4px;
    border: 1px solid rgba(206, 255, 53, .35);
    background: rgba(206, 255, 53, .1);
    color: var(--hc-lime);
    padding: 0 6px;
    font-size: 10px;
    font-weight: 900;
    line-height: 1;
  }

  .home-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 12px;
  }

  .home-filter-row a {
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1px solid rgba(100, 113, 143, .28);
    background: rgba(8, 12, 20, .66);
    color: #b8c2d5;
    padding: 0 14px;
    text-decoration: none;
    font-size: 12px;
    font-weight: 820;
  }

  .home-filter-row a.active {
    border-color: rgba(206, 255, 53, .5);
    background: var(--hc-lime);
    color: #08090c;
  }

  .home-text-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--hc-lime);
    text-decoration: none;
    font-size: 14px;
    font-weight: 820;
    white-space: nowrap;
  }

  .home-text-link span {
    font-size: 15px;
    transform: translateY(-1px);
  }

  .home-empty {
    border: 1px dashed rgba(100, 113, 143, .28);
    border-radius: 8px;
    background: rgba(8, 12, 20, .52);
    color: #9ca3af;
    padding: 28px;
    text-align: center;
  }

  .home-template-grid {
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
    height: 46px;
    display: flex;
    align-items: center;
    gap: 1.5px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(100, 113, 143, .18);
    background: color-mix(in srgb, var(--wave-color, #8b5cf6) 20%, rgba(8, 12, 20, .9));
  }

  .template-skeleton-wave i {
    flex: 1;
    border-radius: 999px;
    background: var(--wave-color, #8b5cf6);
    opacity: .72;
    min-width: 2px;
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

  .template-wave-link {
    position: relative;
    display: block;
    color: inherit;
    text-decoration: none;
  }

  .template-wave {
    position: relative;
    height: 46px;
    display: flex;
    align-items: center;
    gap: 1.5px;
    padding: 8px 9px;
    border-bottom: 1px solid rgba(100, 113, 143, .18);
    background: color-mix(in srgb, var(--wave-color, #8b5cf6) 19%, rgba(8, 12, 20, .92));
  }

  .template-wave::after {
    content: "";
    position: absolute;
    left: 9px;
    right: 9px;
    top: 50%;
    height: 1px;
    background: color-mix(in srgb, var(--wave-color, #8b5cf6) 34%, transparent);
    opacity: .42;
  }

  .template-wave i {
    flex: 1;
    border-radius: 999px;
    background: var(--wave-color, #8b5cf6);
    opacity: .82;
    min-width: 1px;
    z-index: 1;
  }

  .template-card-body {
    padding: 7px 10px 8px;
  }

  .template-title-row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
  }

  .template-play {
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid rgba(203, 213, 225, .58);
    color: #f8fafc;
    font-size: 9px;
    text-decoration: none;
    line-height: 1;
  }

  .template-title {
    display: block;
    color: #f8fafc;
    text-decoration: none;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .template-producer {
    display: inline-block;
    margin-top: 2px;
    color: #8f9ab2;
    text-decoration: none;
    font-size: 11px;
    font-weight: 720;
  }

  .template-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .template-tags span {
    border-radius: 999px;
    background: rgba(255, 255, 255, .055);
    color: #98a2b3;
    padding: 3px 7px;
    font-size: 10px;
    font-weight: 800;
  }

  .template-card-bottom {
    display: none;
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

  .home-producer-section {
    padding-top: 18px;
    padding-bottom: 42px;
  }

  .home-producer-strip {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 20px;
  }

  .home-producer-pill {
    min-width: 0;
    display: grid;
    grid-template-columns: 50px minmax(0, 1fr);
    gap: 11px;
    align-items: center;
    color: #f8fafc;
    text-decoration: none;
  }

  .home-producer-avatar {
    position: relative;
    width: 50px;
    height: 50px;
    border-radius: 999px;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(206,255,53,.26), rgba(82,214,198,.16));
    border: 1px solid rgba(151, 165, 196, .22);
    color: var(--hc-lime);
    font-size: 18px;
    font-weight: 900;
  }

  .home-producer-avatar.is-faux {
    background-image: url('/home-producer-avatars.webp');
    background-repeat: no-repeat;
    background-size: auto 50px;
    border-color: rgba(206, 255, 53, .18);
    box-shadow: inset 0 -12px 22px rgba(0, 0, 0, .22);
  }

  .home-producer-avatar img {
    object-fit: cover;
  }

  .home-producer-pill strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #f4f7ff;
    font-size: 12px;
    font-weight: 860;
  }

  .home-producer-pill em {
    display: block;
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #7f8aa0;
    font-style: normal;
    font-size: 10px;
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

    .home-template-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .home-template-strip {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .home-producer-strip {
      grid-template-columns: repeat(4, minmax(0, 1fr));
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

    .home-template-grid,
    .home-channel-list {
      grid-template-columns: 1fr;
    }

    .home-producer-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
