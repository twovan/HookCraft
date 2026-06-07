'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useAuth } from '@/contexts/AuthContext';

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  coverUrl?: string;
  analysisStatus: string;
  price?: number;
  producerId?: string;
  producerName?: string;
  producerAvatarUrl?: string;
}

const GENRES = ['Pop', 'Rock', 'EDM', 'Jazz', 'Hip-Hop', 'Classical', 'Lo-Fi'];

const FEATURED_GENRES = ['全部', '流行', '摇滚', '电子', '嘻哈', 'R&B / Soul', '爵士', '古典', 'Lo-Fi'];

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

function formatPrice(template: TemplateItem, isPurchased: boolean) {
  if (isPurchased) return '已购';
  if (template.category === 'free_template') return '免费';
  const price = template.price ? Math.round(template.price / 100) : 0;
  return price > 0 ? `¥${price}` : '待定价';
}

function isUsableImageUrl(url?: string) {
  return Boolean(url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')));
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

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const addItem = useCartStore((s) => s.addItem);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchTemplates() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithTimeout('/api/templates?tier=business');
        if (!res.ok) {
          setError('加载模板失败，请稍后重试');
          return;
        }
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.templates ?? []);
      } catch (err) {
        setError(err instanceof DOMException && err.name === 'AbortError'
          ? '模板接口响应超时，请稍后重试'
          : '网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    void fetchTemplates();
  }, []);

  useEffect(() => {
    if (!user) {
      setPurchasedIds(new Set());
      return;
    }

    async function fetchPurchased() {
      try {
        const res = await fetchWithTimeout('/api/templates/purchased', 5000);
        if (res.ok) {
          const data = await res.json();
          const ids = new Set<string>((data.templates || []).map((t: { id: string }) => t.id));
          setPurchasedIds(ids);
        }
      } catch {
        // Purchased status is optional for anonymous browsing.
      }
    }

    void fetchPurchased();
  }, [user]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
    setCurrentPage(1);
  };

  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (categoryFilter === 'free') {
      result = result.filter((t) => t.category === 'free_template');
    } else if (categoryFilter === 'paid') {
      result = result.filter((t) => t.category === 'paid_template');
    }

    if (selectedGenres.length > 0) {
      result = result.filter((t) =>
        selectedGenres.some((g) => t.genre.toLowerCase().includes(g.toLowerCase())),
      );
    }

    if (sortBy === 'price-low') {
      return [...result].sort((a, b) => (a.price || 0) - (b.price || 0));
    }
    if (sortBy === 'price-high') {
      return [...result].sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return result;
  }, [categoryFilter, selectedGenres, sortBy, templates]);

  const producerCount = new Set(templates.map((template) => template.producerId || template.producerName).filter(Boolean)).size;
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTemplates = filteredTemplates.slice((safePage - 1) * pageSize, safePage * pageSize);

  const clearFilters = () => {
    setSelectedGenres([]);
    setCategoryFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  return (
    <main className="hc-shell templates-page">
      <style>{templatesStyles}</style>
      <div className="templates-market-shell">
        <section className="templates-hero" aria-labelledby="templates-title">
          <div className="templates-hero-copy">
            <h1 id="templates-title">模板市场</h1>
            <p>从成熟 Hook、风格标签和签约制作人出发，快速进入可生成、可购买、可发布的 Demo 工作流。</p>
            <div className="templates-hero-actions">
              <Link href="/studio" className="templates-primary-action">
                <span>进入工作台</span>
                <span aria-hidden="true">→</span>
              </Link>
              <HeroStat icon="templates" value={loading ? '同步中' : `${templates.length}`} label="个模板" />
              <HeroStat icon="producer" value={producerCount > 0 ? `${producerCount}` : '认证'} label="签约制作人" />
              <HeroStat icon="license" value="可商用" label="安全可用授权" />
            </div>
          </div>
          <div className="templates-hero-art" aria-hidden="true" />
        </section>

        <div className="templates-workspace">
          <aside className="templates-filter" aria-label="模板筛选">
            <FilterGroup title="类型">
              {[
                { key: 'all', label: '全部' },
                { key: 'free', label: '免费模板' },
                { key: 'paid', label: '付费模板' },
              ].map((opt) => (
                <label key={opt.key} className={`filter-line ${categoryFilter === opt.key ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="category"
                    checked={categoryFilter === opt.key}
                    onChange={() => {
                      setCategoryFilter(opt.key);
                      setCurrentPage(1);
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </FilterGroup>

            <FilterGroup title="风格">
              {GENRES.map((genre) => (
                <label key={genre} className={`filter-line ${selectedGenres.includes(genre) ? 'is-active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(genre)}
                    onChange={() => toggleGenre(genre)}
                  />
                  <span>{genre}</span>
                </label>
              ))}
            </FilterGroup>

            <FilterGroup title="排序">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="filter-select"
              >
                <option value="newest">最新上架</option>
                <option value="popular">最受欢迎</option>
                <option value="price-low">价格：低到高</option>
                <option value="price-high">价格：高到低</option>
              </select>
            </FilterGroup>

            <button type="button" onClick={clearFilters} className="filter-clear">
              清除筛选
            </button>
          </aside>

          <section className="templates-results">
            <div className="templates-results-toolbar">
              <div>
                <h2>全部模板</h2>
                <p>{loading ? '正在同步模板...' : `${filteredTemplates.length} 个结果`}</p>
              </div>
              <div className="templates-toolbar-controls" aria-label="模板视图控制">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="newest">最新上架</option>
                  <option value="popular">最受欢迎</option>
                  <option value="price-low">价格：低到高</option>
                  <option value="price-high">价格：高到低</option>
                </select>
                <span className="view-toggle is-active" aria-hidden="true">▦</span>
                <span className="view-toggle" aria-hidden="true">☰</span>
              </div>
            </div>

            <div className="template-category-strip" aria-label="模板分类">
              {FEATURED_GENRES.map((genre) => {
                const isAll = genre === '全部';
                const active = isAll ? selectedGenres.length === 0 : selectedGenres.includes(genre === '流行' ? 'Pop' : genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    className={active ? 'active' : ''}
                    onClick={() => {
                      if (isAll) {
                        setSelectedGenres([]);
                        setCurrentPage(1);
                        return;
                      }
                      const map: Record<string, string> = {
                        流行: 'Pop',
                        摇滚: 'Rock',
                        电子: 'EDM',
                        嘻哈: 'Hip-Hop',
                        古典: 'Classical',
                      };
                      toggleGenre(map[genre] || genre);
                    }}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <StatePanel tone="loading" title="正在加载模板" text="正在读取模板、价格和已购状态。" />
            ) : error ? (
              <StatePanel tone="error" title="模板加载失败" text={error} action={<button type="button" onClick={() => window.location.reload()}>重试</button>} />
            ) : filteredTemplates.length === 0 ? (
              <StatePanel tone="empty" title="没有匹配的模板" text="调整类型或风格筛选后再试一次。" action={<button type="button" onClick={clearFilters}>清除筛选</button>} />
            ) : (
              <>
                <div className="template-market-grid">
                  {paginatedTemplates.map((template) => (
                    <TemplateMarketCard
                      key={template.id}
                      template={template}
                      isPurchased={purchasedIds.has(template.id)}
                      onUse={() => router.push(`/studio?templateId=${template.id}`)}
                      onAddToCart={() => addItem({
                        template_id: template.id,
                        name: template.name,
                        price: template.price || 0,
                        cover_url: template.coverUrl || null,
                        genre: template.genre,
                        added_at: new Date().toISOString(),
                      })}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="templates-pagination">
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={safePage === page ? 'active' : ''}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

type HeroStatIconName = 'templates' | 'producer' | 'license';

function HeroStat({ icon, value, label }: { icon: HeroStatIconName; value: string; label: string }) {
  return (
    <div className="templates-hero-stat">
      <span className="templates-hero-stat-icon" aria-hidden="true">
        <HeroStatIcon name={icon} />
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function HeroStatIcon({ name }: { name: HeroStatIconName }) {
  if (name === 'producer') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="9" cy="8" r="3.1" />
        <path d="M3.7 18.6c.8-3.4 2.6-5 5.3-5s4.5 1.6 5.3 5" />
        <path d="M16 6.2v8.5" />
        <path d="M16 6.2l4.6-1.3v3.2L16 9.4" />
        <circle cx="14.2" cy="16.1" r="1.8" />
      </svg>
    );
  }

  if (name === 'license') {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12 3.8l7 2.5v5.2c0 4.4-2.6 7.2-7 8.8-4.4-1.6-7-4.4-7-8.8V6.3l7-2.5z" />
        <path d="M9 12.1l2 2 4.3-5" />
        <path d="M15.9 7.4v4.9" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M6.2 5.6h9.4a2.2 2.2 0 0 1 2.2 2.2v8.6" />
      <path d="M4.2 8.1h9.4a2.2 2.2 0 0 1 2.2 2.2v8.1H6.4a2.2 2.2 0 0 1-2.2-2.2V8.1z" />
      <path d="M8.2 13.2h3.8" />
      <path d="M8.2 16h5.6" />
    </svg>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="filter-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function StatePanel({
  title,
  text,
  action,
  tone = 'empty',
}: {
  title: string;
  text: string;
  action?: ReactNode;
  tone?: 'loading' | 'error' | 'empty';
}) {
  const mark = tone === 'loading' ? '同步中' : tone === 'error' ? '可重试' : '空状态';
  return (
    <div className="templates-state">
      <span>{mark}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function TemplateMarketCard({
  template,
  isPurchased,
  onUse,
  onAddToCart,
}: {
  template: TemplateItem;
  isPurchased: boolean;
  onUse: () => void;
  onAddToCart: () => void;
}) {
  const isFree = template.category === 'free_template';
  const actionText = isPurchased ? '去创作' : isFree ? '立即使用' : '购买模板';
  const priceText = formatPrice(template, isPurchased);

  const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isPurchased || isFree) {
      onUse();
      return;
    }
    onAddToCart();
  };

  return (
    <article className="template-market-card">
      <Link href={`/templates/${template.id}`} className="template-market-cover" aria-label={`查看模板 ${template.name}`}>
        {isUsableImageUrl(template.coverUrl) ? (
          <img src={template.coverUrl} alt={template.name} />
        ) : (
          <div className="template-generated-cover" style={{ background: getFallbackCoverBackground(template.name) }}>
            <span>{template.genre || 'Hook'}</span>
          </div>
        )}
      </Link>

      <div className="template-market-body">
        <Link href={`/templates/${template.id}`} className="template-market-title">{template.name}</Link>
        <div className="template-market-tags">
          {(template.genre ? template.genre.split(/[,\s/]+/) : ['流行']).filter(Boolean).slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="template-market-producer-row">
          {isUsableImageUrl(template.producerAvatarUrl) ? <img src={template.producerAvatarUrl} alt="" /> : <span aria-hidden="true" />}
          {template.producerName && template.producerId ? (
            <Link href={`/producers/${template.producerId}`}>来自 {template.producerName}</Link>
          ) : (
            <span>来自 HookCraft Studio</span>
          )}
          <b aria-label="认证制作人" />
        </div>
        <div className="template-license">正版授权</div>
        <div className="template-market-bottom">
          <strong>{priceText}</strong>
          <button type="button" onClick={handleAction}>{actionText}</button>
        </div>
      </div>
    </article>
  );
}

const templatesStyles = `
  .templates-page {
    min-height: 100vh;
    padding: 0 0 88px;
    background:
      linear-gradient(180deg, rgba(206,255,53,.045), transparent 330px),
      radial-gradient(circle at 82px 110px, rgba(139,92,246,.12), transparent 260px),
      #050608;
  }

  .templates-market-shell {
    width: min(1800px, calc(100% - 104px));
    margin: 0 auto;
  }

  .templates-hero {
    position: relative;
    min-height: 344px;
    display: grid;
    grid-template-columns: minmax(420px, .74fr) minmax(520px, 1fr);
    align-items: center;
    gap: 22px;
    overflow: hidden;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }

  .templates-hero::before {
    content: "";
    position: absolute;
    inset: 0 -52px 0;
    background:
      radial-gradient(circle at 35% 70%, rgba(206,255,53,.06), transparent 310px),
      linear-gradient(90deg, #050608 0%, rgba(5,6,8,.92) 34%, rgba(5,6,8,.35) 62%, #050608 100%);
    pointer-events: none;
    z-index: 1;
  }

  .templates-hero-copy {
    position: relative;
    z-index: 2;
    min-width: 0;
    padding-left: clamp(0px, 7.5vw, 168px);
  }

  .templates-hero h1 {
    margin: 0;
    color: #f7f4ed;
    font-size: clamp(46px, 4vw, 72px);
    line-height: .98;
    font-weight: 950;
    letter-spacing: 0;
  }

  .templates-hero p {
    max-width: 560px;
    margin: 22px 0 0;
    color: rgba(244,241,234,.68);
    font-size: 17px;
    line-height: 1.85;
    font-weight: 520;
  }

  .templates-hero-actions {
    display: flex;
    align-items: center;
    gap: 32px;
    margin-top: 44px;
  }

  .templates-primary-action {
    min-width: 206px;
    min-height: 58px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border-radius: 8px;
    background: var(--hc-lime);
    color: #070806;
    padding: 0 28px;
    text-decoration: none;
    font-size: 16px;
    font-weight: 950;
    box-shadow: 0 16px 38px rgba(206,255,53,.24);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .templates-primary-action:hover {
    transform: translateY(-2px);
    box-shadow: 0 22px 48px rgba(206,255,53,.30);
  }

  .templates-hero-stat {
    position: relative;
    min-width: 124px;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 10px 12px;
    color: #f4f1ea;
  }

  .templates-hero-stat::before {
    content: none;
  }

  .templates-hero-stat-icon {
    position: relative;
    width: 42px;
    height: 42px;
    grid-row: span 2;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid rgba(206,255,53,.35);
    background:
      radial-gradient(circle at 34% 28%, rgba(206,255,53,.22), transparent 42%),
      rgba(206,255,53,.08);
    box-shadow:
      inset 0 0 18px rgba(206,255,53,.10),
      0 0 22px rgba(206,255,53,.08);
  }

  .templates-hero-stat-icon::after {
    content: "";
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,.06);
  }

  .templates-hero-stat-icon svg {
    position: relative;
    z-index: 1;
    width: 23px;
    height: 23px;
    fill: none;
    stroke: #ceff35;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 7px rgba(206,255,53,.38));
  }

  .templates-hero-stat::after {
    content: "";
    position: absolute;
    left: -20px;
    top: 7px;
    bottom: 7px;
    width: 1px;
    background: rgba(255,255,255,.2);
  }

  .templates-hero-stat strong {
    align-self: end;
    color: #f7f4ed;
    font-size: 17px;
    line-height: 1;
    font-weight: 900;
  }

  .templates-hero-stat span {
    align-self: start;
    color: rgba(244,241,234,.62);
    font-size: 13px;
    line-height: 1.2;
    font-weight: 720;
  }

  .templates-hero-art {
    position: relative;
    z-index: 0;
    align-self: stretch;
    min-height: 344px;
    background-image: url('/template-market-hero-wave.png');
    background-size: cover;
    background-position: center right;
    opacity: .9;
    filter: saturate(1.08) contrast(1.03);
  }

  .templates-workspace {
    display: grid;
    grid-template-columns: 282px minmax(0, 1fr);
    gap: 36px;
    align-items: start;
    padding-top: 38px;
  }

  .templates-filter {
    position: sticky;
    top: 94px;
    padding: 0 38px 0 0;
    border-right: 1px solid rgba(255,255,255,.12);
  }

  .filter-group {
    padding: 0 0 28px;
    margin: 0 0 28px;
    border-bottom: 1px solid rgba(255,255,255,.09);
  }

  .filter-group h3 {
    margin: 0 0 16px;
    color: #f4f1ea;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 0;
  }

  .filter-line {
    min-height: 32px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: rgba(244,241,234,.72);
    font-size: 14px;
    font-weight: 760;
    cursor: pointer;
  }

  .filter-line input {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--hc-lime);
  }

  .filter-line.is-active {
    color: var(--hc-lime);
  }

  .filter-select,
  .templates-toolbar-controls select {
    width: 100%;
    min-height: 42px;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 6px;
    background: #08090c;
    color: #f4f1ea;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 760;
  }

  .filter-clear {
    width: 100%;
    min-height: 42px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.035);
    color: rgba(244,241,234,.78);
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
  }

  .filter-clear:hover {
    border-color: rgba(206,255,53,.35);
    color: var(--hc-lime);
  }

  .templates-results {
    min-width: 0;
  }

  .templates-results-toolbar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 16px;
  }

  .templates-results-toolbar h2 {
    margin: 0;
    color: #f7f4ed;
    font-size: 34px;
    line-height: 1.05;
    font-weight: 950;
    letter-spacing: 0;
  }

  .templates-results-toolbar p {
    margin: 7px 0 0;
    color: rgba(244,241,234,.54);
    font-size: 14px;
    font-weight: 640;
  }

  .templates-toolbar-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .templates-toolbar-controls select {
    width: 230px;
  }

  .view-toggle {
    width: 44px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 6px;
    background: rgba(255,255,255,.035);
    color: rgba(244,241,234,.54);
    font-size: 19px;
    font-weight: 900;
  }

  .view-toggle.is-active {
    border-color: rgba(206,255,53,.2);
    background: rgba(206,255,53,.13);
    color: var(--hc-lime);
  }

  .template-category-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 28px;
  }

  .template-category-strip button {
    min-width: 76px;
    min-height: 36px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.13);
    background: rgba(255,255,255,.025);
    color: rgba(244,241,234,.64);
    padding: 0 18px;
    font-size: 14px;
    font-weight: 780;
    cursor: pointer;
  }

  .template-category-strip button.active {
    border-color: var(--hc-lime);
    background: rgba(206,255,53,.09);
    color: var(--hc-lime);
  }

  .template-market-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 18px;
  }

  .template-market-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.13);
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(18,19,24,.92), rgba(12,13,17,.94));
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
  }

  .template-market-card:hover {
    transform: translateY(-4px);
    border-color: rgba(206,255,53,.34);
    background: linear-gradient(180deg, rgba(23,24,30,.96), rgba(12,13,17,.98));
  }

  .template-market-cover {
    position: relative;
    display: block;
    aspect-ratio: 1.08 / 1;
    overflow: hidden;
    color: inherit;
    text-decoration: none;
    background: #0d0f14;
  }

  .template-market-cover img,
  .template-generated-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 220ms ease;
  }

  .template-market-card:hover .template-market-cover img,
  .template-market-card:hover .template-generated-cover {
    transform: scale(1.035);
  }

  .template-generated-cover {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 14px;
  }

  .template-generated-cover::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 36% 72%, rgba(255,255,255,.22), transparent 24%),
      linear-gradient(180deg, transparent 48%, rgba(0,0,0,.36));
  }

  .template-generated-cover span {
    position: relative;
    z-index: 1;
    border-radius: 999px;
    background: rgba(8,9,12,.72);
    color: #f4f1ea;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 850;
  }

  .template-market-body {
    padding: 18px 16px 16px;
  }

  .template-market-title {
    display: block;
    min-height: 52px;
    color: #f7f4ed;
    text-decoration: none;
    font-size: 21px;
    line-height: 1.24;
    font-weight: 930;
    letter-spacing: 0;
  }

  .template-market-title:hover {
    color: var(--hc-lime);
  }

  .template-market-tags {
    min-height: 30px;
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 12px;
  }

  .template-market-tags span {
    border-radius: 999px;
    background: rgba(255,255,255,.065);
    color: rgba(244,241,234,.62);
    padding: 6px 9px;
    font-size: 11px;
    line-height: 1;
    font-weight: 780;
  }

  .template-market-producer-row {
    min-height: 24px;
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 12px;
    color: rgba(244,241,234,.66);
    font-size: 12px;
    font-weight: 760;
  }

  .template-market-producer-row img,
  .template-market-producer-row > span:first-child {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(206,255,53,.28), rgba(82,214,198,.12));
    border: 1px solid rgba(255,255,255,.12);
    object-fit: cover;
  }

  .template-market-producer-row a,
  .template-market-producer-row span {
    min-width: 0;
    color: inherit;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .template-market-producer-row b {
    width: 10px;
    height: 10px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--hc-lime);
    box-shadow: 0 0 12px rgba(206,255,53,.45);
  }

  .template-license {
    width: fit-content;
    margin-top: 15px;
    color: rgba(244,241,234,.70);
    font-size: 12px;
    font-weight: 800;
  }

  .template-market-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
  }

  .template-market-bottom strong {
    color: var(--hc-lime);
    font-size: 22px;
    line-height: 1;
    font-weight: 950;
  }

  .template-market-bottom button {
    min-height: 36px;
    border: 1px solid rgba(206,255,53,.42);
    border-radius: 6px;
    background: rgba(206,255,53,.08);
    color: var(--hc-lime);
    padding: 0 16px;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    white-space: nowrap;
  }

  .template-market-bottom button:hover {
    background: var(--hc-lime);
    color: #08090c;
  }

  .templates-pagination {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 34px;
  }

  .templates-pagination button {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.14);
    background: #111217;
    color: rgba(244,241,234,.65);
    font-size: 14px;
    font-weight: 850;
    cursor: pointer;
  }

  .templates-pagination button.active {
    background: var(--hc-lime);
    color: #08090c;
    border-color: transparent;
  }

  .templates-state {
    min-height: 320px;
    border: 1px dashed rgba(255,255,255,.18);
    border-radius: 8px;
    background:
      linear-gradient(135deg, rgba(206,255,53,.055), rgba(82,214,198,.03) 44%, rgba(255,90,61,.04)),
      rgba(255,255,255,.025);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 11px;
    padding: 32px;
    text-align: center;
  }

  .templates-state span {
    border-radius: 999px;
    border: 1px solid rgba(206,255,53,.28);
    background: rgba(206,255,53,.09);
    color: var(--hc-lime);
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .templates-state h3 {
    margin: 0;
    color: #f7f4ed;
    font-size: 22px;
    font-weight: 900;
  }

  .templates-state p {
    margin: 0;
    color: rgba(244,241,234,.64);
    font-size: 14px;
  }

  .templates-state button {
    min-height: 38px;
    border-radius: 6px;
    border: 1px solid rgba(206,255,53,.32);
    background: rgba(206,255,53,.1);
    color: var(--hc-lime);
    padding: 0 18px;
    margin-top: 8px;
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
  }

  @media (max-width: 1680px) {
    .templates-market-shell {
      width: min(1500px, calc(100% - 88px));
    }

    .template-market-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 1220px) {
    .templates-market-shell {
      width: min(100% - 56px, 1040px);
    }

    .templates-hero {
      grid-template-columns: 1fr;
      min-height: 430px;
    }

    .templates-hero-copy {
      padding-left: 0;
      padding-top: 58px;
    }

    .templates-hero-art {
      position: absolute;
      inset: auto -100px 0 24%;
      min-height: 250px;
      opacity: .54;
    }

    .templates-workspace {
      grid-template-columns: 238px minmax(0, 1fr);
      gap: 28px;
    }

    .template-market-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 920px) {
    .templates-market-shell {
      width: min(100% - 40px, 720px);
    }

    .templates-hero {
      min-height: 470px;
    }

    .templates-hero-actions {
      align-items: stretch;
      flex-direction: column;
      gap: 16px;
    }

    .templates-hero-stat::after {
      display: none;
    }

    .templates-workspace {
      grid-template-columns: 1fr;
    }

    .templates-filter {
      position: static;
      padding: 18px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      background: rgba(255,255,255,.025);
    }

    .templates-results-toolbar {
      align-items: start;
      flex-direction: column;
    }

    .templates-toolbar-controls {
      width: 100%;
    }

    .templates-toolbar-controls select {
      width: 100%;
    }

    .template-market-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 620px) {
    .templates-market-shell {
      width: calc(100vw - 28px);
      max-width: 560px;
    }

    .templates-hero {
      width: 100%;
      min-height: 430px;
    }

    .templates-hero h1 {
      font-size: 42px;
    }

    .templates-hero p {
      width: calc(100vw - 56px);
      max-width: calc(100vw - 56px);
      font-size: 15px;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }

    .templates-primary-action {
      width: 100%;
    }

    .template-category-strip {
      gap: 8px;
    }

    .template-category-strip button {
      min-width: 0;
      padding: 0 12px;
    }

    .template-market-grid {
      grid-template-columns: 1fr;
    }
  }
`;
