'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCartStore } from '@/store/cartStore';

interface TemplateDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  previewUrl?: string;
  coverUrl?: string;
  analysisResult?: string;
  analysisStatus: string;
  price?: number;
  salesCount?: number;
  producerId?: string;
  producerName?: string;
  producerAvatarUrl?: string;
}

interface RelatedTemplate {
  id: string;
  name: string;
  category: string;
  genre: string;
  price?: number;
}

const TEMPLATE_GRADIENTS = [
  'linear-gradient(135deg, #ceff35 0%, #52d6c6 48%, #15181f 100%)',
  'linear-gradient(135deg, #ff5a3d 0%, #f5c542 44%, #15181f 100%)',
  'linear-gradient(135deg, #52d6c6 0%, #8b5cf6 48%, #15181f 100%)',
  'linear-gradient(135deg, #f5c542 0%, #ceff35 42%, #15181f 100%)',
  'linear-gradient(135deg, #ff5a3d 0%, #52d6c6 50%, #15181f 100%)',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TEMPLATE_GRADIENTS[Math.abs(hash) % TEMPLATE_GRADIENTS.length];
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

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const addItem = useCartStore((s) => s.addItem);
  const hasItem = useCartStore((s) => s.hasItem);

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [related, setRelated] = useState<RelatedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRelated, setHoveredRelated] = useState<string | null>(null);
  const [isPurchased, setIsPurchased] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const loadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/api/templates/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? '模板不存在' : '加载失败，请重试');
        return;
      }
      const data = await res.json();
      setTemplate(data.template);
      setRelated(data.related || []);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadTemplate();
  }, [id]);

  useEffect(() => {
    async function checkPurchased() {
      if (!user || !id) return;
      try {
        const res = await fetchWithTimeout('/api/templates/purchased');
        if (res.ok) {
          const data = await res.json();
          const purchased = (data.templates || []).some((t: { id: string }) => t.id === id);
          setIsPurchased(purchased);
        }
      } catch {
        // Purchase state is a convenience check; the primary actions still guard on the server.
      }
    }
    checkPurchased();
  }, [user, id]);

  const handlePurchase = async () => {
    if (!user) {
      router.push(`/login?redirectTo=/templates/${id}`);
      return;
    }
    setPurchasing(true);
    setPurchaseMessage(null);
    try {
      const res = await fetchWithTimeout(`/api/templates/${id}/purchase`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIsPurchased(true);
        setPurchaseMessage('购买成功，已解锁模板');
      } else {
        setPurchaseMessage(data.error || '购买失败');
      }
    } catch {
      setPurchaseMessage('网络错误，请重试');
    } finally {
      setPurchasing(false);
      window.setTimeout(() => setPurchaseMessage(null), 3000);
    }
  };

  const handleAddToCart = () => {
    if (!template) return;
    const result = addItem({
      template_id: template.id,
      name: template.name,
      price: template.price || 0,
      cover_url: template.coverUrl || null,
      genre: template.genre,
      added_at: new Date().toISOString(),
    });
    setCartMessage(result.message || null);
    window.setTimeout(() => setCartMessage(null), 3000);
  };

  if (loading) {
    return (
      <main className="template-detail-page">
        <div className="state-card">
          <div className="state-kicker">正在加载模板</div>
          <p>正在加载模板详情...</p>
          <div className="state-bar" />
        </div>
        <TemplateDetailStyles />
      </main>
    );
  }

  if (error || !template) {
    return (
      <main className="template-detail-page">
        <div className="state-card">
          <div className="state-kicker">模板暂不可用</div>
          <h1>{error || '模板不存在'}</h1>
          <p>请稍后重试，或返回模板市场继续浏览。</p>
          <div className="state-actions">
            <button className="hc-button hc-button-primary" onClick={loadTemplate}>
              重试
            </button>
            <Link className="hc-button hc-button-ghost" href="/templates">
              返回模板市场
            </Link>
          </div>
        </div>
        <TemplateDetailStyles />
      </main>
    );
  }

  const gradient = getGradient(template.name);
  const price = template.price ? Math.round(template.price / 100) : 0;
  const isPaidTemplate = template.category === 'paid_template' && price > 0;
  const inCart = hasItem(template.id);
  const tags = [template.category === 'free_template' ? '免费模板' : '付费模板', template.genre].filter(Boolean);
  const successMessage = purchaseMessage?.includes('成功') || cartMessage?.includes('加入') || cartMessage?.includes('已在');

  return (
    <main className="template-detail-page">
      <div className="detail-container">
        <nav className="breadcrumb" aria-label="当前位置">
          <Link href="/">首页</Link>
          <span>/</span>
          <Link href="/templates">模板市场</Link>
          <span>/</span>
          <strong>{template.name}</strong>
        </nav>

        <section className="hero-grid">
          <aside className="cover-panel">
            <div className="cover-frame">
              {template.coverUrl ? (
                <Image src={template.coverUrl} alt={template.name} fill priority style={{ objectFit: 'cover' }} sizes="(max-width: 900px) 100vw, 430px" />
              ) : (
                <div className="gradient-cover" style={{ background: gradient }} />
              )}
              <div className="cover-overlay">
                <span>{template.genre || '模板风格'}</span>
                <strong>{price > 0 ? `¥${price}` : '免费'}</strong>
              </div>
            </div>
            <div className="signal-strip" aria-hidden="true">
              {Array.from({ length: 32 }).map((_, i) => (
                <span key={i} style={{ height: `${28 + ((i * 17) % 54)}%` }} />
              ))}
            </div>
          </aside>

          <section className="detail-stack">
            <div className="label-row">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <h1>{template.name}</h1>
            <p className="lead">{template.description}</p>

            <div className="action-panel">
              <div>
                <div className="price">{price > 0 ? `¥${price}` : '免费'}</div>
                <p>{isPaidTemplate && !isPurchased ? '购买后可在工作台直接套用模板生成。' : '已可直接进入工作台创作。'}</p>
              </div>
              <div className="action-buttons">
                {isPaidTemplate && !isPurchased ? (
                  <>
                    <button className="hc-button hc-button-primary" onClick={handlePurchase} disabled={purchasing}>
                      {purchasing ? '购买中...' : '购买模板'}
                    </button>
                    <button className="hc-button hc-button-ghost" onClick={handleAddToCart} disabled={inCart}>
                      {inCart ? '已在购物车' : '加入购物车'}
                    </button>
                  </>
                ) : (
                  <Link className="hc-button hc-button-primary" href={`/studio?templateId=${template.id}`}>
                    使用此模板创作
                  </Link>
                )}
              </div>
            </div>

            {(purchaseMessage || cartMessage) && (
              <div className={successMessage ? 'message success' : 'message error'}>
                {purchaseMessage || cartMessage}
              </div>
            )}

            <div className="info-grid">
              <InfoCell label="风格" value={template.genre || '未标记'} />
              <InfoCell label="分类" value={template.category === 'free_template' ? '免费模板' : '付费模板'} />
              <InfoCell label="销量" value={`${template.salesCount || 0}`} />
              <InfoCell label="分析状态" value={template.analysisStatus || 'ready'} />
            </div>

            {template.producerId && template.producerName && (
              <Link href={`/producers/${template.producerId}`} className="producer-card">
                <div
                  className="producer-avatar"
                  style={template.producerAvatarUrl ? { backgroundImage: `url(${template.producerAvatarUrl})` } : undefined}
                >
                  {!template.producerAvatarUrl && template.producerName.charAt(0)}
                </div>
                <div>
                  <span>制作人</span>
                  <strong>{template.producerName}</strong>
                </div>
                <b>查看主页</b>
              </Link>
            )}
          </section>
        </section>

        {related.length > 0 && (
          <section className="related-section">
            <div className="section-heading">
              <span>相关模板</span>
              <h2>更多可用模板</h2>
            </div>
            <div className="related-grid">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/templates/${item.id}`}
                  className="related-card"
                  onMouseEnter={() => setHoveredRelated(item.id)}
                  onMouseLeave={() => setHoveredRelated(null)}
                  style={{ transform: hoveredRelated === item.id ? 'translateY(-4px)' : 'none' }}
                >
                  <div className="related-cover" style={{ background: getGradient(item.name) }} />
                  <div className="related-body">
                    <span>{item.genre}</span>
                    <strong>{item.name}</strong>
                    <b>{item.price && item.price > 0 ? `¥${Math.round(item.price / 100)}` : '免费'}</b>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <TemplateDetailStyles />
    </main>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TemplateDetailStyles() {
  return (
    <style>{`
      .template-detail-page {
        min-height: 100vh;
        background:
          radial-gradient(circle at 8% 12%, rgba(206, 255, 53, 0.10), transparent 280px),
          radial-gradient(circle at 92% 18%, rgba(82, 214, 198, 0.09), transparent 320px),
          var(--hc-bg);
        color: var(--hc-text);
        padding: 32px 22px 68px;
      }

      .detail-container {
        max-width: 1120px;
        margin: 0 auto;
      }

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
        color: var(--hc-muted);
        font-size: 12px;
        overflow: hidden;
        white-space: nowrap;
      }

      .breadcrumb a {
        color: var(--hc-muted);
        text-decoration: none;
      }

      .breadcrumb strong {
        color: var(--hc-text);
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: minmax(320px, 430px) minmax(0, 1fr);
        gap: 28px;
        align-items: start;
      }

      .cover-panel {
        position: sticky;
        top: 98px;
        display: grid;
        gap: 12px;
        max-width: 430px;
      }

      .cover-frame {
        position: relative;
        aspect-ratio: 1 / 1;
        border: 1px solid var(--hc-line);
        border-radius: 14px;
        overflow: hidden;
        background: var(--hc-panel);
        box-shadow: 0 20px 70px rgba(0, 0, 0, 0.34);
      }

      .cover-frame::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,.45)),
          radial-gradient(circle at 50% 52%, transparent 0 32%, rgba(0,0,0,.18) 70%);
        pointer-events: none;
      }

      .gradient-cover {
        position: absolute;
        inset: 0;
      }

      .cover-overlay {
        position: absolute;
        left: 18px;
        right: 18px;
        bottom: 18px;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: white;
        text-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      }

      .cover-overlay span {
        border: 1px solid rgba(255, 255, 255, 0.32);
        background: rgba(0, 0, 0, 0.3);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 800;
      }

      .cover-overlay strong {
        color: var(--hc-lime);
        font-size: 26px;
      }

      .signal-strip {
        height: 54px;
        display: grid;
        grid-template-columns: repeat(32, 1fr);
        align-items: end;
        gap: 3px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--hc-line);
        background: rgba(18, 20, 27, 0.74);
      }

      .signal-strip span {
        min-height: 8px;
        border-radius: 999px 999px 0 0;
        background: linear-gradient(180deg, var(--hc-lime), rgba(82, 214, 198, 0.4));
        opacity: 0.78;
      }

      .detail-stack h1 {
        margin: 10px 0 10px;
        max-width: 720px;
        font-size: clamp(30px, 4.2vw, 48px);
        line-height: 1.02;
        letter-spacing: 0;
      }

      .lead {
        margin: 0 0 18px;
        max-width: 680px;
        color: var(--hc-muted);
        font-size: 14px;
        line-height: 1.7;
      }

      .label-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .label-row span,
      .related-body span {
        border: 1px solid rgba(206, 255, 53, 0.26);
        background: rgba(206, 255, 53, 0.1);
        color: var(--hc-lime);
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .action-panel,
      .info-cell,
      .producer-card,
      .state-card,
      .related-card {
        border: 1px solid var(--hc-line);
        background: rgba(24, 26, 34, 0.86);
        box-shadow: var(--hc-shadow);
      }

      .action-panel {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        border-radius: 14px;
        padding: 16px 18px;
        margin-bottom: 12px;
        background:
          linear-gradient(135deg, rgba(24, 26, 34, .96), rgba(16, 18, 24, .92)),
          radial-gradient(circle at 86% 26%, rgba(206, 255, 53, .12), transparent 210px);
      }

      .price {
        color: var(--hc-lime);
        font-size: 30px;
        font-weight: 950;
        line-height: 1;
      }

      .action-panel p {
        margin: 6px 0 0;
        color: var(--hc-muted);
        font-size: 12px;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .action-buttons .hc-button {
        min-height: 38px;
        padding: 10px 18px;
        font-size: 12px;
      }

      .message {
        margin-bottom: 14px;
        border-radius: var(--hc-radius);
        padding: 12px 14px;
        font-size: 13px;
        font-weight: 800;
      }

      .message.success {
        border: 1px solid rgba(206, 255, 53, 0.3);
        color: var(--hc-lime);
        background: rgba(206, 255, 53, 0.09);
      }

      .message.error {
        border: 1px solid rgba(255, 90, 61, 0.34);
        color: #ff8b76;
        background: rgba(255, 90, 61, 0.1);
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .info-cell {
        border-radius: 12px;
        padding: 13px 14px;
        background: rgba(20, 22, 29, 0.78);
      }

      .info-cell span,
      .producer-card span,
      .section-heading span,
      .state-kicker {
        display: block;
        color: var(--hc-muted);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .info-cell strong {
        display: block;
        margin-top: 7px;
        color: var(--hc-text);
        font-size: 14px;
      }

      .producer-card {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 10px;
        border-radius: 12px;
        padding: 12px 14px;
        color: inherit;
        text-decoration: none;
        transition: border-color .18s ease, transform .18s ease;
      }

      .producer-card:hover {
        border-color: rgba(206, 255, 53, 0.32);
        transform: translateY(-1px);
      }

      .producer-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
        background-size: cover;
        background-position: center;
        color: #08090c;
        font-weight: 950;
      }

      .producer-card div:nth-child(2) {
        min-width: 0;
        flex: 1;
      }

      .producer-card strong {
        display: block;
        margin-top: 4px;
        color: var(--hc-text);
      }

      .producer-card b {
        color: var(--hc-lime);
        font-size: 11px;
        white-space: nowrap;
      }

      .related-section {
        margin-top: 54px;
      }

      .section-heading {
        margin-bottom: 16px;
      }

      .section-heading h2 {
        margin: 6px 0 0;
        font-size: 24px;
      }

      .related-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .related-card {
        display: block;
        border-radius: 12px;
        overflow: hidden;
        color: inherit;
        text-decoration: none;
        transition: transform .2s ease, border-color .2s ease;
      }

      .related-card:hover {
        border-color: rgba(206, 255, 53, 0.36);
      }

      .related-cover {
        aspect-ratio: 16 / 10;
      }

      .related-body {
        padding: 12px;
      }

      .related-body strong {
        display: block;
        margin: 10px 0 7px;
        color: var(--hc-text);
        font-size: 14px;
      }

      .related-body b {
        color: var(--hc-lime);
      }

      .state-card {
        width: min(520px, calc(100vw - 40px));
        margin: 14vh auto 0;
        border-radius: var(--hc-radius-lg);
        padding: 30px;
        text-align: center;
      }

      .state-card h1 {
        margin: 10px 0;
        font-size: 28px;
      }

      .state-card p {
        margin: 8px 0 0;
        color: var(--hc-muted);
      }

      .state-actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 18px;
        flex-wrap: wrap;
      }

      .state-bar {
        height: 4px;
        margin-top: 20px;
        overflow: hidden;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(255,255,255,.08), var(--hc-lime), var(--hc-cyan), rgba(255,255,255,.08));
        background-size: 240% 100%;
        animation: detail-load 1.1s ease-in-out infinite alternate;
      }

      @keyframes detail-load {
        from { background-position: 0% 50%; }
        to { background-position: 100% 50%; }
      }

      @media (max-width: 900px) {
        .template-detail-page {
          padding: 26px 16px 56px;
        }

        .hero-grid {
          grid-template-columns: 1fr;
        }

        .cover-panel {
          position: relative;
          top: auto;
          width: min(100%, 380px);
          margin: 0 auto;
        }

        .action-panel {
          align-items: flex-start;
          flex-direction: column;
        }

        .action-buttons,
        .action-buttons .hc-button {
          width: 100%;
        }

        .related-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 560px) {
        .cover-panel {
          width: min(100%, 340px);
        }

        .info-grid,
        .related-grid {
          grid-template-columns: 1fr;
        }

        .detail-stack h1 {
          font-size: 32px;
        }
      }
    `}</style>
  );
}
