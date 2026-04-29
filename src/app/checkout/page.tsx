'use client';

import Link from 'next/link';
import { useState } from 'react';

const ORDER_ITEMS = [
  { id: '1', title: 'Epic Battle Theme', price: 99 },
  { id: '2', title: 'Urban Vibes', price: 79 },
  { id: '3', title: 'Pop Sensation', price: 149 },
];

const PAYMENT_METHODS = [
  { id: 'wechat', name: '微信支付', desc: '扫码支付', icon: '💬' },
  { id: 'alipay', name: '支付宝', desc: '扫码支付', icon: '🔵' },
  { id: 'stripe', name: 'Stripe', desc: '信用卡支付', icon: '💳' },
];

const navLinkStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: '#6B6B6B', textDecoration: 'none',
};

export default function CheckoutPage() {
  const [selectedPayment, setSelectedPayment] = useState('alipay');
  const total = ORDER_ITEMS.reduce((sum, item) => sum + item.price, 0);

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
            🛒<span style={{ position: 'absolute', top: -8, right: -8, background: '#D4A574', color: 'white', fontSize: 12, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
          </Link>
        </div>
      </nav>

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Left - Order Summary */}
          <div>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#2D2D2D' }}>订单摘要</h3>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(212,165,116,0.1)' }}>
              {ORDER_ITEMS.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                  borderBottom: i < ORDER_ITEMS.length - 1 ? '1px solid #F5E6D3' : 'none',
                  fontSize: 15, color: '#2D2D2D',
                }}>
                  <span>{item.title}</span>
                  <span style={{ fontWeight: 500 }}>￥{item.price}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', paddingTop: 16,
                fontSize: 20, fontWeight: 700, borderTop: '2px solid #F5E6D3', marginTop: 12,
              }}>
                <span>总计</span>
                <span style={{ color: '#D4A574' }}>￥{total}</span>
              </div>
            </div>
          </div>

          {/* Right - Payment Methods */}
          <div>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 600, color: '#2D2D2D' }}>支付方式</h3>

            {PAYMENT_METHODS.map((method) => (
              <div
                key={method.id}
                onClick={() => setSelectedPayment(method.id)}
                style={{
                  background: selectedPayment === method.id
                    ? 'linear-gradient(135deg, rgba(245,230,211,0.3), rgba(253,251,247,0.5))'
                    : 'white',
                  padding: 24, borderRadius: 16,
                  border: selectedPayment === method.id ? '2px solid #D4A574' : '2px solid #E5E5E5',
                  marginBottom: 16, cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="radio"
                    name="payment"
                    checked={selectedPayment === method.id}
                    onChange={() => setSelectedPayment(method.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{method.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: '#2D2D2D' }}>{method.name}</div>
                        <div style={{ fontSize: 12, color: '#6B6B6B' }}>{method.desc}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* QR Code Placeholder */}
            {(selectedPayment === 'wechat' || selectedPayment === 'alipay') && (
              <div style={{
                width: 200, height: 200, background: '#F5E6D3', margin: '24px auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 48 }}>📱</div>
              </div>
            )}

            <button style={{
              width: '100%', padding: 16, borderRadius: 24, border: 'none',
              background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              boxShadow: '0 6px 20px rgba(212,165,116,0.3)',
            }}>
              确认支付 ￥{total}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
