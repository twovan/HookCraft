'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--hc-bg)' }}>
        <div style={{ fontSize: '14px', color: 'var(--hc-text-muted)' }}>加载中...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '28px clamp(20px, 4vw, 48px)',
      background: 'linear-gradient(180deg, rgba(82, 214, 198, 0.08), transparent 320px), radial-gradient(circle at 82% 12%, rgba(206, 255, 53, 0.12), transparent 300px), var(--hc-bg)',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{loginStyles}</style>

      <div style={{
        width: '100%', maxWidth: 1080,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
        background: 'var(--hc-panel)', borderRadius: 18, overflow: 'hidden',
        boxShadow: 'var(--hc-shadow)', border: '1px solid var(--hc-border)',
        position: 'relative', zIndex: 1,
      }} className="login-card">
        {/* Left - Brand Panel */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(206,255,53,0.18), rgba(82,214,198,0.1) 48%, rgba(255,90,61,0.12))',
          padding: '52px 60px', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left',
          position: 'relative', overflow: 'hidden',
        }} className="login-brand-panel">
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, rgba(8,9,12,0.28), transparent)',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{
              fontSize: 46, fontWeight: 900, color: 'var(--hc-text)', marginBottom: 14,
              fontFamily: 'var(--hc-font)', letterSpacing: 0,
            }}>
              HookCraft
            </h1>
            <p style={{ fontSize: 17, color: 'var(--hc-text-muted)', marginBottom: 32, lineHeight: 1.7, maxWidth: 360 }}>
              登录后继续管理模板、额度、生成版本和分轨编辑项目。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
              {[
                { index: '01', title: '模板开始', desc: '从签约制作人的 Hook 和风格模板进入创作。' },
                { index: '02', title: '双版本生成', desc: '保留生成记录，方便选择、下载和复用。' },
                { index: '03', title: '分轨工作台', desc: '在浏览器里试听、裁剪、混音并导出 WAV。' },
              ].map((feature) => (
                <div key={feature.title} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 42, height: 42, background: 'rgba(206,255,53,0.12)', borderRadius: 8,
                    border: '1px solid rgba(206,255,53,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--hc-lime)', fontSize: 13, fontWeight: 900,
                  }}>
                    {feature.index}
                  </div>
                  <div>
                    <div style={{ color: 'var(--hc-text)', fontWeight: 850, marginBottom: 4 }}>{feature.title}</div>
                    <div style={{ color: 'var(--hc-text-muted)', fontSize: 14, lineHeight: 1.5 }}>{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Form Panel */}
        <div style={{ padding: '52px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }} className="login-form-panel">
          {isLogin ? (
            <LoginForm onSwitch={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitch={() => setIsLogin(true)} />
          )}
        </div>
      </div>
    </div>
  );
}


function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? '邮箱或密码错误'
        : authError.message);
      setLoading(false);
      return;
    }

    if (data.session?.access_token) {
      document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    }

    // 登录成功，重定向到原始页面或首页
    const redirectTo = searchParams.get('redirectTo') || '/';
    router.push(redirectTo);
    router.refresh();
  };

  const handleOAuthLogin = async (provider: 'wechat' | 'qq') => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(`${provider === 'wechat' ? '微信' : 'QQ'}登录失败: ${authError.message}`);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
    fontSize: 15, fontFamily: 'var(--hc-font)', transition: 'all 0.2s',
    outline: 'none', boxSizing: 'border-box', background: '#0b0c10', color: 'var(--hc-text)',
  };

  return (
    <div>
      <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, fontFamily: 'var(--hc-font)', color: 'var(--hc-text)', letterSpacing: 0 }}>
        欢迎回来
      </h2>
      <p style={{ color: 'var(--hc-text-muted)', marginBottom: 36 }}>登录您的账户继续创作</p>

      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 20, borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 750, marginBottom: 8, color: 'var(--hc-text)', fontSize: 14 }}>邮箱</label>
          <input
            type="email"
            placeholder="输入邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 750, marginBottom: 8, color: 'var(--hc-text)', fontSize: 14 }}>密码</label>
          <input
            type="password"
            placeholder="输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 18, height: 18, cursor: 'pointer' }} />
            <span style={{ fontSize: 14, color: 'var(--hc-text-muted)' }}>记住我</span>
          </label>
          <a href="#" onClick={(e) => { e.preventDefault(); alert('忘记密码功能即将上线'); }} style={{ fontSize: 14, color: 'var(--hc-lime)', textDecoration: 'none', fontWeight: 750 }}>忘记密码？</a>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: 16, borderRadius: 999, border: 'none',
            background: loading ? '#20222b' : 'var(--hc-lime)', color: loading ? 'var(--hc-text-weak)' : '#08090c',
            fontSize: 16, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
            fontFamily: 'var(--hc-font)',
          }}
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ color: 'var(--hc-text-muted)', fontSize: 14 }}>还没有账户？</span>
          <button
            type="button"
            onClick={onSwitch}
            style={{ color: 'var(--hc-lime)', background: 'none', border: 'none', fontWeight: 750, marginLeft: 4, cursor: 'pointer', fontSize: 14 }}
          >
            立即注册
          </button>
        </div>
      </form>

      {/* Social Login */}
      <div style={{ marginTop: 32 }}>
        <div style={{ position: 'relative', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ position: 'relative', background: 'var(--hc-panel)', padding: '0 16px', color: 'var(--hc-text-muted)', fontSize: 14 }}>或使用以下方式登录</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            type="button"
            onClick={() => handleOAuthLogin('wechat')}
            style={{
              padding: 12, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, background: '#111217', color: 'var(--hc-text)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            微信
          </button>
          <button
            type="button"
            onClick={() => handleOAuthLogin('qq')}
            style={{
              padding: 12, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, background: '#111217', color: 'var(--hc-text)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            QQ
          </button>
        </div>
      </div>
    </div>
  );
}


function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 前端验证
    if (password.length < 8) {
      setError('密码至少需要8位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (!agreed) {
      setError('请先同意用户协议和隐私政策');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError('该邮箱已被注册');
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // 注册成功 — 数据库触发器会自动初始化 memberships、credits、preview_counts
    setSuccess(true);
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
    fontSize: 15, fontFamily: 'var(--hc-font)', transition: 'all 0.2s',
    outline: 'none', boxSizing: 'border-box', background: '#0b0c10', color: 'var(--hc-text)',
  };

  if (success) {
    return (
      <div>
        <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, fontFamily: 'var(--hc-font)', color: 'var(--hc-text)' }}>
          注册成功
        </h2>
        <p style={{ color: 'var(--hc-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          我们已向 <strong>{email}</strong> 发送了一封验证邮件，请查收并点击链接完成验证。
        </p>
        <button
          onClick={onSwitch}
          style={{
            width: '100%', padding: 16, borderRadius: 999, border: 'none',
            background: 'var(--hc-lime)', color: '#08090c',
            fontSize: 16, fontWeight: 900, cursor: 'pointer',
            fontFamily: 'var(--hc-font)',
          }}
        >
          返回登录
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, fontFamily: 'var(--hc-font)', color: 'var(--hc-text)', letterSpacing: 0 }}>
        创建账户
      </h2>
      <p style={{ color: 'var(--hc-text-muted)', marginBottom: 36 }}>加入我们，开始您的音乐之旅</p>

      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 20, borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 750, marginBottom: 8, color: 'var(--hc-text)', fontSize: 14 }}>用户名</label>
          <input
            type="text"
            placeholder="输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 750, marginBottom: 8, color: 'var(--hc-text)', fontSize: 14 }}>邮箱</label>
          <input
            type="email"
            placeholder="输入邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 750, marginBottom: 8, color: 'var(--hc-text)', fontSize: 14 }}>密码</label>
          <input
            type="password"
            placeholder="设置密码（至少8位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 750, marginBottom: 8, color: 'var(--hc-text)', fontSize: 14 }}>确认密码</label>
          <input
            type="password"
            placeholder="再次输入密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }}
          />
          <span style={{ fontSize: 14, color: 'var(--hc-text-muted)', lineHeight: 1.5 }}>
            我已阅读并同意 <a href="#" style={{ color: 'var(--hc-lime)', textDecoration: 'none', fontWeight: 750 }}>用户协议</a> 和 <a href="#" style={{ color: 'var(--hc-lime)', textDecoration: 'none', fontWeight: 750 }}>隐私政策</a>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: 16, borderRadius: 999, border: 'none',
            background: loading ? '#20222b' : 'var(--hc-lime)', color: loading ? 'var(--hc-text-weak)' : '#08090c',
            fontSize: 16, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
            fontFamily: 'var(--hc-font)',
          }}
        >
          {loading ? '注册中...' : '注册'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ color: 'var(--hc-text-muted)', fontSize: 14 }}>已有账户？</span>
          <button
            type="button"
            onClick={onSwitch}
            style={{ color: 'var(--hc-lime)', background: 'none', border: 'none', fontWeight: 750, marginLeft: 4, cursor: 'pointer', fontSize: 14 }}
          >
            立即登录
          </button>
        </div>
      </form>
    </div>
  );
}

const loginStyles = `
  @media (max-width: 880px) {
    .login-card {
      grid-template-columns: 1fr !important;
      max-width: 560px !important;
    }

    .login-brand-panel,
    .login-form-panel {
      padding: 34px 24px !important;
    }

    .login-brand-panel h1 {
      font-size: 38px !important;
    }
  }

  @media (max-width: 520px) {
    .login-card {
      border-radius: 14px !important;
    }

    .login-brand-panel {
      display: none !important;
    }

    .login-form-panel {
      padding: 28px 20px !important;
    }
  }
`;
