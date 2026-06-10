'use client';

import { useState, FormEvent } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';

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
    <main style={screenStyle}>
      <section style={brandPanelStyle}>
        <div style={brandHeaderStyle}>
          <div style={logoIconStyle}>H</div>
          <div>
            <div style={logoTextStyle}>HookCraft</div>
            <div style={logoSubStyle}>AI 音乐版权管理后台</div>
          </div>
        </div>

        <div style={heroCopyStyle}>
          <div style={eyebrowStyle}>AI Risk & Workflow Control Room</div>
          <h1 style={heroTitleStyle}>进入后台运行态控制室</h1>
          <p style={heroTextStyle}>
            管理 AI 生成任务、内容审核、敏感词风险、Credits 消耗与版权模板运营。
          </p>
        </div>

        <div style={signalGridStyle}>
          <div style={signalCardStyle}>
            <span style={signalCodeStyle}>AUTH</span>
            <strong>独立管理员认证</strong>
            <small>admin_accounts + HttpOnly session</small>
          </div>
          <div style={signalCardStyle}>
            <span style={signalCodeStyle}>RISK</span>
            <strong>审核与风控入口</strong>
            <small>登录后查看实时聚合数据</small>
          </div>
          <div style={signalCardStyle}>
            <span style={signalCodeStyle}>OPS</span>
            <strong>运营任务中枢</strong>
            <small>模板、订单、生成任务统一管理</small>
          </div>
        </div>
      </section>

      <section style={loginPanelStyle} aria-label="管理员登录">
        <div style={panelTopStyle}>
          <span style={panelKickerStyle}>Secure Admin Access</span>
          <h2 style={panelTitleStyle}>欢迎回来</h2>
          <p style={panelTextStyle}>使用管理员账号登录，继续处理后台运营任务。</p>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>管理员账号</span>
            <span style={inputWrapStyle}>
              <span style={inputBadgeStyle}>ID</span>
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
            </span>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>密码</span>
            <span style={inputWrapStyle}>
              <span style={inputBadgeStyle}>PW</span>
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
            </span>
          </label>

          <div style={optionsRowStyle}>
            <label style={rememberLabelStyle}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={checkboxStyle}
                disabled={loading}
              />
              记住登录状态
            </label>
            <button
              type="button"
              style={forgotButtonStyle}
              onClick={() => alert('请联系超级管理员重置密码')}
              disabled={loading}
            >
              忘记密码？
            </button>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...submitButtonStyle,
              ...(loading ? submitButtonDisabledStyle : {}),
            }}
          >
            {loading ? '登录中...' : '进入管理后台'}
          </button>
        </form>

        <div style={footerStyle}>
          <span>HookCraft 管理系统 v1.0</span>
          <span>© 2026 HookCraft. All rights reserved.</span>
        </div>
      </section>
    </main>
  );
}

const screenStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.1fr) minmax(420px, 520px)',
  background: '#07111d',
  color: '#fff',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const brandPanelStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  padding: '44px 56px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  background: 'linear-gradient(135deg, #0b1420 0%, #102033 54%, #0b3145 100%)',
  overflow: 'hidden',
};

const brandHeaderStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const logoIconStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  background: 'linear-gradient(135deg, #d7a56d, #b8793b)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 900,
  color: '#fff',
};

const logoTextStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: 0,
};

const logoSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.58)',
  marginTop: 3,
};

const heroCopyStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: 620,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#f3c17f',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.5,
  marginBottom: 14,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 44,
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: 0,
};

const heroTextStyle: React.CSSProperties = {
  margin: '18px 0 0',
  maxWidth: 520,
  color: 'rgba(255,255,255,0.68)',
  fontSize: 15,
  lineHeight: 1.8,
};

const signalGridStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};

const signalCardStyle: React.CSSProperties = {
  minHeight: 112,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const signalCodeStyle: React.CSSProperties = {
  width: 44,
  height: 24,
  borderRadius: 6,
  background: 'rgba(243,193,127,0.12)',
  color: '#f3c17f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 900,
};

const loginPanelStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  color: '#0f172a',
  padding: '56px 48px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  borderLeft: '1px solid rgba(255,255,255,0.08)',
};

const panelTopStyle: React.CSSProperties = {
  marginBottom: 30,
};

const panelKickerStyle: React.CSSProperties = {
  display: 'inline-flex',
  height: 26,
  alignItems: 'center',
  padding: '0 10px',
  borderRadius: 6,
  background: '#fff7ed',
  color: '#d97706',
  fontSize: 11,
  fontWeight: 900,
};

const panelTitleStyle: React.CSSProperties = {
  margin: '16px 0 8px',
  fontSize: 28,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
};

const panelTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontSize: 14,
  lineHeight: 1.7,
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  color: '#334155',
  fontSize: 13,
  fontWeight: 800,
};

const inputWrapStyle: React.CSSProperties = {
  height: 48,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1px solid #dbe3ef',
  borderRadius: 8,
  background: '#fff',
  padding: '0 12px',
};

const inputBadgeStyle: React.CSSProperties = {
  width: 28,
  height: 24,
  borderRadius: 6,
  background: '#f1f5f9',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 900,
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: '#0f172a',
  fontSize: 14,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const optionsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
};

const rememberLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  color: '#475569',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const checkboxStyle: React.CSSProperties = {
  marginRight: 8,
  accentColor: '#d7a56d',
};

const forgotButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#b8793b',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  padding: 0,
};

const submitButtonStyle: React.CSSProperties = {
  height: 48,
  border: 'none',
  borderRadius: 8,
  background: 'linear-gradient(135deg, #d7a56d, #b8793b)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 900,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const submitButtonDisabledStyle: React.CSSProperties = {
  opacity: 0.72,
  cursor: 'not-allowed',
};

const errorStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#dc2626',
  fontSize: 13,
  fontWeight: 700,
};

const footerStyle: React.CSSProperties = {
  marginTop: 34,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: '#94a3b8',
  fontSize: 11,
  lineHeight: 1.5,
};
