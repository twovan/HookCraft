'use client';

import Link from 'next/link';
import { useState } from 'react';

// Mock data
const HOT_TEMPLATES = [
  { id: '1', title: 'Epic Battle Theme', tags: ['游戏音乐', 'RPG'], producer: '张三', price: 99, gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: '2', title: 'Urban Vibes', tags: ['短视频', 'Lo-fi'], producer: '李四', price: 79, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: '3', title: 'Pop Sensation', tags: ['流行歌曲', 'Pop'], producer: '王五', price: 149, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: '4', title: 'Cinematic Score', tags: ['广告', 'Cinematic'], producer: '赵六', price: 129, gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
];

const NEW_TEMPLATES = [
  { id: '5', title: 'Neon Dreams', tags: ['电子', 'EDM'], producer: '陈七', price: 119, gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: '6', title: 'Jazz Café', tags: ['爵士', 'Chill'], producer: '周八', price: 89, gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: '7', title: 'Dark Dungeon', tags: ['游戏音乐', 'RPG'], producer: '张三', price: 89, gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)' },
  { id: '8', title: 'Summer Pop', tags: ['流行', 'Pop'], producer: '王五', price: 109, gradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' },
];

const navLinkStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: '#6B6B6B',
  textDecoration: 'none', transition: 'color 0.2s',
};

export default function HomePage() {
  const [cartCount] = useState(3);
  const [searchValue, setSearchValue] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      {/* 背景纹理 */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(212,165,116,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,165,116,0.03) 0%, transparent 50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* 导航栏 */}
      <nav style={{
        position: 'sticky', top: 0, height: 70, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212,165,116,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px',
        boxShadow: '0 2px 20px rgba(212,165,116,0.08)',
      }}>
        <Link href="/" style={{
          fontSize: 32, fontWeight: 700, color: '#D4A574',
          fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
          textDecoration: 'none',
        }}>
          HookCraft
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="搜索模板..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{
                width: 320, padding: '11px 18px',
                border: '1px solid #E5E5E5', borderRadius: 24,
                fontSize: 14, fontWeight: 400, background: '#FDFBF7',
                fontFamily: "'Inter', sans-serif", letterSpacing: 0.1,
                outline: 'none',
              }}
            />
          </div>
          <Link href="/studio" style={navLinkStyle}>AI 创作</Link>
          <Link href="/pricing" style={navLinkStyle}>定价</Link>
          <Link href="/account" style={navLinkStyle}>账户</Link>
          <Link href="/demo" style={navLinkStyle}>Demo</Link>
          <Link href="/admin/credits" style={{ ...navLinkStyle, fontSize: 12, color: '#999' }}>管理后台</Link>
          <Link href="/cart" style={{ position: 'relative', fontSize: 24, textDecoration: 'none', cursor: 'pointer' }}>
            🛒
            <span style={{
              position: 'absolute', top: -8, right: -8,
              background: '#D4A574', color: 'white', fontSize: 12,
              width: 20, height: 20, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{cartCount}</span>
          </Link>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero 区域 */}
        <section style={{
          textAlign: 'center', padding: '100px 24px 120px',
          background: 'linear-gradient(135deg, #F5E6D3 0%, #FDFBF7 100%)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
            background: 'radial-gradient(circle, rgba(212,165,116,0.1) 0%, transparent 70%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{
              fontSize: 64, fontWeight: 700, color: '#2D2D2D', marginBottom: 20,
              fontFamily: "'Playfair Display', serif", letterSpacing: -1, lineHeight: 1.1,
            }}>
              Discover Premium Music
            </h1>
            <p style={{
              fontSize: 20, color: '#6B6B6B', marginBottom: 36, letterSpacing: 0.2,
              maxWidth: 600, margin: '0 auto 36px',
            }}>
              高质量音乐模板交易平台，连接优秀制作人与创作者
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <Link href="/studio" style={{
                padding: '14px 36px', borderRadius: 24, border: 'none',
                background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
                fontSize: 16, fontWeight: 600, textDecoration: 'none',
                boxShadow: '0 6px 20px rgba(212,165,116,0.3)',
                transition: 'all 0.3s',
              }}>
                开始创作
              </Link>
              <Link href="/templates" style={{
                padding: '14px 36px', borderRadius: 24,
                border: '1px solid #E5E5E5', background: 'transparent',
                color: '#6B6B6B', fontSize: 16, fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.3s',
              }}>
                浏览模板
              </Link>
            </div>
          </div>
        </section>

        {/* 热门模板 */}
        <section style={{ maxWidth: 1400, margin: '0 auto', padding: '80px 48px 0' }}>
          <h2 style={{
            fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#2D2D2D',
            fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
            position: 'relative', display: 'inline-block',
          }}>
            热门模板
            <span style={{
              position: 'absolute', bottom: -12, left: 0, width: 60, height: 3,
              background: 'linear-gradient(90deg, #D4A574, transparent)', borderRadius: 2,
            }} />
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 48 }}>
            {HOT_TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} hovered={hoveredCard === t.id} onHover={setHoveredCard} />
            ))}
          </div>
        </section>

        {/* 新品上架 */}
        <section style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 48px 80px' }}>
          <h2 style={{
            fontSize: 36, fontWeight: 700, marginBottom: 48, color: '#2D2D2D',
            fontFamily: "'Playfair Display', serif", letterSpacing: -0.5,
            position: 'relative', display: 'inline-block',
          }}>
            新品上架
            <span style={{
              position: 'absolute', bottom: -12, left: 0, width: 60, height: 3,
              background: 'linear-gradient(90deg, #D4A574, transparent)', borderRadius: 2,
            }} />
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {NEW_TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} hovered={hoveredCard === t.id} onHover={setHoveredCard} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          background: '#2D2D2D', color: 'white', padding: '60px 48px 32px', marginTop: 80,
        }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: '#D4A574', marginBottom: 16 }}>HookCraft</div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.8, maxWidth: 320 }}>
                  高质量音乐模板交易平台，连接优秀制作人与创作者，让每一段旋律都能找到归属。
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>平台</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link href="/templates" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14 }}>浏览模板</Link>
                  <Link href="/studio" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14 }}>AI 创作</Link>
                  <Link href="/pricing" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 14 }}>会员方案</Link>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>支持</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>帮助中心</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>联系我们</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>常见问题</span>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>法律</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>服务条款</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>隐私政策</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>版权声明</span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>© 2026 HookCraft. All rights reserved.</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Made with ♪ for music creators</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TemplateCard({ template, hovered, onHover }: {
  template: { id: string; title: string; tags: string[]; producer: string; price: number; gradient: string };
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <Link
      href={`/templates/${template.id}`}
      style={{
        background: 'white', borderRadius: 20, overflow: 'hidden',
        boxShadow: hovered ? '0 12px 40px rgba(212,165,116,0.25)' : '0 4px 20px rgba(0,0,0,0.06)',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'pointer', textDecoration: 'none', color: 'inherit',
        transform: hovered ? 'translateY(-8px) scale(1.02)' : 'none',
        display: 'block',
      }}
      onMouseEnter={() => onHover(template.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Cover */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: template.gradient }} />
        {/* Play overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>▶</div>
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, color: '#2D2D2D', letterSpacing: -0.2, lineHeight: 1.3 }}>
          {template.title}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {template.tags.map((tag) => (
            <span key={tag} style={{
              padding: '5px 14px', background: '#F5E6D3', color: '#D4A574',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
              textTransform: 'uppercase', borderRadius: 12,
            }}>{tag}</span>
          ))}
        </div>
        <div style={{ color: '#6B6B6B', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>👤 {template.producer}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#D4A574', letterSpacing: -0.5 }}>￥{template.price}</div>
          <span
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{
              padding: '8px 16px', borderRadius: 24, border: 'none',
              background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            加入购物车
          </span>
        </div>
      </div>
    </Link>
  );
}
