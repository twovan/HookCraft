'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 管理后台登录页面
 * 设计参考: admin-prototype.html 中的 login-screen
 * 深色渐变背景 + 白色居中卡片 + HookCraft 品牌
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '用户名或密码错误，请重试');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={screenStyle}>
      {/* 背景 */}
      <div style={bgStyle} />
      <div style={bgOverlayStyle} />

      {/* 登录卡片 */}
      <div style={cardStyle}>
        {/* Logo */}
        <div style={logoRowStyle}>
          <div style={logoIconStyle}>H</div>
          <div>
            <div style={logoTextStyle}>HookCraft</div>
            <div style={logoSubStyle}>管理后台</div>
          </div>
        </div>

        <div style={titleStyle}>欢迎回来</div>
        <div style={subtitleStyle}>请登录管理员账号以继续</div>

        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>管理员账号</label>
            <div style={inputWrapStyle}>
              <span style={inputIconStyle}>👤</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名或邮箱"
                style={inputStyle}
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>密码</label>
            <div style={inputWrapStyle}>
              <span style={inputIconStyle}>🔒</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                style={inputStyle}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div style={optionsRowStyle}>
            <label style={rememberLabelStyle}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ marginRight: 6, accentColor: '#D4A574' }}
                disabled={loading}
              />
              记住登录状态
            </label>
            <a href="#" style={forgotLinkStyle} onClick={(e) => { e.preventDefault(); alert('请联系超级管理员重置密码'); }}>
              忘记密码？
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...btnStyle,
              ...(loading ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
            }}
          >
            {loading ? '⏳ 登录中...' : '登 录'}
          </button>

          {error && <div style={errorStyle}>{error}</div>}
        </form>

        {/* 页脚 */}
        <div style={footerStyle}>
          <div style={footerTextStyle}>HookCraft 管理系统 v1.0</div>
          <div style={footerTextStyle}>© 2026 HookCraft. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}

/* ===== 样式（匹配原型图 admin-prototype.html） ===== */

const screenStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 300,
};

const bgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
};

const bgOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 30% 40%, rgba(212,165,116,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(212,165,116,0.1) 0%, transparent 50%)',
};

const cardStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  background: '#fff',
  borderRadius: 20,
  width: 420,
  padding: 40,
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  animation: 'loginSlideUp 0.5s ease',
};

const logoRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 32,
};

const logoIconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  background: 'linear-gradient(135deg, #D4A574, #c4956a)',
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  fontWeight: 700,
  color: '#fff',
};

const logoTextStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#1a1a2e',
};

const logoSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#999',
  marginTop: 1,
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: '#1a1a2e',
  marginBottom: 6,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#999',
  marginBottom: 28,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 20,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#555',
  marginBottom: 6,
};

const inputWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1.5px solid #e0e0e0',
  borderRadius: 10,
  padding: '0 14px',
  transition: 'border-color 0.2s',
};

const inputIconStyle: React.CSSProperties = {
  fontSize: 16,
  color: '#bbb',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  padding: '12px 0',
  fontSize: 14,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  color: '#333',
  background: 'transparent',
};

const optionsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24,
};

const rememberLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 13,
  color: '#666',
  cursor: 'pointer',
};

const forgotLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#D4A574',
  textDecoration: 'none',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  border: 'none',
  borderRadius: 10,
  background: 'linear-gradient(135deg, #D4A574, #c4956a)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  transition: 'all 0.2s',
};

const errorStyle: React.CSSProperties = {
  marginTop: 16,
  padding: '10px 14px',
  borderRadius: 8,
  background: '#fde8e8',
  color: '#e74c3c',
  fontSize: 13,
  textAlign: 'center',
};

const footerStyle: React.CSSProperties = {
  marginTop: 32,
  textAlign: 'center',
};

const footerTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ccc',
  lineHeight: 1.8,
};
