'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useAuth } from '@/contexts/AuthContext';

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  previewUrl?: string;
  coverUrl?: string;
  analysisStatus: string;
  price?: number;
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

const GENRES = ['Pop', 'Rock', 'EDM', 'Jazz', 'Hip-Hop', 'Classical', 'Lo-Fi'];

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
      <div className="hc-container templates-layout">
        <header className="templates-hero">
          <div>
            <h1>模板市场</h1>
            <p>从成熟 Hook、风格标签和签约制作人出发，快速进入可生成、可购买、可发布的 Demo 工作流。</p>
          </div>
          <Link href="/studio" className="hc-button">进入工作台</Link>
        </header>

        <div className="templates-workspace">
          <aside className="templates-filter" aria-label="模板筛选">
            <FilterGroup title="类型">
              {[
                { key: 'all', label: '全部' },
                { key: 'free', label: '免费模板' },
                { key: 'paid', label: '付费模板' },
              ].map((opt) => (
                <label key={opt.key} className="filter-line">
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
                <label key={genre} className="filter-line">
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

            <button type="button" onClick={clearFilters} className="filter-clear">清除筛选</button>
          </aside>

          <section className="templates-results">
            <div className="templates-results-head">
              <div>
                <h2>全部模板</h2>
                <p>{loading ? '正在同步模板...' : `${filteredTemplates.length} 个结果`}</p>
              </div>
              <div className="active-filters">
                {categoryFilter !== 'all' && <span>{categoryFilter === 'free' ? '免费' : '付费'}</span>}
                {selectedGenres.map((genre) => <span key={genre}>{genre}</span>)}
              </div>
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

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
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
  action?: React.ReactNode;
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
  const price = template.price ? Math.round(template.price / 100) : 0;
  const isFree = template.category === 'free_template';
  const actionText = isPurchased ? '去创作' : isFree ? '立即使用' : '加入购物车';
  const priceText = isPurchased ? '已购' : isFree ? '免费' : price > 0 ? `￥${price}` : '待定价';

  const handleAction = (event: React.MouseEvent<HTMLButtonElement>) => {
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
        {template.coverUrl && template.coverUrl.startsWith('http') ? (
          <img src={template.coverUrl} alt={template.name} />
        ) : (
          <div className="template-generated-cover" style={{ background: getGradient(template.name) }}>
            <span>{template.genre || 'Hook'}</span>
            <div>
              {Array.from({ length: 16 }).map((_, index) => <i key={index} />)}
            </div>
          </div>
        )}
        <span className="template-audition">试听</span>
      </Link>

      <div className="template-market-body">
        <div className="template-market-meta">
          <span>{template.genre || 'Style'}</span>
          <span>{isFree ? '免费' : '付费'}</span>
        </div>
        <Link href={`/templates/${template.id}`} className="template-market-title">{template.name}</Link>
        {template.producerName && template.producerId && (
          <Link href={`/producers/${template.producerId}`} className="template-market-producer">
            来自 {template.producerName}
          </Link>
        )}
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
    padding: 48px 0 90px;
  }

  .templates-layout {
    display: flex;
    flex-direction: column;
    gap: 34px;
  }

  .templates-hero {
    min-height: 250px;
    border: 1px solid var(--hc-border);
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(206,255,53,.1), rgba(82,214,198,.05) 46%, rgba(255,90,61,.08));
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 28px;
    padding: clamp(28px, 5vw, 52px);
  }

  .templates-hero h1 {
    margin: 0;
    color: var(--hc-text);
    font-size: 56px;
    line-height: 1.02;
    font-weight: 900;
    letter-spacing: 0;
  }

  .templates-hero p {
    max-width: 690px;
    margin: 18px 0 0;
    color: var(--hc-text-muted);
    font-size: 16px;
    line-height: 1.75;
  }

  .templates-workspace {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .templates-filter {
    position: sticky;
    top: 94px;
    border: 1px solid var(--hc-border);
    border-radius: 14px;
    background: var(--hc-panel);
    padding: 20px;
  }

  .filter-group {
    padding-bottom: 18px;
    margin-bottom: 18px;
    border-bottom: 1px solid rgba(255,255,255,.08);
  }

  .filter-group h3 {
    margin: 0 0 12px;
    color: var(--hc-text);
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .filter-line {
    min-height: 32px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--hc-text-muted);
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
  }

  .filter-line input {
    accent-color: var(--hc-lime);
  }

  .filter-line:has(input:checked) {
    color: var(--hc-lime);
  }

  .filter-select {
    width: 100%;
    min-height: 40px;
    border: 1px solid var(--hc-border);
    border-radius: 8px;
    background: #0b0c10;
    color: var(--hc-text);
    padding: 0 10px;
    font-size: 13px;
    font-weight: 700;
  }

  .filter-clear,
  .templates-state button {
    width: 100%;
    min-height: 40px;
    border-radius: 999px;
    border: 1px solid var(--hc-border);
    background: rgba(255,255,255,.04);
    color: var(--hc-text);
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
  }

  .templates-results {
    min-width: 0;
  }

  .templates-results-head {
    min-height: 58px;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 20px;
  }

  .templates-results-head h2 {
    margin: 0;
    color: var(--hc-text);
    font-size: 30px;
    line-height: 1.1;
    font-weight: 900;
    letter-spacing: 0;
  }

  .templates-results-head p {
    margin: 7px 0 0;
    color: var(--hc-text-muted);
    font-size: 13px;
  }

  .active-filters {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 7px;
  }

  .active-filters span {
    border-radius: 999px;
    border: 1px solid rgba(206,255,53,.22);
    background: rgba(206,255,53,.08);
    color: var(--hc-lime);
    padding: 6px 9px;
    font-size: 11px;
    font-weight: 850;
  }

  .template-market-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }

  .template-market-card {
    min-width: 0;
    border: 1px solid var(--hc-border);
    border-radius: 14px;
    background: var(--hc-panel);
    overflow: hidden;
    transition: transform 160ms ease, border-color 160ms ease;
  }

  .template-market-card:hover {
    transform: translateY(-3px);
    border-color: var(--hc-border-strong);
  }

  .template-market-cover {
    position: relative;
    display: block;
    aspect-ratio: 1;
    overflow: hidden;
    color: inherit;
    text-decoration: none;
  }

  .template-market-cover img,
  .template-generated-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .template-generated-cover {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 14px;
  }

  .template-generated-cover span {
    width: fit-content;
    border-radius: 999px;
    background: rgba(8,9,12,.76);
    color: var(--hc-text);
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 850;
  }

  .template-generated-cover div {
    height: 46px;
    display: flex;
    align-items: end;
    gap: 4px;
  }

  .template-generated-cover i {
    flex: 1;
    border-radius: 999px;
    background: rgba(8,9,12,.72);
  }

  .template-generated-cover i:nth-child(4n+1) { height: 36%; }
  .template-generated-cover i:nth-child(4n+2) { height: 78%; }
  .template-generated-cover i:nth-child(4n+3) { height: 54%; }
  .template-generated-cover i:nth-child(4n) { height: 92%; }

  .template-audition {
    position: absolute;
    right: 12px;
    bottom: 12px;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: var(--hc-lime);
    color: #08090c;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 900;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 160ms ease, transform 160ms ease;
  }

  .template-market-card:hover .template-audition {
    opacity: 1;
    transform: translateY(0);
  }

  .template-market-body {
    padding: 15px;
  }

  .template-market-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-bottom: 10px;
  }

  .template-market-meta span {
    border-radius: 999px;
    background: rgba(255,255,255,.06);
    color: var(--hc-text-muted);
    padding: 5px 9px;
    font-size: 11px;
    font-weight: 850;
  }

  .template-market-title {
    display: block;
    min-height: 44px;
    color: var(--hc-text);
    text-decoration: none;
    font-size: 16px;
    line-height: 1.36;
    font-weight: 850;
  }

  .template-market-producer {
    display: inline-block;
    margin-top: 8px;
    color: var(--hc-text-muted);
    text-decoration: none;
    font-size: 12px;
    font-weight: 750;
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
    font-size: 18px;
    font-weight: 900;
  }

  .template-market-bottom button {
    min-height: 34px;
    border: 1px solid rgba(206,255,53,.22);
    border-radius: 999px;
    background: rgba(206,255,53,.1);
    color: var(--hc-lime);
    padding: 0 12px;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
    white-space: nowrap;
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
    border-radius: 8px;
    border: 1px solid var(--hc-border);
    background: #111217;
    color: var(--hc-text-muted);
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
    min-height: 280px;
    border: 1px dashed var(--hc-border-strong);
    border-radius: 14px;
    background:
      linear-gradient(135deg, rgba(206,255,53,.06), rgba(82,214,198,.035) 44%, rgba(255,90,61,.04)),
      rgba(255,255,255,.03);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 28px;
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
    color: var(--hc-text);
    font-size: 20px;
    font-weight: 900;
  }

  .templates-state p {
    margin: 0;
    color: var(--hc-text-muted);
    font-size: 14px;
  }

  .templates-state button {
    width: auto;
    padding: 0 18px;
    margin-top: 8px;
  }

  @media (max-width: 1180px) {
    .template-market-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 920px) {
    .templates-page {
      padding-top: 28px;
    }

    .templates-hero,
    .templates-workspace {
      grid-template-columns: 1fr;
    }

    .templates-filter {
      position: static;
    }
  }

  @media (max-width: 640px) {
    .templates-hero {
      min-height: 0;
      align-items: start;
    }

    .templates-hero h1 {
      font-size: 38px;
    }

    .template-market-grid {
      grid-template-columns: 1fr;
    }

    .templates-results-head {
      align-items: start;
      flex-direction: column;
    }

    .active-filters {
      justify-content: flex-start;
    }
  }
`;
