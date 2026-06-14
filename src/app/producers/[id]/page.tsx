'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FocusEvent, MouseEvent } from 'react';
import { useParams } from 'next/navigation';
import type { ProducerProfile } from '@/types/producer';
import {
  TERENCE_REPRESENTATIVE_WORKS,
  formatRepresentativeWorkLabel,
  getRepresentativeWorkDetail,
  type RepresentativeWorkDetail,
} from '@/lib/producer/terenceRepresentativeWorks';

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

const FALLBACK_TAGS = ['华语流行 Demo', '摇滚编曲', '抒情副歌', '商业广告', '唱作人小样'];

const FALLBACK_REPRESENTATIVE_WORKS = TERENCE_REPRESENTATIVE_WORKS.map((work) => `${work.artist} - ${work.title}`);

const FALLBACK_COVERS = [
  'radial-gradient(circle at 24% 24%, rgba(255,120,198,.42), transparent 28%), linear-gradient(135deg, #22152d 0%, #331044 42%, #071016 100%)',
  'radial-gradient(circle at 50% 10%, rgba(245,197,66,.45), transparent 30%), linear-gradient(135deg, #2a1508 0%, #784115 48%, #08090c 100%)',
  'radial-gradient(circle at 78% 28%, rgba(82,214,198,.38), transparent 30%), linear-gradient(135deg, #0d2230 0%, #14314c 52%, #08090c 100%)',
  'radial-gradient(circle at 32% 38%, rgba(206,255,53,.42), transparent 27%), linear-gradient(135deg, #14210d 0%, #415611 48%, #08090c 100%)',
  'radial-gradient(circle at 72% 20%, rgba(255,90,61,.38), transparent 28%), linear-gradient(135deg, #2a1212 0%, #4b183e 50%, #08090c 100%)',
  'radial-gradient(circle at 50% 30%, rgba(255,255,255,.30), transparent 30%), linear-gradient(135deg, #16202a 0%, #384452 44%, #08090c 100%)',
];

function getFallbackCoverBackground(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COVERS[Math.abs(hash) % FALLBACK_COVERS.length];
}

