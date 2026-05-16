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
    if (confirmed) {
      removeItem(templateId);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(117, 54, 213,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(117, 54, 213,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 48, position: 'relative', zIndex: 1 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>首页</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <span style={{ color: '#e8e8f0', fontWeight: 500 }}>购物车</span>
        </nav>

        <h1 style={{
          fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#e8e8f0',
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif", letterSpacing: -0.5,
          position: 'relative', display: 'inline-block',
        }}>
          购物车 ({count} 件)
          <span style={{ position: 'absolute', bottom: -12, left: 0, width: 60, height: 3, background: 'linear-gradient(90deg, #7536d5, transparent)', borderRadius: 2 }} />
        </h1>

        {count === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 80, marginBottom: 24, opacity: 0.6 }}>🛒</div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#e8e8f0', marginBottom: 12, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>购物车是空的</h2>
            <p style={{ color: '#999', fontSize: 15, marginBottom: 32 }}>快去发现你喜欢的音乐模板吧</p>
            <Link href="/templates" style={{
              padding: '14px 36px', borderRadius: 24, background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
              color: 'white', fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}>浏览模板 →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32 }}>
            {/* Cart Items */}
            <div>
              {items.map((item) => (
                <div key={item.template_id} style={{
                  background: '#1a1a2e', padding: 28, borderRadius: 20, marginBottom: 16,
                  display: 'flex', gap: 24, alignItems: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(117, 54, 213,0.1)',
                  transition: 'all 0.3s ease',
                }}>
                  {/* Cover */}
                  <div style={{
                    width: 100, height: 100, borderRadius: 12, flexShrink: 0,
                    background: item.cover_url
                      ? `url(${item.cover_url}) center/cover`
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f0', margin: '0 0 8px' }}>{item.name}</h3>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{ padding: '4px 12px', background: 'rgba(117, 54, 213, 0.15)', color: '#7536d5', fontSize: 11, fontWeight: 600, borderRadius: 12 }}>{item.genre}</span>
                    </div>
                  </div>

                  {/* Price + Remove */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#7536d5', letterSpacing: -0.5 }}>
                      ￥{(item.price / 100).toFixed(0)}
                    </div>
                    <button
                      onClick={() => handleRemove(item.template_id, item.name)}
                      style={{
                        marginTop: 12, padding: '6px 16px', borderRadius: 24,
                        border: '1px solid #E5E5E5', background: 'transparent',
                        color: '#9ca3af', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div style={{
              background: '#1a1a2e', padding: 36, borderRadius: 20,
              position: 'sticky', top: 140, height: 'fit-content',
              boxShadow: '0 8px 32px rgba(117, 54, 213,0.12)', border: '1px solid rgba(117, 54, 213,0.15)',
            }}>
              <h3 style={{ marginBottom: 24, fontSize: 18, fontWeight: 600, color: '#e8e8f0' }}>订单摘要</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, color: '#9ca3af', fontSize: 14 }}>
                <span>小计 ({count} 件)</span>
                <span>￥{(total / 100).toFixed(0)}</span>
              </div>

              <div style={{ borderTop: '2px solid rgba(117, 54, 213, 0.15)', paddingTop: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                  <span>总计</span>
                  <span style={{ color: '#7536d5' }}>￥{(total / 100).toFixed(0)}</span>
                </div>
              </div>

              <Link href="/checkout" style={{
                display: 'block', width: '100%', padding: 16, borderRadius: 24,
                background: 'linear-gradient(135deg, #7536d5, #5a2db8)', color: 'white',
                fontSize: 16, fontWeight: 600, textDecoration: 'none', textAlign: 'center',
                boxShadow: '0 6px 20px rgba(117, 54, 213,0.3)',
              }}>
                去结算 →
              </Link>

              <Link href="/templates" style={{
                display: 'block', width: '100%', padding: 12, borderRadius: 24, marginTop: 12,
                border: '1px solid #E5E5E5', background: 'transparent',
                color: '#9ca3af', fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center',
              }}>
                继续购物
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
