'use client';

import Link from 'next/link';
import { useState } from 'react';

interface CartItem {
  id: string;
  title: string;
  tags: string[];
  producer: string;
  price: number;
  gradient: string;
  license: string;
}

const INITIAL_CART: CartItem[] = [
  { id: '1', title: 'Epic Battle Theme', tags: ['游戏音乐', 'RPG'], producer: '张三', price: 99, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', license: 'standard' },
  { id: '2', title: 'Urban Vibes', tags: ['短视频', 'Lo-fi'], producer: '李四', price: 79, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', license: 'standard' },
  { id: '3', title: 'Pop Sensation', tags: ['流行歌曲', 'Pop'], producer: '王五', price: 149, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', license: 'standard' },
];

const LICENSE_OPTIONS = [
  { value: 'standard', label: '标准授权', multiplier: 1 },
  { value: 'extended', label: '扩展授权', multiplier: 2 },
  { value: 'exclusive', label: '独家授权', multiplier: 5 },
];

const navLinkStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: '#6B6B6B', textDecoration: 'none',
};

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>(INITIAL_CART);
  const [promoCode, setPromoCode] = useState('');

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateLicense = (id: string, license: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, license } : item))
    );
  };

  const getItemPrice = (item: CartItem) => {
    const option = LICENSE_OPTIONS.find((o) => o.value === item.license);
    return item.price * (option?.multiplier || 1);
  };

  const subtotal = cartItems.reduce((sum, item) => sum + getItemPrice(item), 0);
  const discount = 0;
  const total = subtotal - discount;

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,165,116,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, height: 70, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212,165,116,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', boxShadow: '0 2px 20px rgba(212,165,116,0.08)',
      }}>
        <Link href="/" style={{ fontSize: 32, fontWeight: 700, color: '#D4A574', fontFamily: "'Playfair Display', serif", letterSpacing: -0.5, textDecoration: 'none' }}>HookCraft</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <input type="text" placeholder="搜索模板..." style={{ width: 320, padding: '11px 18px', border: '1px solid #E5E5E5', borderRadius: 24, fontSize: 14, background: '#FDFBF7', fontFamily: "'Inter', sans-serif", outline: 'none' }} />
          <Link href="/studio" style={navLinkStyle}>AI 创作</Link>
          <Link href="/pricing" style={navLinkStyle}>定价</Link>
          <Link href="/cart" style={{ position: 'relative', fontSize: 24, textDecoration: 'none' }}>
            🛒<span style={{ position: 'absolute', top: -8, right: -8, background: '#D4A574', color: 'white', fontSize: 12, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartItems.length}</span>
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 48, position: 'relative', zIndex: 1 }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
          <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>首页</Link>
          <span style={{ color: '#ccc' }}>›</span>
          <span style={{ color: '#2D2D2D', fontWeight: 500 }}>购物车</span>
        </nav>

        <h1 style={{
          fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#2D2D2D',
          fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
          position: 'relative', display: 'inline-block',
        }}>
          购物车 ({cartItems.length} items)
          <span style={{ position: 'absolute', bottom: -12, left: 0, width: 60, height: 3, background: 'linear-gradient(90deg, #D4A574, transparent)', borderRadius: 2 }} />
        </h1>

        {cartItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 80, marginBottom: 24, opacity: 0.6 }}>🛒</div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#2D2D2D', marginBottom: 12, fontFamily: "'Playfair Display', serif" }}>购物车是空的</h2>
            <p style={{ color: '#999', fontSize: 15, marginBottom: 32 }}>快去发现你喜欢的音乐模板吧</p>
            <Link href="/templates" style={{
              padding: '14px 36px', borderRadius: 24, background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
              color: 'white', fontSize: 15, fontWeight: 600, textDecoration: 'none',
            }}>浏览模板 →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32 }}>
            {/* Cart Items */}
            <div>
              {cartItems.map((item) => (
                <div key={item.id} style={{
                  background: 'white', padding: 28, borderRadius: 20, marginBottom: 16,
                  display: 'flex', gap: 24, alignItems: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)',
                  transition: 'all 0.3s ease',
                }}>
                  {/* Cover */}
                  <div style={{ width: 100, height: 100, borderRadius: 12, background: item.gradient, flexShrink: 0 }} />

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2D2D2D', margin: '0 0 8px' }}>{item.title}</h3>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {item.tags.map((tag) => (
                        <span key={tag} style={{ padding: '4px 12px', background: '#F5E6D3', color: '#D4A574', fontSize: 11, fontWeight: 600, borderRadius: 12 }}>{tag}</span>
                      ))}
                    </div>
                    <div style={{ color: '#6B6B6B', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>👤 {item.producer}</div>
                    {/* License selector */}
                    <select
                      value={item.license}
                      onChange={(e) => updateLicense(item.id, e.target.value)}
                      style={{
                        padding: '6px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
                        fontSize: 13, fontFamily: "'Inter', sans-serif", background: 'white',
                        cursor: 'pointer', outline: 'none', color: '#2D2D2D',
                      }}
                    >
                      {LICENSE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price + Remove */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#D4A574', letterSpacing: -0.5 }}>￥{getItemPrice(item)}</div>
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        marginTop: 12, padding: '6px 16px', borderRadius: 24,
                        border: '1px solid #E5E5E5', background: 'transparent',
                        color: '#6B6B6B', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
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
              background: 'white', padding: 36, borderRadius: 20,
              position: 'sticky', top: 140, height: 'fit-content',
              boxShadow: '0 8px 32px rgba(212,165,116,0.12)', border: '1px solid rgba(212,165,116,0.15)',
            }}>
              <h3 style={{ marginBottom: 24, fontSize: 18, fontWeight: 600, color: '#2D2D2D' }}>订单摘要</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, color: '#6B6B6B', fontSize: 14 }}>
                <span>小计</span>
                <span>￥{subtotal}</span>
              </div>

              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, color: '#4CAF50', fontSize: 14 }}>
                  <span>折扣</span>
                  <span>-￥{discount}</span>
                </div>
              )}

              {/* Promo Code */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="优惠码"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    style={{
                      flex: 1, padding: '10px 14px', border: '1px solid #E5E5E5', borderRadius: 12,
                      fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none',
                    }}
                  />
                  <button style={{
                    padding: '10px 16px', borderRadius: 12, border: '1px solid #D4A574',
                    background: 'transparent', color: '#D4A574', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  }}>
                    应用
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '2px solid #F5E6D3', paddingTop: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700 }}>
                  <span>总计</span>
                  <span style={{ color: '#D4A574' }}>￥{total}</span>
                </div>
              </div>

              <Link href="/checkout" style={{
                display: 'block', width: '100%', padding: 16, borderRadius: 24,
                background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
                fontSize: 16, fontWeight: 600, textDecoration: 'none', textAlign: 'center',
                boxShadow: '0 6px 20px rgba(212,165,116,0.3)',
              }}>
                去结算 →
              </Link>

              <Link href="/templates" style={{
                display: 'block', width: '100%', padding: 12, borderRadius: 24, marginTop: 12,
                border: '1px solid #E5E5E5', background: 'transparent',
                color: '#6B6B6B', fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center',
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
