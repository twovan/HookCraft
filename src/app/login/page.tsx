'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDFBF7' }}>
        <div style={{ fontSize: '14px', color: '#999' }}>加载中...</div>
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
      padding: 48, background: 'linear-gradient(135deg, #F5E6D3 0%, #FDFBF7 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decorations */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%',
        background: 'radial-gradient(circle, rgba(212,165,116,0.15) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%',
        background: 'radial-gradient(circle, rgba(212,165,116,0.15) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(60px)',
      }} />

      <div style={{
        width: '100%', maxWidth: 1000,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
        background: 'white', borderRadius: 32, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Left - Brand Panel */}
        <div style={{
          background: 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)',
          padding: 60, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{
              fontSize: 48, fontWeight: 700, color: 'white', marginBottom: 20,
              fontFamily: "'Playfair Display', serif", letterSpacing: -1,
            }}>
              HookCraft
            </h1>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', marginBottom: 40, lineHeight: 1.6 }}>
              高质量音乐模板交易平台
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'left' }}>
              {[
                { icon: '🎵', title: '海量模板', desc: '50-100个精选音乐模板' },
                { icon: '⚡', title: '即时下载', desc: '购买后立即获取文件' },
                { icon: '🔒', title: '安全支付', desc: '多种支付方式可选' },
              ].map((feature) => (
                <div key={feature.title} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>
                    {feature.icon}
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>{feature.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Form Panel */}
        <div style={{ padding: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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

    const { error: authError } = await supabase.auth.signInWithPassword({
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
    width: '100%', padding: '14px 16px', border: '2px solid #E5E5E5', borderRadius: 12,
    fontSize: 15, fontFamily: "'Inter', sans-serif", transition: 'all 0.3s',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, fontFamily: "'Playfair Display', serif", color: '#2D2D2D' }}>
        欢迎回来
      </h2>
      <p style={{ color: '#6B6B6B', marginBottom: 36 }}>登录您的账户继续购物</p>

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
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#2D2D2D', fontSize: 14 }}>邮箱</label>
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
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#2D2D2D', fontSize: 14 }}>密码</label>
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
            <span style={{ fontSize: 14, color: '#6B6B6B' }}>记住我</span>
          </label>
          <a href="#" style={{ fontSize: 14, color: '#D4A574', textDecoration: 'none', fontWeight: 600 }}>忘记密码？</a>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: 16, borderRadius: 24, border: 'none',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
            fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
            fontFamily: "'Inter', sans-serif",
            boxShadow: loading ? 'none' : '0 6px 20px rgba(212,165,116,0.3)',
          }}
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ color: '#6B6B6B', fontSize: 14 }}>还没有账户？</span>
          <button
            type="button"
            onClick={onSwitch}
            style={{ color: '#D4A574', background: 'none', border: 'none', fontWeight: 600, marginLeft: 4, cursor: 'pointer', fontSize: 14 }}
          >
            立即注册
          </button>
        </div>
      </form>

      {/* Social Login */}
      <div style={{ marginTop: 32 }}>
        <div style={{ position: 'relative', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#E5E5E5' }} />
          <span style={{ position: 'relative', background: 'white', padding: '0 16px', color: '#6B6B6B', fontSize: 14 }}>或使用以下方式登录</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            type="button"
            onClick={() => handleOAuthLogin('wechat')}
            style={{
              padding: 12, border: '2px solid #E5E5E5', borderRadius: 12, background: 'white',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>💬</span> 微信
          </button>
          <button
            type="button"
            onClick={() => handleOAuthLogin('qq')}
            style={{
              padding: 12, border: '2px solid #E5E5E5', borderRadius: 12, background: 'white',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>🐧</span> QQ
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
    width: '100%', padding: '14px 16px', border: '2px solid #E5E5E5', borderRadius: 12,
    fontSize: 15, fontFamily: "'Inter', sans-serif", transition: 'all 0.3s',
    outline: 'none', boxSizing: 'border-box',
  };

  if (success) {
    return (
      <div>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, fontFamily: "'Playfair Display', serif", color: '#2D2D2D' }}>
          注册成功 🎉
        </h2>
        <p style={{ color: '#6B6B6B', marginBottom: 24, lineHeight: 1.6 }}>
          我们已向 <strong>{email}</strong> 发送了一封验证邮件，请查收并点击链接完成验证。
        </p>
        <button
          onClick={onSwitch}
          style={{
            width: '100%', padding: 16, borderRadius: 24, border: 'none',
            background: 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            boxShadow: '0 6px 20px rgba(212,165,116,0.3)',
          }}
        >
          返回登录
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, fontFamily: "'Playfair Display', serif", color: '#2D2D2D' }}>
        创建账户
      </h2>
      <p style={{ color: '#6B6B6B', marginBottom: 36 }}>加入我们，开始您的音乐之旅</p>

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
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#2D2D2D', fontSize: 14 }}>用户名</label>
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
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#2D2D2D', fontSize: 14 }}>邮箱</label>
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
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#2D2D2D', fontSize: 14 }}>密码</label>
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
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#2D2D2D', fontSize: 14 }}>确认密码</label>
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
          <span style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.5 }}>
            我已阅读并同意 <a href="#" style={{ color: '#D4A574', textDecoration: 'none', fontWeight: 600 }}>用户协议</a> 和 <a href="#" style={{ color: '#D4A574', textDecoration: 'none', fontWeight: 600 }}>隐私政策</a>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: 16, borderRadius: 24, border: 'none',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #D4A574, #C9A86A)', color: 'white',
            fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
            fontFamily: "'Inter', sans-serif",
            boxShadow: loading ? 'none' : '0 6px 20px rgba(212,165,116,0.3)',
          }}
        >
          {loading ? '注册中...' : '注册'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ color: '#6B6B6B', fontSize: 14 }}>已有账户？</span>
          <button
            type="button"
            onClick={onSwitch}
            style={{ color: '#D4A574', background: 'none', border: 'none', fontWeight: 600, marginLeft: 4, cursor: 'pointer', fontSize: 14 }}
          >
            立即登录
          </button>
        </div>
      </form>
    </div>
  );
}
