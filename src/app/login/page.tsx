'use client';

import Image from 'next/image';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-loading">
        <span>加载中...</span>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <main className="auth-page">
      <style>{loginStyles}</style>
      <div className="auth-bg" aria-hidden="true" />
      <div className="auth-shell">
        <section className="auth-story" aria-label="HookCraft">
          <LinkLogo />
          <div className="auth-story-copy">
            <span className="auth-eyebrow">AI 音乐工作台</span>
            <h1>HookCraft AI 音乐创作，继续你的 Demo。</h1>
            <p>登录后管理模板、额度、生成版本和分轨编辑项目，让每次灵感都能回到同一个工作流。</p>
          </div>

          <div className="auth-wave-panel" aria-hidden="true">
            {[
              ['#c084fc', 22, 64, 38, 78, 42, 28, 72, 46, 86, 34, 24, 58],
              ['#ef4444', 18, 26, 72, 34, 28, 20, 48, 24, 68, 32, 22, 18],
              ['#2dd4bf', 44, 76, 58, 82, 68, 48, 72, 62, 80, 56, 32, 24],
            ].map(([color, ...bars], row) => (
              <div key={row} className="auth-wave-row" style={{ '--wave-color': color } as React.CSSProperties}>
                {bars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
              </div>
            ))}
          </div>

          <div className="auth-capabilities">
            <span><strong>01</strong> 模板创作</span>
            <span><strong>02</strong> 版本管理</span>
            <span><strong>03</strong> 分轨导出</span>
          </div>
        </section>

        <section className="auth-panel" aria-label={isLogin ? '登录' : '注册'}>
          {isLogin ? (
            <LoginForm onSwitch={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitch={() => setIsLogin(true)} />
          )}
        </section>
      </div>
    </main>
  );
}

