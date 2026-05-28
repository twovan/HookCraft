'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCartStore } from '@/store/cartStore';

interface OrderResult {
  order_id: string;
  total_amount: number;
  purchased: Array<{ template_id: string; name: string; price: number }>;
  skipped: Array<{ template_id: string; name: string; reason: string }>;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);

  const [paying, setPaying] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = getTotal();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?redirectTo=/checkout');
    }
  }, [authLoading, user, router]);

  const handleConfirmPayment = async () => {
    if (items.length === 0) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ template_id: i.template_id })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrderResult(data);
        clearCart();
      } else {
        setError(data.error || '支付失败，请重试');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setPaying(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="checkout-page centered">
        <div className="state-card">
          <span>结算</span>
          <p>正在加载结算信息...</p>
        </div>
        <CheckoutStyles />
      </main>
    );
  }

  if (orderResult) {
    return (
      <main className="checkout-page">
        <div className="checkout-shell narrow">
          <section className="success-head">
            <span>支付完成</span>
            <h1>支付成功</h1>
            <p>订单号：{orderResult.order_id.slice(0, 8).toUpperCase()}</p>
          </section>

          <section className="panel">
            {orderResult.purchased.length > 0 && (
              <>
                <h2>已购买模板</h2>
                {orderResult.purchased.map((p) => (
                  <div key={p.template_id} className="line-item">
                    <span>{p.name}</span>
                    <strong>¥{(p.price / 100).toFixed(0)}</strong>
                  </div>
                ))}
              </>
            )}

            {orderResult.skipped.length > 0 && (
              <>
                <h2 className="muted-title">已跳过</h2>
                {orderResult.skipped.map((s) => (
                  <div key={s.template_id} className="line-item muted">
                    <span>{s.name}</span>
                    <span>{s.reason}</span>
                  </div>
                ))}
              </>
            )}

            <div className="total-line">
              <span>总计</span>
              <strong>¥{(orderResult.total_amount / 100).toFixed(0)}</strong>
            </div>
          </section>

          <div className="action-row">
            <Link href="/studio" className="hc-button hc-button-primary">开始创作</Link>
            <Link href="/templates" className="hc-button hc-button-ghost">继续浏览</Link>
          </div>
        </div>
        <CheckoutStyles />
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="checkout-shell">
        <nav className="breadcrumb" aria-label="当前位置">
          <Link href="/">首页</Link>
          <span>/</span>
          <Link href="/cart">购物车</Link>
          <span>/</span>
          <strong>结算</strong>
        </nav>

        <header className="checkout-header">
          <span>安全结算</span>
          <h1>结算</h1>
          <p>确认购买后，模板会立即解锁到你的账号中。</p>
        </header>

        {items.length === 0 ? (
          <section className="empty-card">
            <span>空购物车</span>
            <h2>购物车为空</h2>
            <p>请先添加模板到购物车。</p>
            <Link href="/templates" className="hc-button hc-button-primary">浏览模板</Link>
          </section>
        ) : (
          <section className="checkout-grid">
            <div>
              <h2>订单摘要</h2>
              <div className="panel">
                {items.map((item) => (
                  <div key={item.template_id} className="line-item">
                    <span>{item.name}</span>
                    <strong>¥{(item.price / 100).toFixed(0)}</strong>
                  </div>
                ))}
                <div className="total-line">
                  <span>总计</span>
                  <strong>¥{(total / 100).toFixed(0)}</strong>
                </div>
              </div>
            </div>

            <div>
              <h2>确认支付</h2>
              <div className="panel confirm-panel">
                <p>
                  点击下方按钮确认购买 {items.length} 个模板，总计 ¥{(total / 100).toFixed(0)}。
                  购买后可在工作台的“已购”模板中使用它们进行 AI 创作。
                </p>

                {error && <div className="error-box">{error}</div>}

                <button onClick={handleConfirmPayment} disabled={paying} className="pay-button">
                  {paying ? '支付中...' : `确认支付 ¥${(total / 100).toFixed(0)}`}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
      <CheckoutStyles />
    </main>
  );
}

function CheckoutStyles() {
  return (
    <style>{`
      .checkout-page {
        min-height: 100vh;
        background:
          radial-gradient(circle at 10% 12%, rgba(206,255,53,.10), transparent 300px),
          radial-gradient(circle at 88% 20%, rgba(82,214,198,.08), transparent 340px),
          var(--hc-bg);
        color: var(--hc-text);
        padding: 42px 22px 72px;
      }

      .checkout-page.centered {
        display: grid;
        place-items: center;
      }

      .checkout-shell {
        max-width: 1180px;
        margin: 0 auto;
      }

      .checkout-shell.narrow {
        max-width: 820px;
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

      .checkout-header,
      .success-head {
        margin-bottom: 28px;
      }

      .checkout-header span,
      .success-head span,
      .empty-card span,
      .state-card span {
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .1em;
        text-transform: uppercase;
      }

      .checkout-header h1,
      .success-head h1 {
        margin: 8px 0;
        font-size: clamp(40px, 6vw, 70px);
        line-height: 1;
      }

      .checkout-header p,
      .success-head p,
      .confirm-panel p,
      .empty-card p,
      .state-card p {
        color: var(--hc-muted);
        line-height: 1.75;
      }

      .checkout-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 22px;
        align-items: start;
      }

      .checkout-grid h2,
      .panel h2 {
        margin: 0 0 14px;
        font-size: 20px;
      }

      .panel,
      .empty-card,
      .state-card {
        border: 1px solid var(--hc-line);
        background: rgba(24,26,34,.88);
        border-radius: var(--hc-radius-lg);
        box-shadow: var(--hc-shadow);
      }

      .panel {
        padding: 24px;
      }

      .line-item {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 13px 0;
        border-bottom: 1px solid var(--hc-line);
        color: var(--hc-text);
      }

      .line-item strong,
      .total-line strong {
        color: var(--hc-lime);
      }

      .line-item.muted,
      .muted-title {
        color: var(--hc-muted);
      }

      .total-line {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding-top: 18px;
        margin-top: 6px;
        font-size: 20px;
        font-weight: 950;
      }

      .confirm-panel p {
        margin: 0 0 20px;
      }

      .pay-button {
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 15px 20px;
        background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
        color: #08090c;
        font-size: 16px;
        font-weight: 950;
        cursor: pointer;
      }

      .pay-button:disabled {
        cursor: not-allowed;
        opacity: .58;
      }

      .error-box {
        margin-bottom: 16px;
        border: 1px solid rgba(255,90,61,.34);
        border-radius: 12px;
        background: rgba(255,90,61,.1);
        color: #ff8b76;
        padding: 12px 14px;
        font-size: 14px;
        font-weight: 800;
      }

      .empty-card,
      .state-card {
        max-width: 560px;
        margin: 8vh auto 0;
        padding: 34px;
        text-align: center;
      }

      .empty-card h2 {
        margin: 10px 0;
        font-size: 30px;
      }

      .empty-card .hc-button {
        margin-top: 18px;
      }

      .action-row {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 26px;
      }

      @media (max-width: 820px) {
        .checkout-page {
          padding: 28px 14px 56px;
        }

        .checkout-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