function isUsableImageUrl(url?: string) {
  return Boolean(url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')));
}

function getBioIntro(bio?: string) {
  if (!bio) {
    return 'Terence Teo张瑞成，新加坡籍音乐制作人、编曲家。获第5届百事音乐风云榜“港台合最佳编曲”，获2005年新加坡金曲奖“最佳编曲”。从事编曲工作逾二十载，累计创作作品超1500首，长期为张学友、孙燕姿、蔡依林、林俊杰等华语歌手提供编曲支持。';
  }

  const marker = '五十首代表作品';
  const intro = bio.includes(marker) ? bio.slice(0, bio.indexOf(marker)).trim() : bio.trim();
  return intro.length > 180 ? `${intro.slice(0, 180)}...` : intro;
}

function getRepresentativeWorks(producer: ProducerProfile) {
  if (producer.representativeWorks.length > 0) return producer.representativeWorks;
  if (!producer.bio) return FALLBACK_REPRESENTATIVE_WORKS;

  const marker = '五十首代表作品';
  const source = producer.bio.includes(marker) ? producer.bio.slice(producer.bio.indexOf(marker) + marker.length) : producer.bio;
  const works = source
    .replace(/[，、；;。]/g, '\n')
    .split(/\n|\s{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.includes('-') || item.includes('—') || item.includes('–'))
    .slice(0, 50);

  return works.length > 0 ? works : FALLBACK_REPRESENTATIVE_WORKS;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
}

function formatPrice(template: TemplateItem) {
  if (template.category === 'free_template') return '免费';
  const price = template.price ? template.price / 100 : 0;
  return price > 0 ? `¥${price.toFixed(2)}` : '免费';
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
  const [activeWorkDetail, setActiveWorkDetail] = useState<RepresentativeWorkDetail | null>(null);
  const [workIntroPosition, setWorkIntroPosition] = useState({ x: 0, y: 0 });
  const [searchText, setSearchText] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);

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

  const representativeWorks = useMemo(() => {
    if (!producer) return FALLBACK_REPRESENTATIVE_WORKS;
    const seenWorks = new Set<string>();
    const uniqueWorks = [...getRepresentativeWorks(producer), ...FALLBACK_REPRESENTATIVE_WORKS].filter((work) => {
      const key = formatRepresentativeWorkLabel(work);
      if (seenWorks.has(key)) return false;
      seenWorks.add(key);
      return true;
    });
    return uniqueWorks.slice(0, 51);
  }, [producer]);

  const scrollingRepresentativeWorks = useMemo(() => {
    if (representativeWorks.length <= 8) return representativeWorks;
    return [...representativeWorks, ...representativeWorks];
  }, [representativeWorks]);

  const updateWorkIntroPosition = (clientX: number, clientY: number) => {
    setWorkIntroPosition({
      x: Math.max(16, Math.min(clientX + 18, window.innerWidth - 326)),
      y: Math.max(16, Math.min(clientY + 18, window.innerHeight - 180)),
    });
  };

  const handleWorkEnter = (work: string, event: MouseEvent<HTMLButtonElement>) => {
    setActiveWorkDetail(getRepresentativeWorkDetail(work));
    updateWorkIntroPosition(event.clientX, event.clientY);
  };

  const handleWorkFocus = (work: string, event: FocusEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveWorkDetail(getRepresentativeWorkDetail(work));
    updateWorkIntroPosition(rect.right, rect.top);
  };

  const handleWorkMove = (event: MouseEvent<HTMLButtonElement>) => {
    updateWorkIntroPosition(event.clientX, event.clientY);
  };

  const handleWorkLeave = () => {
    setActiveWorkDetail(null);
  };

  const styleTags = useMemo(() => {
    if (!producer || producer.styleTags.length === 0) return FALLBACK_TAGS;
    return producer.styleTags;
  }, [producer]);

  const visibleTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (freeOnly && template.category !== 'free_template') return false;
      const keyword = searchText.trim().toLowerCase();
      if (!keyword) return true;

      const searchable = [
        template.name,
        template.genre,
        ...(template.genreTags || []),
      ].join(' ').toLowerCase();

      return searchable.includes(keyword);
    });
  }, [freeOnly, searchText, templates]);

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
          <Link href="/" className="hc-button">返回首页</Link>
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
                  <h1>{producer.displayName}</h1>
                  <b>授权认证</b>
                </div>
              </div>

              <p>{getBioIntro(producer.bio)}</p>

              <div className="hero-meta">
                <Stat value="1500+" label="作品" />
                <Stat value={producer.templateCount ?? templates.length} label="模板" />
                <Stat value={formatDate(producer.joinedAt)} label="入驻" />
              </div>
            </div>

            <div className="use-case-stack" aria-label="适用场景">
              {styleTags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          </div>
        </section>

        <section className="producer-workspace">
          <aside className="producer-side-panel">
            <div className="section-heading works-panel-heading">
              <div>
                <span>REPRESENTATIVE WORKS</span>
                <h2>代表作</h2>
              </div>
              <b>{representativeWorks.length}</b>
            </div>

            <div className="works-list-frame" aria-label="代表作列表">
              <div className="works-mask">
                <div className={representativeWorks.length > 8 ? 'works-track is-rolling' : 'works-track'}>
                  {scrollingRepresentativeWorks.map((work, index) => (
                    <button
                      type="button"
                      className="work-row"
                      key={`${work}-${index}`}
                      title={getRepresentativeWorkDetail(work)?.intro}
                      onMouseOver={(event) => handleWorkEnter(work, event)}
                      onMouseMove={handleWorkMove}
                      onFocus={(event) => handleWorkFocus(work, event)}
                      onMouseLeave={handleWorkLeave}
                      onBlur={handleWorkLeave}
                    >
                      <span>{String((index % representativeWorks.length) + 1).padStart(2, '0')}</span>
                      <strong>{formatRepresentativeWorkLabel(work)}</strong>
                    </button>
                  ))}
                </div>
              </div>
              {activeWorkDetail && (
                <div
                  className="work-intro-card"
                  aria-live="polite"
                  style={{
                    '--work-intro-x': `${workIntroPosition.x}px`,
                    '--work-intro-y': `${workIntroPosition.y}px`,
                  } as CSSProperties}
                >
                  <span>{activeWorkDetail.artist}</span>
                  <strong>{activeWorkDetail.title}</strong>
                  <p>{activeWorkDetail.intro}</p>
                </div>
              )}
              <div className="works-count">
                <span>{representativeWorks.length} 首代表作</span>
                <span>悬停暂停</span>
              </div>
            </div>
          </aside>

          <section className="template-area">
            <div className="section-heading template-heading">
              <div>
                <span>PRODUCER TEMPLATES</span>
                <h2>模板作品</h2>
              </div>
              <div className="template-tools">
                <label className="search-box">
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="输入关键词搜索"
                  />
                  <span>⌕</span>
                </label>
                <label className="free-toggle">
                  <input
                    type="checkbox"
                    checked={freeOnly}
                    onChange={(event) => setFreeOnly(event.target.checked)}
                  />
                  <span>免费</span>
                </label>
              </div>
            </div>

            <div className="filter-row" aria-label="模板分类">
              <button className={!selectedGenre ? 'active' : ''} onClick={() => setSelectedGenre(null)}>全部</button>
              {['POP', 'ROCK', '抒情', '标签1', '标签2'].map((tag) => (
                <button
                  key={tag}
                  className={selectedGenre === tag ? 'active' : ''}
                  onClick={() => setSelectedGenre(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            {visibleTemplates.length === 0 ? (
              <section className="empty-card">
                <span>暂无模板</span>
                <p>这位制作人的模板作品暂未上架，或当前筛选没有匹配结果。</p>
              </section>
            ) : (
              <section className="template-grid">
                {visibleTemplates.slice(0, 6).map((template) => (
                  <TemplateCard key={template.id} template={template} producerName={producer.displayName} />
                ))}
              </section>
            )}
          </section>
        </section>
      </div>
      <ProducerStyles />
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="hero-stat">
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

function TemplateCard({ template, producerName }: { template: TemplateItem; producerName: string }) {
  const tags = (template.genreTags && template.genreTags.length > 0 ? template.genreTags : [template.genre])
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article className="template-card">
      <Link href={`/templates/${template.id}`} className="template-cover" aria-label={`查看模板 ${template.name}`}>
        {isUsableImageUrl(template.coverUrl) ? (
          <img src={template.coverUrl} alt={template.name} />
        ) : (
          <div className="template-generated-cover" style={{ background: getFallbackCoverBackground(template.name) }}>
            <span>{template.genre || 'Hook'}</span>
          </div>
        )}
      </Link>

      <div className="template-card-body">
        <Link href={`/templates/${template.id}`} className="template-title">{template.name}</Link>
        <div className="template-producer">{producerName}</div>
        <div className="template-tag-row">
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className="template-card-bottom">
          <strong>{formatPrice(template)}</strong>
          <Link href={`/studio?templateId=${template.id}`}>使用模板</Link>
        </div>
      </div>
    </article>
  );
}

function ProducerStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes worksAutoRoll {
        0% { transform: translateY(0); }
        100% { transform: translateY(-50%); }
      }

      .producer-page {
        min-height: 100vh;
        padding: 34px 0 88px;
        background:
          linear-gradient(rgba(255,255,255,.026) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px),
          radial-gradient(circle at 16% 10%, rgba(206,255,53,.12), transparent 360px),
          radial-gradient(circle at 82% 20%, rgba(82,214,198,.08), transparent 340px),
          var(--hc-bg);
        background-size: 78px 78px, 78px 78px, auto, auto, auto;
        color: var(--hc-text);
      }

      .producer-page.centered {
        display: grid;
        place-items: center;
      }

      .producer-shell {
        width: min(1240px, calc(100% - 96px));
        margin: 0 auto;
      }

      .producer-hero,
      .producer-side-panel,
      .template-card,
      .empty-card,
      .state-card {
        border: 1px solid var(--hc-border);
        background: linear-gradient(180deg, rgba(24,26,34,.92), rgba(12,14,18,.92));
        box-shadow: var(--hc-shadow-soft);
      }

      .producer-hero {
        position: relative;
        overflow: hidden;
        border-radius: 16px;
        min-height: 242px;
        margin-bottom: 24px;
      }

      .hero-backdrop {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(8,9,12,.94), rgba(8,9,12,.7) 54%, rgba(8,9,12,.92)),
          radial-gradient(circle at 76% 18%, rgba(206,255,53,.22), transparent 260px),
          radial-gradient(circle at 42% 82%, rgba(82,214,198,.12), transparent 260px);
      }

      .hero-backdrop::after {
        content: "";
        position: absolute;
        left: 44%;
        right: 4%;
        top: 74px;
        height: 108px;
        opacity: .58;
        background:
          repeating-linear-gradient(90deg, rgba(206,255,53,.16) 0 1px, transparent 1px 18px),
          linear-gradient(180deg, transparent, rgba(82,214,198,.12), transparent);
        clip-path: polygon(0 52%, 8% 38%, 16% 58%, 24% 28%, 34% 70%, 46% 34%, 58% 60%, 68% 42%, 78% 54%, 88% 36%, 100% 50%, 100% 100%, 0 100%);
      }

      .hero-content {
        position: relative;
        display: grid;
        grid-template-columns: 122px minmax(0, 1fr) 300px;
        gap: 26px;
        align-items: center;
        padding: 30px;
      }

      .producer-avatar {
        width: 122px;
        height: 122px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
        background-size: cover;
        background-position: center;
        color: #08090c;
        font-size: 38px;
        font-weight: 950;
        border: 1px solid rgba(255,255,255,.28);
        box-shadow: 0 18px 48px rgba(0,0,0,.42);
      }

      .producer-info {
        min-width: 0;
      }

      .title-row h1 {
        display: inline-flex;
        margin: 0;
        color: var(--hc-text);
        font-size: clamp(30px, 3.3vw, 42px);
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0;
        vertical-align: middle;
      }

      .title-row b {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        margin-left: 12px;
        border: 1px solid rgba(206,255,53,.34);
        border-radius: 999px;
        background: rgba(206,255,53,.1);
        color: var(--hc-lime);
        padding: 0 11px;
        font-size: 11px;
        font-weight: 850;
        vertical-align: 7px;
      }

      .producer-info p,
      .empty-card p {
        color: var(--hc-muted);
        line-height: 1.74;
      }

      .producer-info p {
        max-width: 720px;
        margin: 14px 0 18px;
        font-size: 14px;
      }

      .hero-meta {
        display: flex;
        gap: 34px;
        flex-wrap: wrap;
      }

      .hero-stat strong {
        display: block;
        color: var(--hc-lime);
        font-size: 24px;
        line-height: 1;
        font-weight: 950;
      }

      .hero-stat span {
        display: block;
        margin-top: 7px;
        color: var(--hc-muted);
        font-size: 11px;
        font-weight: 800;
      }

      .use-case-stack {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }

      .use-case-stack span,
      .template-tag-row span {
        border: 1px solid rgba(206,255,53,.28);
        border-radius: 999px;
        background: rgba(206,255,53,.09);
        color: var(--hc-lime);
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
      }

      .producer-workspace {
        display: grid;
        grid-template-columns: 252px minmax(0, 1fr);
        gap: 26px;
        align-items: start;
      }

      .producer-side-panel {
        position: sticky;
        top: 96px;
        z-index: 90;
        border-radius: 14px;
        padding: 16px;
      }

      .template-area {
        padding-top: 16px;
      }

      .filter-row button {
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 999px;
        background: rgba(255,255,255,.04);
        color: var(--hc-muted);
        font-weight: 900;
        cursor: pointer;
        transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease;
      }

      .filter-row button:hover {
        color: var(--hc-text);
        border-color: rgba(206,255,53,.24);
      }

      .filter-row button.active {
        background: rgba(206,255,53,.13);
        border-color: rgba(206,255,53,.42);
        color: var(--hc-lime);
      }

      .section-heading {
        position: relative;
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 14px;
        min-height: 74px;
        margin-bottom: 14px;
        padding: 0 2px 14px;
        border-bottom: 1px solid rgba(255,255,255,.08);
      }

      .section-heading span {
        display: block;
        color: var(--hc-lime);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .08em;
        line-height: 1;
      }

      .works-panel-heading > div {
        min-width: 0;
        padding-right: 54px;
      }

      .works-panel-heading span {
        white-space: nowrap;
      }

      .section-heading h2 {
        margin: 6px 0 0;
        color: var(--hc-text);
        font-size: 24px;
        line-height: 1.12;
        font-weight: 950;
      }

      .works-panel-heading b {
        position: absolute;
        right: 2px;
        bottom: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 42px;
        height: 32px;
        padding: 0 10px;
        border: 1px solid rgba(206,255,53,.32);
        border-radius: 999px;
        background: rgba(206,255,53,.1);
        color: var(--hc-lime);
        font-size: 13px;
        font-weight: 950;
      }

      .works-list-frame {
        position: relative;
        height: clamp(360px, calc(100vh - 320px), 506px);
        overflow: hidden;
        border-radius: 12px;
      }

      .works-mask {
        height: calc(100% - 34px);
        overflow: hidden;
        -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 26px, #000 calc(100% - 52px), transparent 100%);
        mask-image: linear-gradient(180deg, transparent 0, #000 26px, #000 calc(100% - 52px), transparent 100%);
      }

      .works-track {
        display: grid;
        gap: 3px;
        padding: 4px 0 42px;
      }

      .works-track.is-rolling {
        animation: worksAutoRoll 112s linear infinite;
        will-change: transform;
      }

      .works-list-frame:hover .works-track.is-rolling {
        animation-play-state: paused;
      }

      @media (prefers-reduced-motion: reduce) {
        .works-track.is-rolling {
          animation: none;
        }
      }

      .works-count {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 9px 4px 2px;
        background: linear-gradient(180deg, rgba(12,14,18,0), rgba(12,14,18,.98) 52%);
        color: rgba(168,170,163,.78);
        font-size: 10px;
        font-weight: 800;
      }

      .works-count span:last-child {
        color: rgba(206,255,53,.72);
      }

      .works-list-frame:hover .works-count span:last-child {
        color: var(--hc-lime);
      }

      .work-intro-card {
        position: fixed;
        z-index: 1000;
        left: var(--work-intro-x);
        top: var(--work-intro-y);
        width: 286px;
        padding: 14px 16px 15px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 14px;
        background: rgba(5,6,8,.94);
        box-shadow: 0 22px 56px rgba(0,0,0,.46);
        color: var(--hc-text);
        pointer-events: none;
      }

      .work-intro-card::before {
        display: none;
      }

      .work-intro-card span {
        display: block;
        color: var(--hc-lime);
        font-size: 10px;
        font-weight: 900;
        line-height: 1;
      }

      .work-intro-card strong {
        display: block;
        margin-top: 7px;
        color: #f7f8f2;
        font-size: 15px;
        line-height: 1.25;
        font-weight: 900;
      }

      .work-intro-card p {
        margin: 9px 0 0;
        color: rgba(225,229,217,.76);
        font-size: 12px;
        line-height: 1.75;
      }

      .works-list-frame::-webkit-scrollbar {
        width: 0;
      }

      .works-list-frame::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: rgba(255,255,255,.16);
      }

      .work-row {
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        width: 100%;
        min-height: 34px;
        padding: 6px 8px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: var(--hc-muted);
        font: inherit;
        text-align: left;
        cursor: default;
        transition: background .18s ease, color .18s ease;
      }

      .work-row:hover,
      .work-row:focus-visible {
        background: rgba(206,255,53,.08);
        color: var(--hc-text);
        outline: none;
      }

      .work-row span {
        color: var(--hc-text-weak);
        font-size: 10px;
        font-weight: 850;
      }

      .work-row strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        font-weight: 750;
      }

      .template-heading {
        gap: 18px;
      }

      .template-tools {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .search-box {
        display: flex;
        align-items: center;
        width: 224px;
        height: 38px;
        border: 1px solid var(--hc-border);
        border-radius: 999px;
        background: rgba(255,255,255,.04);
        padding: 0 12px 0 16px;
      }

      .search-box input {
        min-width: 0;
        flex: 1;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--hc-text);
        font-size: 12px;
      }

      .search-box input::placeholder {
        color: var(--hc-text-weak);
      }

      .search-box span {
        color: var(--hc-lime);
        font-size: 17px;
        letter-spacing: 0;
      }

      .free-toggle {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--hc-muted);
        font-size: 12px;
        font-weight: 800;
      }

      .free-toggle input {
        accent-color: var(--hc-lime);
      }

      .filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 14px;
      }

      .filter-row button {
        min-width: 58px;
        padding: 8px 12px;
        font-size: 12px;
      }

      .template-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .template-card {
        overflow: hidden;
        border-radius: 14px;
        transition: transform .2s ease, border-color .2s ease, background .2s ease;
      }

      .template-card:hover {
        transform: translateY(-3px);
        border-color: rgba(206,255,53,.32);
        background: linear-gradient(180deg, rgba(28,31,39,.94), rgba(14,16,21,.94));
      }

      .template-cover {
        display: block;
        height: 138px;
        overflow: hidden;
        text-decoration: none;
      }

      .template-cover img,
      .template-generated-cover {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }

      .template-generated-cover {
        position: relative;
      }

      .template-generated-cover::after {
        content: "";
        position: absolute;
        inset: 34% 0 auto;
        height: 46px;
        background:
          linear-gradient(90deg, transparent, rgba(255,255,255,.34), transparent),
          repeating-linear-gradient(90deg, rgba(255,255,255,.2) 0 1px, transparent 1px 13px);
        clip-path: polygon(0 55%, 8% 28%, 16% 66%, 25% 20%, 36% 78%, 48% 30%, 58% 68%, 68% 24%, 80% 60%, 91% 34%, 100% 52%, 100% 100%, 0 100%);
        opacity: .72;
      }

      .template-generated-cover span {
        position: absolute;
        left: 14px;
        bottom: 12px;
        z-index: 1;
        border-radius: 999px;
        background: rgba(8,9,12,.62);
        color: var(--hc-text);
        padding: 6px 9px;
        font-size: 11px;
        font-weight: 900;
      }

      .template-card-body {
        padding: 15px;
      }

      .template-title {
        display: block;
        min-height: 44px;
        color: var(--hc-text);
        font-size: 15px;
        font-weight: 850;
        line-height: 1.34;
        text-decoration: none;
      }

      .template-title:hover {
        color: var(--hc-lime);
      }

      .template-producer {
        margin-top: 8px;
        color: var(--hc-muted);
        font-size: 12px;
      }

      .template-tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 12px 0 15px;
      }

      .template-tag-row span {
        padding: 5px 8px;
        font-size: 10px;
      }

      .template-card-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .template-card-bottom strong {
        color: var(--hc-lime);
        font-size: 18px;
        font-weight: 900;
      }

      .template-card-bottom a {
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: var(--hc-lime);
        color: #08090c;
        padding: 0 14px;
        text-decoration: none;
        font-size: 12px;
        font-weight: 900;
        box-shadow: 0 10px 24px rgba(206,255,53,.12);
      }

      .empty-card,
      .state-card {
        border-radius: 16px;
        padding: 38px;
        text-align: center;
      }

      .state-card {
        width: min(520px, calc(100vw - 40px));
      }

      .state-card span,
      .empty-card span {
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .08em;
      }

      .state-card h1 {
        margin: 10px 0 24px;
      }

      @media (max-width: 1100px) {
        .producer-shell {
          width: min(100% - 44px, 880px);
        }

        .hero-content,
        .producer-workspace {
          grid-template-columns: 1fr;
        }

        .use-case-stack {
          justify-content: flex-start;
        }

        .producer-side-panel {
          position: relative;
          top: 0;
        }

        .template-area {
          padding-top: 0;
        }

        .work-intro-card {
          left: 16px;
          right: 16px;
          top: auto;
          bottom: 72px;
          width: auto;
        }

        .work-intro-card::before {
          display: none;
        }

        .template-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .producer-page {
          padding-top: 28px;
        }

        .producer-shell {
          width: min(100% - 28px, 560px);
        }

        .hero-content {
          padding: 24px;
        }

        .template-heading,
        .template-tools {
          align-items: stretch;
          flex-direction: column;
        }

        .search-box {
          width: 100%;
        }

        .template-grid {
          grid-template-columns: 1fr;
        }

      }
    ` }} />
  );
}