function LinkLogo() {
  return (
    <a href="/" className="auth-logo" aria-label="HookCraft 首页">
      <Image src="/logo-nav.svg" alt="HookCraft" width={170} height={44} priority />
    </a>
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

  return (
    <div className="auth-form">
      <FormHeader
        eyebrow="欢迎回来"
        title="登录 HookCraft"
        description="继续管理你的模板、会员额度和分轨编辑项目。"
      />
      {error && <div className="auth-message error">{error}</div>}

      <form onSubmit={handleLogin} className="auth-form-stack">
        <Field label="邮箱">
          <input
            type="email"
            placeholder="输入邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </Field>

        <Field label="密码">
          <input
            type="password"
            placeholder="输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </Field>

        <div className="auth-row">
          <label className="auth-check">
            <input type="checkbox" />
            <span>记住我</span>
          </label>
          <button
            type="button"
            className="auth-text-button"
            onClick={() => alert('忘记密码功能即将上线')}
          >
            忘记密码？
          </button>
        </div>

        <button type="submit" className="auth-primary" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <OAuthButtons onOAuthLogin={handleOAuthLogin} />

      <p className="auth-switch">
        还没有账户？
        <button type="button" onClick={onSwitch}>立即注册</button>
      </p>
    </div>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
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

    if (password.length < 8) {
      setError('密码至少需要 8 位');
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
        data: { username },
      },
    });

    if (authError) {
      setError(authError.message.includes('already registered') ? '该邮箱已被注册' : authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="auth-form">
        <FormHeader
          eyebrow="注册成功"
          title="检查你的邮箱"
          description="我们已经发送验证邮件，请完成验证后返回登录。"
        />
        <div className="auth-message success">
          已向 <strong>{email}</strong> 发送验证邮件。
        </div>
        <button type="button" onClick={onSwitch} className="auth-primary">
          返回登录
        </button>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <FormHeader
        eyebrow="创建账户"
        title="加入 HookCraft"
        description="创建账户后即可保存生成记录、模板购买和分轨工程。"
      />
      {error && <div className="auth-message error">{error}</div>}

      <form onSubmit={handleRegister} className="auth-form-stack">
        <Field label="用户名">
          <input
            type="text"
            placeholder="输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </Field>

        <Field label="邮箱">
          <input
            type="email"
            placeholder="输入邮箱地址"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </Field>

        <Field label="密码">
          <input
            type="password"
            placeholder="至少 8 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        <Field label="确认密码">
          <input
            type="password"
            placeholder="再次输入密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </Field>

        <label className="auth-check auth-policy">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            我已阅读并同意 <a href="#">用户协议</a> 和 <a href="#">隐私政策</a>
          </span>
        </label>

        <button type="submit" className="auth-primary" disabled={loading}>
          {loading ? '注册中...' : '注册'}
        </button>
      </form>

      <p className="auth-switch">
        已有账户？
        <button type="button" onClick={onSwitch}>立即登录</button>
      </p>
    </div>
  );
}

function FormHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="auth-form-head">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function OAuthButtons({ onOAuthLogin }: { onOAuthLogin: (provider: 'wechat' | 'qq') => void }) {
  return (
    <div className="auth-oauth">
      <div className="auth-divider"><span>或使用以下方式登录</span></div>
      <div className="auth-oauth-grid">
        <button type="button" onClick={() => onOAuthLogin('wechat')}>微信</button>
        <button type="button" onClick={() => onOAuthLogin('qq')}>QQ</button>
      </div>
    </div>
  );
}

const loginStyles = `
  .auth-loading,
  .auth-page {
    min-height: 100vh;
    background: #05080e;
  }

  .auth-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca8ba;
    font-size: 14px;
  }

  .auth-page {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px clamp(18px, 4vw, 56px);
  }

  .auth-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(90deg, rgba(5, 8, 14, .96), rgba(5, 8, 14, .58) 42%, rgba(5, 8, 14, .9)),
      linear-gradient(180deg, rgba(5, 8, 14, .12), rgba(5, 8, 14, .92)),
      url('/home-hero-studio.webp');
    background-size: cover;
    background-position: 64% center;
    transform: scale(1.025);
  }

  .auth-shell {
    position: relative;
    z-index: 1;
    width: min(1120px, 100%);
    box-sizing: border-box;
    min-height: 660px;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(420px, .95fr);
    overflow: hidden;
    border: 1px solid rgba(151, 165, 196, .16);
    border-radius: 8px;
    background: rgba(5, 8, 14, .68);
    box-shadow: 0 36px 90px rgba(0, 0, 0, .48);
    backdrop-filter: blur(18px);
  }

  .auth-story {
    position: relative;
    min-height: 660px;
    padding: 32px 42px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border-right: 1px solid rgba(151, 165, 196, .14);
  }

  .auth-logo {
    width: fit-content;
    display: inline-flex;
    align-items: center;
  }

  .auth-story-copy {
    max-width: 520px;
    margin-top: 56px;
  }

  .auth-eyebrow,
  .auth-form-head span {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid rgba(206, 255, 53, .28);
    border-radius: 999px;
    background: rgba(9, 13, 21, .46);
    color: #ceff35;
    font-size: 12px;
    font-weight: 860;
  }

  .auth-story h1 {
    margin: 16px 0 0;
    color: #f8fafc;
    font-size: clamp(40px, 4.2vw, 64px);
    line-height: 1.02;
    font-weight: 950;
    letter-spacing: 0;
  }

  .auth-story p {
    max-width: 460px;
    margin: 18px 0 0;
    color: #b9c3d4;
    font-size: 16px;
    line-height: 1.72;
  }

  .auth-wave-panel {
    width: min(520px, 100%);
    display: grid;
    gap: 9px;
    padding: 14px;
    border: 1px solid rgba(151, 165, 196, .16);
    border-radius: 8px;
    background: rgba(7, 11, 18, .7);
  }

  .auth-wave-row {
    height: 46px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 7px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--wave-color) 18%, rgba(8, 12, 20, .9));
  }

  .auth-wave-row i {
    flex: 1;
    min-width: 4px;
    border-radius: 999px;
    background: var(--wave-color);
    opacity: .86;
  }

  .auth-capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    color: #dce7f5;
    font-size: 12px;
    font-weight: 760;
  }

  .auth-capabilities span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid rgba(151, 165, 196, .18);
    border-radius: 7px;
    background: rgba(8, 12, 20, .66);
  }

  .auth-capabilities strong {
    color: #ceff35;
    font-size: 11px;
  }

  .auth-panel {
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    padding: clamp(34px, 5vw, 58px);
    background:
      linear-gradient(180deg, rgba(14, 21, 28, .9), rgba(7, 10, 16, .94)),
      radial-gradient(circle at 80% 0%, rgba(206, 255, 53, .1), transparent 32%);
  }

  .auth-form {
    width: 100%;
    min-width: 0;
  }

  .auth-form-head {
    margin-bottom: 28px;
  }

  .auth-form-head h2 {
    margin: 14px 0 8px;
    color: #f8fafc;
    font-size: 34px;
    line-height: 1.1;
    font-weight: 950;
    letter-spacing: 0;
  }

  .auth-form-head p {
    margin: 0;
    color: #8f9db2;
    font-size: 14px;
    line-height: 1.6;
  }

  .auth-form-stack {
    display: grid;
    gap: 16px;
  }

  .auth-field {
    display: grid;
    gap: 8px;
  }

  .auth-field span {
    color: #dfe7f3;
    font-size: 13px;
    font-weight: 820;
  }

  .auth-field input {
    width: 100%;
    min-height: 46px;
    box-sizing: border-box;
    border: 1px solid rgba(151, 165, 196, .2);
    border-radius: 7px;
    outline: none;
    background: rgba(5, 8, 14, .78);
    color: #f8fafc;
    padding: 0 13px;
    font-size: 14px;
    transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .auth-field input::placeholder {
    color: #566175;
  }

  .auth-field input:focus {
    border-color: rgba(206, 255, 53, .55);
    background: rgba(6, 10, 16, .94);
    box-shadow: 0 0 0 3px rgba(206, 255, 53, .08);
  }

  .auth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: -2px;
  }

  .auth-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #8f9db2;
    font-size: 13px;
    line-height: 1.5;
    cursor: pointer;
  }

  .auth-check input {
    width: 16px;
    height: 16px;
    accent-color: #ceff35;
  }

  .auth-policy {
    align-items: flex-start;
  }

  .auth-policy a {
    color: #ceff35;
    text-decoration: none;
    font-weight: 820;
  }

  .auth-text-button,
  .auth-switch button {
    border: 0;
    padding: 0;
    background: transparent;
    color: #ceff35;
    cursor: pointer;
    font: inherit;
    font-weight: 820;
  }

  .auth-primary {
    width: 100%;
    min-height: 48px;
    border: 0;
    border-radius: 7px;
    background: #ceff35;
    color: #08090c;
    font-size: 15px;
    font-weight: 930;
    cursor: pointer;
    transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    box-shadow: 0 16px 36px rgba(206, 255, 53, .18);
  }

  .auth-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 20px 44px rgba(206, 255, 53, .24);
  }

  .auth-primary:disabled {
    cursor: not-allowed;
    opacity: .55;
    box-shadow: none;
  }

  .auth-oauth {
    margin-top: 24px;
  }

  .auth-divider {
    position: relative;
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .auth-divider::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: rgba(151, 165, 196, .14);
  }

  .auth-divider span {
    position: relative;
    padding: 0 12px;
    background: #0a0f17;
    color: #7f8aa0;
    font-size: 12px;
    font-weight: 760;
  }

  .auth-oauth-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .auth-oauth-grid button {
    min-height: 42px;
    border: 1px solid rgba(151, 165, 196, .18);
    border-radius: 7px;
    background: rgba(5, 8, 14, .62);
    color: #e6edf7;
    font-size: 13px;
    font-weight: 840;
    cursor: pointer;
  }

  .auth-switch {
    margin: 24px 0 0;
    color: #8f9db2;
    text-align: center;
    font-size: 14px;
  }

  .auth-switch button {
    margin-left: 6px;
  }

  .auth-message {
    margin-bottom: 18px;
    border-radius: 7px;
    padding: 12px 13px;
    font-size: 13px;
    line-height: 1.5;
  }

  .auth-message.error {
    border: 1px solid rgba(248, 113, 113, .28);
    background: rgba(127, 29, 29, .24);
    color: #fecaca;
  }

  .auth-message.success {
    border: 1px solid rgba(206, 255, 53, .28);
    background: rgba(206, 255, 53, .08);
    color: #e3ff9a;
  }

  @media (max-width: 980px) {
    .auth-page {
      align-items: flex-start;
      padding-top: 20px;
      padding-bottom: 20px;
    }

    .auth-shell {
      grid-template-columns: 1fr;
      min-height: 0;
    }

    .auth-story {
      min-height: auto;
      padding: 28px;
      gap: 28px;
    }

    .auth-story-copy {
      margin-top: 10px;
    }

    .auth-wave-panel {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .auth-page {
      padding: 0;
      max-width: 100vw;
      overflow-x: hidden;
    }

    .auth-shell {
      width: 100%;
      max-width: 100vw;
      min-height: 100vh;
      border: 0;
      border-radius: 0;
    }

    .auth-story {
      padding: 20px 18px 0;
      border-right: 0;
    }

    .auth-logo img {
      width: 136px;
      height: auto;
    }

    .auth-story-copy {
      display: none;
    }

    .auth-capabilities {
      display: none;
    }

    .auth-panel {
      display: block;
      align-items: flex-start;
      width: 100%;
      max-width: 100vw;
      padding: 26px 18px 34px;
    }

    .auth-form,
    .auth-form-stack,
    .auth-field,
    .auth-field input,
    .auth-primary,
    .auth-oauth,
    .auth-oauth-grid {
      width: calc(100vw - 54px);
      max-width: calc(100vw - 54px);
      box-sizing: border-box;
    }

    .auth-row {
      display: grid;
      grid-template-columns: 1fr;
      align-items: flex-start;
      gap: 12px;
      width: calc(100vw - 54px);
      max-width: calc(100vw - 54px);
    }

    .auth-text-button {
      flex: 0 0 auto;
      white-space: nowrap;
    }

    .auth-form-head h2 {
      font-size: 30px;
    }
  }
`;
