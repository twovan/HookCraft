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

  // Auth check: redirect to login if not authenticated
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

  // Show nothing while checking auth
  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#999', fontSize: 14 }}>加载中...</span>
      </div>
    );
  }

  // Order success page
  if (orderResult) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,165,116,0.03) 0%, transparent 50%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
        <main style={{ maxWidth: 800, margin: '0 auto', padding: 48, position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#2D2D2D', fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>
              支付成功
            </h1>
            <p style={{ color: '#6B6B6B', fontSize: 15 }}>
              订单号：{orderResult.order_id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <div style={{ background: 'white', padding: 32, borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)' }}>
            {orderResult.purchased.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2D2D2D', marginBottom: 16 }}>已购买模板</h3>
                {orderResult.purchased.map((p) => (
                  <div key={p.template_id} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                    borderBottom: '1px solid #F5E6D3', fontSize: 14, color: '#2D2D2D',
                  }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 500, color: '#D4A574' }}>￥{(p.price / 100).toFixed(0)}</span>
                  </div>
                ))}
              </>
            )}

            {orderResult.skipped.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#999', marginTop: 24, marginBottom: 16 }}>已跳过（之前已购买）</h3>
                {orderResult.skipped.map((s) => (
                  <div key={s.template_id} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                    borderBottom: '1px solid #f5f5f5', fontSize: 14, color: '#999',
                  }}>
                    <span>{s.name}</span>
                    <span>{s.reason}</span>
                  </div>
                ))}
              </>
            )}

            <div style={{
              display: 'flex', justifyContent: 'space-between', paddingTop: 20, marginTop: 20,
              borderTop: '2px solid #F5E6D3', fontSize: 20, fontWeight: 700,
            }}>
              <span>总计</span>
              <span style={{ color: '#D4A574' }}>￥{(orderResult.total_amount / 100).toFixed(0)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32 }}>
            <Link href="/studio" style={{
              padding: '14px 32px', borderRadius: 24,
              background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}>
              开始创作
            </Link>
            <Link href="/templates" style={{
              padding: '14px 32px', borderRadius: 24,
              border: '1px solid #D4A574', background: 'transparent', color: '#D4A574',
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}>
              继续浏览
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,165,116,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 48, position: 'relative', zIndex: 1 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>首页</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <Link href="/cart" style={{ color: '#999', textDecoration: 'none' }}>购物车</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <span style={{ color: '#2D2D2D', fontWeight: 500 }}>结算</span>
        </nav>

        <h1 style={{
          fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#2D2D2D',
          fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
          position: 'relative', display: 'inline-block',
        }}>
          结算
          <span style={{ position: 'absolute', bottom: -12, left: 0, width: 60, height: 3, background: 'linear-gradient(90deg, #D4A574, transparent)', borderRadius: 2 }} />
        </h1>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 80, marginBottom: 24, opacity: 0.6 }}>🛒</div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#2D2D2D', marginBottom: 12, fontFamily: "'Playfair Display', serif" }}>购物车为空</h2>
            <p style={{ color: '#999', fontSize: 15, marginBottom: 32 }}>请先添加模板到购物车</p>
            <Link href="/templates" style={{
              padding: '14px 36px', borderRadius: 24, background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
              color: 'white', fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}>浏览模板 →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            {/* Left - Order Summary */}
            <div>
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#2D2D2D' }}>订单摘要</h3>
              <div style={{ background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)' }}>
                {items.map((item, i) => (
                  <div key={item.template_id} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                    borderBottom: i < items.length - 1 ? '1px solid #F5E6D3' : 'none',
                    fontSize: 15, color: '#2D2D2D',
                  }}>
                    <span>{item.name}</span>
                    <span style={{ fontWeight: 500 }}>￥{(item.price / 100).toFixed(0)}</span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', paddingTop: 16,
                  fontSize: 20, fontWeight: 700, borderTop: '2px solid #F5E6D3', marginTop: 12,
                }}>
                  <span>总计</span>
                  <span style={{ color: '#D4A574' }}>￥{(total / 100).toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Right - Confirm */}
            <div>
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#2D2D2D' }}>确认支付</h3>

              <div style={{
                background: 'white', padding: 32, borderRadius: 16,
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
              }}>
                <p style={{ color: '#6B6B6B', fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
                  点击下方按钮确认购买 {items.length} 个模板，总计 ￥{(total / 100).toFixed(0)}。
                  购买后可在工作室的"已购"标签页中使用这些模板进行 AI 创作。
                </p>

                {error && (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12, marginBottom: 16,
                    background: '#fef2f2', color: '#dc2626', fontSize: 14,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConfirmPayment}
                  disabled={paying}
                  style={{
                    width: '100%', padding: 16, borderRadius: 24, border: 'none',
                    background: paying
                      ? '#ccc'
                      : 'linear-gradient(135deg, #D4A574, #C9A86A)',
                    color: 'white',
                    fontSize: 16, fontWeight: 600,
                    cursor: paying ? 'not-allowed' : 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    boxShadow: paying ? 'none' : '0 6px 20px rgba(212,165,116,0.3)',
                  }}
                >
                  {paying ? '支付中...' : `确认支付 ￥${(total / 100).toFixed(0)}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
