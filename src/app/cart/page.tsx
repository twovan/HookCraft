'use client';

import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const getTotal = useCartStore((s) => s.getTotal);
  const getCount = useCartStore((s) => s.getCount);

  const total = getTotal();
  const count = getCount();

  const handleRemove = (templateId: string, name: string) => {
    const confirmed = window.confirm(`确定要从购物车中删除「${name}」吗？`);
    if (confirmed) removeItem(templateId);
  };

  return (
    <main className="cart-page">
      <div className="cart-shell">
        <nav className="breadcrumb" aria-label="当前位置">
          <Link href="/">首页</Link>
          <span>/</span>
          <strong>购物车</strong>
        </nav>

        <header className="cart-header">
          <div>
            <span>模板购物车</span>
            <h1>购物车</h1>
            <p>{count > 0 ? `${count} 个模板等待结算。` : '还没有加入模板。'}</p>
          </div>
          {count > 0 && <Link href="/templates" className="hc-button hc-button-ghost">继续浏览</Link>}
        </header>

        {count === 0 ? (
          <section className="empty-card">
            <span>空购物车</span>
            <h2>先挑一个能开工的模板</h2>
            <p>浏览签约制作人的 Hook、风格标签和可购买模板，选好后再统一结算。</p>
            <div className="empty-actions">
              <Link href="/templates" className="hc-button hc-button-primary">浏览模板市场</Link>
              <Link href="/studio" className="hc-button hc-button-ghost">去工作台</Link>
            </div>
          </section>
        ) : (
          <section className="cart-grid">
            <div className="item-list">
              {items.map((item) => (
                <article key={item.template_id} className="cart-item">
                  <div
                    className="item-cover"
                    style={item.cover_url ? { backgroundImage: `url(${item.cover_url})` } : undefined}
                  />
                  <div className="item-main">
                    <h3>{item.name}</h3>
                    <span>{item.genre}</span>
                  </div>
                  <div className="item-actions">
                    <strong>¥{(item.price / 100).toFixed(0)}</strong>
                    <button onClick={() => handleRemove(item.template_id, item.name)}>删除</button>
                  </div>
                </article>
              ))}
            </div>

            <aside className="summary-card">
              <h2>订单摘要</h2>
              <div className="summary-row">
                <span>小计 ({count} 件)</span>
                <strong>¥{(total / 100).toFixed(0)}</strong>
              </div>
              <div className="summary-total">
                <span>总计</span>
                <strong>¥{(total / 100).toFixed(0)}</strong>
              </div>
              <Link href="/checkout" className="hc-button hc-button-primary">去结算</Link>
              <Link href="/templates" className="hc-button hc-button-ghost">继续购物</Link>
            </aside>
          </section>
        )}
      </div>

      <style>{`
        .cart-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 10% 12%, rgba(206,255,53,.10), transparent 300px),
            radial-gradient(circle at 88% 20%, rgba(82,214,198,.08), transparent 340px),
            var(--hc-bg);
          color: var(--hc-text);
          padding: 42px 22px 72px;
        }

        .cart-shell {
          max-width: 1180px;
          margin: 0 auto;
        }

        .breadcrumb {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 24px;
          color: var(--hc-muted);
          font-size: 13px;
        }

        .breadcrumb a {
          color: var(--hc-muted);
          text-decoration: none;
        }

        .breadcrumb strong {
          color: var(--hc-text);
        }

        .cart-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
          margin-bottom: 26px;
        }

        .cart-header span,
        .empty-card span {
          color: var(--hc-lime);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .cart-header h1 {
          margin: 8px 0;
          font-size: clamp(38px, 6vw, 66px);
          line-height: 1;
          letter-spacing: 0;
        }

        .cart-header p,
        .empty-card p,
        .summary-row {
          color: var(--hc-muted);
        }

        .cart-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 22px;
          align-items: start;
        }

        .item-list {
          display: grid;
          gap: 14px;
        }

        .cart-item,
        .summary-card,
        .empty-card {
          border: 1px solid var(--hc-line);
          background: rgba(24,26,34,.88);
          border-radius: var(--hc-radius-lg);
          box-shadow: var(--hc-shadow);
        }

        .cart-item {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 18px;
        }

        .item-cover {
          width: 96px;
          height: 96px;
          flex: 0 0 auto;
          border-radius: 14px;
          border: 1px solid var(--hc-line);
          background: linear-gradient(135deg, rgba(206,255,53,.18), rgba(82,214,198,.10) 48%, rgba(255,90,61,.12));
          background-size: cover;
          background-position: center;
        }

        .item-main {
          min-width: 0;
          flex: 1;
        }

        .item-main h3 {
          margin: 0 0 8px;
          color: var(--hc-text);
          font-size: 17px;
        }

        .item-main span {
          display: inline-flex;
          border: 1px solid rgba(206,255,53,.28);
          border-radius: 999px;
          background: rgba(206,255,53,.1);
          color: var(--hc-lime);
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .item-actions {
          text-align: right;
        }

        .item-actions strong,
        .summary-total strong {
          color: var(--hc-lime);
          font-size: 26px;
        }

        .item-actions button {
          display: block;
          margin-top: 10px;
          border: 1px solid var(--hc-line);
          border-radius: 999px;
          background: transparent;
          color: var(--hc-muted);
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .summary-card {
          position: sticky;
          top: 96px;
          display: grid;
          gap: 14px;
          padding: 24px;
        }

        .summary-card h2 {
          margin: 0 0 6px;
          font-size: 20px;
        }

        .summary-row,
        .summary-total {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 0;
          border-top: 1px solid var(--hc-line);
        }

        .summary-total {
          color: var(--hc-text);
          font-size: 18px;
          font-weight: 950;
        }

        .empty-card {
          max-width: 560px;
          margin: 4vh auto 0;
          padding: 34px;
          text-align: center;
        }

        .empty-card h2 {
          margin: 10px 0;
          font-size: 30px;
        }

        .empty-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .empty-actions .hc-button {
          min-width: 142px;
        }

        .empty-actions .hc-button-ghost {
          border-color: var(--hc-line);
          background: rgba(255,255,255,.04);
          color: var(--hc-text);
        }

        @media (max-width: 860px) {
          .cart-page {
            padding: 28px 14px 56px;
          }

          .cart-header,
          .cart-grid {
            grid-template-columns: 1fr;
          }

          .cart-header {
            align-items: stretch;
            flex-direction: column;
          }

          .summary-card {
            position: static;
          }
        }

        @media (max-width: 560px) {
          .empty-card {
            padding: 28px 20px;
          }

          .empty-actions .hc-button {
            width: 100%;
          }

          .cart-item {
            align-items: flex-start;
            flex-direction: column;
          }

          .item-cover,
          .item-actions {
            width: 100%;
          }

          .item-actions {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
