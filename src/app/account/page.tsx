'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getAvatarInitial } from '@/lib/account/profile';
import { compressImageForUpload } from '@/lib/image/browserCompression';
import { supabase } from '@/lib/supabase/client';
import { TIER_CONFIGS } from '@/config/tierConfig';
import type { PaymentRecord } from '@/types/payment';
import type { CreditHistory } from '@/types/credits';
import type { MembershipTier } from '@/types/membership';

type ProfileData = {
  email: string;
  username: string;
  avatarUrl: string | null;
};

type SidebarPanel = 'overview' | 'profile' | 'password';

const TIER_LABELS: Record<MembershipTier, string> = {
  free: '免费版',
  pro: '专业版',
  business: '商业版',
};

const STATUS_LABELS: Record<string, string> = {
  active: '活跃',
  cancelled: '已取消',
  expiring: '即将到期',
  expired: '已过期',
  grace_period: '宽限期',
};

export default function AccountPage() {
  const { user, loading: authLoading, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      setAuthTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthTimedOut(true), 1800);
    return () => window.clearTimeout(timer);
  }, [authLoading]);

  useEffect(() => {
    if ((authLoading && !authTimedOut) || user) return;
    router.replace('/login?redirectTo=/account');
  }, [authLoading, authTimedOut, user, router]);

  const membership = useMembershipStore((s) => s.membership);
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const membershipLoading = useMembershipStore((s) => s.isLoading);
  const membershipError = useMembershipStore((s) => s.error);
  const credits = useCreditStore((s) => s.credits);
  const previewCount = useCreditStore((s) => s.previewCount);
  const fetchCredits = useCreditStore((s) => s.fetchCredits);
  const fetchPreviewCount = useCreditStore((s) => s.fetchPreviewCount);
  const isPaid = useMembershipStore((s) => s.isPaid());

  const [creditHistory, setCreditHistory] = useState<CreditHistory[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PaymentRecord[]>([]);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [trendView, setTrendView] = useState<'day' | 'month'>('month');
  const [dailyData, setDailyData] = useState<Array<{ date: string; count: number }>>([]);

  const [activePanel, setActivePanel] = useState<SidebarPanel>('overview');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [username, setUsername] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pendingPlanAction, setPendingPlanAction] = useState<MembershipTier | null>(null);

  useEffect(() => {
    if ((authLoading && !authTimedOut) || !user) return;
    fetchMembership();
    fetchCreditHistory();
    fetchPurchaseHistory();
    fetchDailyData();
  }, [authLoading, authTimedOut, user]);

  useEffect(() => {
    if ((authLoading && !authTimedOut) || !user) return;
    if (!membership) return;
    if (isPaid) {
      fetchCredits();
    } else {
      fetchPreviewCount();
    }
  }, [authLoading, authTimedOut, user, membership, isPaid, fetchCredits, fetchPreviewCount]);

  useEffect(() => {
    if (!user) return;
    let ignore = false;

    async function loadProfile() {
      const res = await fetchWithAuth('/api/account/profile');
      if (!res.ok) return;

      const data = await res.json();
      if (ignore) return;

      setProfile(data);
      setUsername(data.username || user?.email?.split('@')[0] || '');
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [user]);

  const fetchCreditHistory = async () => {
    try {
      const res = await fetchWithAuth('/api/credits/history');
      if (res.ok) {
        const data = await res.json();
        setCreditHistory(Array.isArray(data) ? data : data.history ?? []);
      }
    } catch {
      // History is non-critical for account management.
    }
  };

  const fetchPurchaseHistory = async () => {
    try {
      const res = await fetchWithAuth('/api/payments');
      if (res.ok) {
        const data = await res.json();
        setPurchaseHistory(data.filter((record: PaymentRecord) => record.status !== 'pending'));
      }
    } catch {
      // Payment history panel can render empty if this request fails.
    }
  };

  const fetchDailyData = async () => {
    try {
      const res = await fetchWithAuth('/api/batches?range=30d');
      if (res.ok) {
        const data = await res.json();
        const batches = data.batches || [];
        const dateMap: Record<string, number> = {};
        for (const batch of batches) {
          const date = new Date(batch.createdAt).toISOString().slice(0, 10);
          dateMap[date] = (dateMap[date] || 0) + 1;
        }
        const days: Array<{ date: string; count: number }> = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          days.push({ date: dateStr, count: dateMap[dateStr] || 0 });
        }
        setDailyData(days);
      }
    } catch {
      // Daily trend is optional.
    }
  };

  const handleRetryPayment = async () => {
    setIsRetrying(true);
    try {
      const res = await fetchWithAuth('/api/payments', { method: 'POST' });
      if (res.ok) {
        setPaymentError(null);
      } else {
        const data = await res.json();
        setPaymentError(data.error || '支付重试失败，请稍后再试');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleUpgrade = async (targetTier: MembershipTier) => {
    try {
      setPendingPlanAction(targetTier);
      const res = await fetchWithAuth('/api/membership/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      if (res.ok) {
        fetchMembership({ force: true });
        fetchCredits({ force: true });
        setPaymentError(null);
      } else {
        const data = await res.json();
        setPaymentError(data.error || '升级失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    } finally {
      setPendingPlanAction(null);
    }
  };

  const handleDowngrade = async (targetTier: MembershipTier) => {
    try {
      setPendingPlanAction(targetTier);
      const res = await fetchWithAuth('/api/membership/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      if (res.ok) {
        fetchMembership({ force: true });
        setPaymentError(null);
      } else {
        const data = await res.json();
        setPaymentError(data.error || '降级失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    } finally {
      setPendingPlanAction(null);
    }
  };

  const handleCancel = async () => {
    try {
      const res = await fetchWithAuth('/api/membership/cancel', { method: 'POST' });
      if (res.ok) {
        fetchMembership({ force: true });
        setPaymentError(null);
      } else {
        const data = await res.json();
        setPaymentError(data.error || '取消订阅失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    }
  };

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const res = await fetchWithAuth('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ username, avatarUrl: profile?.avatarUrl ?? null }),
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileError(data.error || '保存个人信息失败');
        return;
      }

      setProfile(data);
      setUsername(data.username);
      await refreshUser();
      setProfileMessage('个人信息已保存');
    } catch {
      setProfileError('网络连接失败，请稍后重试');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const compressedFile = await compressImageForUpload(file, {
        maxBytes: 2 * 1024 * 1024,
        outputName: 'avatar.webp',
      });
      const formData = new FormData();
      formData.append('avatar', compressedFile);

      const res = await fetchWithAuth('/api/account/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileError(data.error || '头像上传失败');
        return;
      }

      setProfile((current) => (current ? { ...current, avatarUrl: data.avatarUrl } : current));
      await refreshUser();
      setProfileMessage('头像已更新');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '网络连接失败，请稍后重试');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    if (password.length < 8) {
      setPasswordError('密码至少需要 8 位');
      setSavingPassword(false);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setPasswordMessage('密码已更新');
  }

  const monthlyTrendData = useMemo(() => {
    const rows = [...creditHistory];
    if (isPaid && credits) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const existingIndex = rows.findIndex((row) => row.month === currentMonth);
      const currentRow: CreditHistory = {
        month: currentMonth,
        used: credits.monthlyUsed,
        total: credits.monthlyTotal,
        monthlyUsed: credits.monthlyUsed,
        purchasedUsed: 0,
      };

      if (existingIndex >= 0) {
        rows[existingIndex] = {
          ...rows[existingIndex],
          used: Math.max(rows[existingIndex].used, currentRow.used),
          total: Math.max(rows[existingIndex].total, currentRow.total),
          monthlyUsed: Math.max(rows[existingIndex].monthlyUsed ?? 0, currentRow.monthlyUsed),
        };
      } else if (credits.monthlyUsed > 0 || credits.monthlyTotal > 0) {
        rows.push(currentRow);
      }
    }

    return rows.sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [creditHistory, credits, isPaid]);

  const maxUsage = useMemo(
    () => (monthlyTrendData.length > 0 ? Math.max(...monthlyTrendData.map((history) => history.total), 1) : 1),
    [monthlyTrendData],
  );

  const handleRetryAccountData = () => {
    if (!user) return;
    fetchMembership({ force: true });
    fetchCreditHistory();
    fetchPurchaseHistory();
    fetchDailyData();
  };

  const accountSyncMessage = membershipError?.includes('Internal Server Error')
    ? '会员与额度服务暂时不可用，请检查服务配置后重试。'
    : membershipError || '会员与额度服务暂时不可用，请稍后重试。';

  if ((authLoading && !authTimedOut) || !user) {
    return (
      <main className="account-page account-centered">
        <div className="account-state">
          <span>账户</span>
          <p>正在确认账户状态...</p>
          <div className="account-state-loader" />
        </div>
        <AccountStyles />
      </main>
    );
  }

  if (!membership && (membershipLoading || !membershipError)) {
    return (
      <main className="account-page account-centered">
        <div className="account-state">
          <span>账户同步</span>
          <p>正在同步会员与额度数据...</p>
          <div className="account-state-loader" />
        </div>
        <AccountStyles />
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="account-page account-centered">
        <div className="account-state account-state-error" role="alert">
          <span>账户同步</span>
          <strong>账户数据暂时无法加载</strong>
          <p>{accountSyncMessage}</p>
          <div className="account-state-actions">
            <button className="account-button" onClick={handleRetryAccountData}>
              重新同步
            </button>
            <button className="account-button account-button-ghost" onClick={() => router.push('/studio')}>
              返回工作台
            </button>
          </div>
        </div>
        <AccountStyles />
      </main>
    );
  }

  const monthlyPercent = isPaid && credits?.monthlyTotal
    ? Math.min(100, (credits.monthlyUsed / credits.monthlyTotal) * 100)
    : 0;
  const monthlyRemaining = credits?.monthlyRemaining ?? 0;
  const monthlyTotal = credits?.monthlyTotal ?? 0;
  const monthlyUsed = credits?.monthlyUsed ?? 0;
  const purchasedBalance = credits?.purchasedBalance ?? 0;
  const totalAvailable = credits?.totalAvailable ?? previewCount?.remaining ?? 0;
  const previewPercent = !isPaid && previewCount?.total
    ? Math.min(100, (previewCount.used / previewCount.total) * 100)
    : 0;
  const usageAngle = Math.max(8, monthlyPercent * 3.6);
  const avatarInitial = getAvatarInitial({ username: profile?.username || username, email: profile?.email || user.email });
  const displayName = profile?.username || username || user.email?.split('@')[0] || '用户';
  const userEmail = profile?.email || user.email || '';
  const currentConfig = TIER_CONFIGS[membership.tier];
  const nextUpgradeTier: MembershipTier | null = membership.tier === 'free' ? 'pro' : membership.tier === 'pro' ? 'business' : null;
  const nextDowngradeTier: MembershipTier | null = membership.tier === 'business' ? 'pro' : membership.tier === 'pro' ? 'free' : null;
  const sortedPurchases = [...purchaseHistory]
    .sort((a, b) => getTime(b.createdAt || (b as any).created_at) - getTime(a.createdAt || (a as any).created_at))
    .slice(0, 7);

  return (
    <main className="account-page">
      <div className="account-studio-shell">
        <aside className="account-rail" aria-label="账户中心">
          <div className="rail-title">
            <span />
            <b>账户中心</b>
          </div>

          <label className="rail-avatar">
            <input id="account-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            <div className="rail-avatar-ring">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="头像" /> : avatarInitial}
            </div>
            <small>{uploadingAvatar ? '上传中' : '更换头像'}</small>
          </label>

          <div className="rail-identity">
            <h2>{displayName}</h2>
            <p>{userEmail}</p>
          </div>

          <div className="rail-membership">
            <b>{TIER_LABELS[membership.tier]}</b>
            <span>{STATUS_LABELS[membership.status]}</span>
          </div>

          <nav className="rail-nav" aria-label="账户操作">
            <button className={activePanel === 'overview' ? 'active' : ''} onClick={() => setActivePanel('overview')}>
              账户管理
            </button>
            <button className={activePanel === 'profile' ? 'active' : ''} onClick={() => setActivePanel('profile')}>
              保存资料
            </button>
            <button className={activePanel === 'password' ? 'active' : ''} onClick={() => setActivePanel('password')}>
              修改密码
            </button>
          </nav>

          <div className="rail-panel">
            {activePanel === 'profile' ? (
              <form onSubmit={handleProfileSubmit} className="rail-form">
                <label>
                  <span>用户名</span>
                  <input id="account-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={20} />
                </label>
                {(profileError || profileMessage) && (
                  <p className={profileError ? 'rail-message error' : 'rail-message success'}>{profileError || profileMessage}</p>
                )}
                <button type="submit" disabled={savingProfile}>
                  {savingProfile ? '保存中...' : '保存资料'}
                </button>
              </form>
            ) : activePanel === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="rail-form">
                <label>
                  <span>新密码</span>
                  <input id="account-new-password" name="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" />
                </label>
                <label>
                  <span>确认新密码</span>
                  <input id="account-confirm-password" name="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" />
                </label>
                {(passwordError || passwordMessage) && (
                  <p className={passwordError ? 'rail-message error' : 'rail-message success'}>{passwordError || passwordMessage}</p>
                )}
                <button type="submit" disabled={savingPassword}>
                  {savingPassword ? '更新中...' : '更新密码'}
                </button>
              </form>
            ) : (
              <div className="rail-summary">
                <span>本月消耗</span>
                <strong>{isPaid ? `${monthlyUsed} / ${monthlyTotal}` : `${previewCount?.used ?? 0} / ${previewCount?.total ?? 0}`}</strong>
                <div className="rail-progress">
                  <i style={{ width: `${isPaid ? monthlyPercent : previewPercent}%` }} />
                </div>
              </div>
            )}
          </div>

          <button className="rail-logout" onClick={signOut}>
            退出登录
          </button>
        </aside>

        <section className="account-main">
          <header className="account-main-head">
            <div>
              <span>账户中心</span>
              <h1>账户管理</h1>
              <p>管理您的账户、额度与订阅。</p>
            </div>
            <button className="account-button" onClick={() => router.push('/pricing#credits-pack')}>
              购买额度
            </button>
          </header>

          {paymentError && (
            <div className="payment-alert" role="alert">
              <div>
                <strong>支付状态需要确认</strong>
                <span>{paymentError}</span>
              </div>
              <button onClick={handleRetryPayment} disabled={isRetrying}>
                {isRetrying ? '重试中...' : '重试支付'}
              </button>
            </div>
          )}

          <section className="credits-cockpit">
            <div className="section-heading">
              <span>Credits 钱包</span>
            </div>
            {isPaid && credits ? (
              <div className="cockpit-grid">
                <MetricTile label="月度剩余" value={monthlyRemaining} tone="cyan" />
                <div className="radial-meter" style={{ '--usage-angle': `${usageAngle}deg` } as React.CSSProperties}>
                  <div className="radial-core">
                    <span>总可用</span>
                    <strong>{totalAvailable}</strong>
                    <small>额度</small>
                  </div>
                </div>
                <MetricTile label="购买额度" value={purchasedBalance} tone="amber" />
                <div className="usage-mini">
                  <span>本月消耗</span>
                  <strong>{monthlyUsed} <small>/ {monthlyTotal}</small></strong>
                  <div className="usage-track">
                    <i style={{ width: `${monthlyPercent}%` }} />
                  </div>
                  <p>{Math.round(monthlyPercent)}%</p>
                </div>
              </div>
            ) : previewCount ? (
              <div className="preview-cockpit">
                <MetricTile label="剩余预览" value={previewCount.remaining} tone="cyan" />
                <div className="usage-mini wide">
                  <span>免费预览</span>
                  <strong>{previewCount.used} <small>/ {previewCount.total}</small></strong>
                  <div className="usage-track">
                    <i style={{ width: `${previewPercent}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted-text">正在加载额度...</p>
            )}
          </section>

          <section className="account-mid-grid">
            <article className="studio-panel trend-panel">
              <div className="panel-head">
                <h2>使用趋势</h2>
                <div className="segmented">
                  <button className={trendView === 'day' ? 'active' : ''} onClick={() => setTrendView('day')}>日</button>
                  <button className={trendView === 'month' ? 'active' : ''} onClick={() => setTrendView('month')}>月</button>
                </div>
              </div>
              <UsageChart
                trendView={trendView}
                monthlyTrendData={monthlyTrendData}
                dailyData={dailyData}
                maxUsage={maxUsage}
              />
            </article>

            <article className="studio-panel subscription-panel">
              <div className="panel-head">
                <h2>订阅管理</h2>
                <span className="status-chip">{STATUS_LABELS[membership.status]}</span>
              </div>
              <div className="plan-card">
                <div className="plan-title">
                  <strong>{TIER_LABELS[membership.tier]}</strong>
                  {membership.tier !== 'free' && <span>{formatAmount(currentConfig.monthlyPrice)}/月</span>}
                </div>
                <dl>
                  <div>
                    <dt>到期日期</dt>
                    <dd>{membership.tier === 'free' ? '永久免费' : formatDate(membership.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>自动续费</dt>
                    <dd>{membership.tier === 'free' ? '-' : membership.autoRenew ? '已开启' : '已关闭'}</dd>
                  </div>
                  <div>
                    <dt>月度额度</dt>
                    <dd>{currentConfig.monthlyCredits > 0 ? `${currentConfig.monthlyCredits} 点额度` : `${currentConfig.monthlyPreviews} 次预览`}</dd>
                  </div>
                </dl>
                <div className="plan-actions">
                  {nextUpgradeTier && (
                    <button className="plan-primary" disabled={pendingPlanAction === nextUpgradeTier} onClick={() => handleUpgrade(nextUpgradeTier)}>
                      {pendingPlanAction === nextUpgradeTier ? '处理中...' : `升级到${TIER_LABELS[nextUpgradeTier]}`}
                    </button>
                  )}
                  {nextDowngradeTier && (
                    <button disabled={pendingPlanAction === nextDowngradeTier} onClick={() => handleDowngrade(nextDowngradeTier)}>
                      降级
                    </button>
                  )}
                  {membership.tier !== 'free' && membership.status !== 'cancelled' && (
                    <button className="plan-danger" onClick={handleCancel}>取消订阅</button>
                  )}
                </div>
              </div>
            </article>
          </section>

          <section className="studio-panel ledger-panel">
            <div className="panel-head">
              <h2>额度充值记录</h2>
              <button onClick={() => router.push('/pricing#credits-pack')}>购买额度</button>
            </div>
            {sortedPurchases.length > 0 ? (
              <div className="ledger-table">
                <div className="ledger-row ledger-head">
                  <span>时间</span>
                  <span>类型</span>
                  <span>额度变动</span>
                  <span>金额</span>
                  <span>状态</span>
                </div>
                {sortedPurchases.map((record) => {
                  const creditsAmount = getCreditsFromAmount(record.amount);
                  return (
                    <div key={record.id} className="ledger-row">
                      <span>{formatDateTime(record.createdAt || (record as any).created_at || (record as any).completed_at)}</span>
                      <span>{record.tier === 'free' ? '额度充值' : `${TIER_LABELS[record.tier]}套餐`}</span>
                      <span className="ledger-change">{creditsAmount ? `+${creditsAmount}` : '-'}</span>
                      <span>{formatAmount(record.amount)}</span>
                      <span className="ledger-status">{formatPaymentStatus(record.status)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-ledger">暂无充值记录</div>
            )}
          </section>
        </section>
      </div>
      <AccountStyles />
    </main>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'amber' }) {
  return (
    <div className={`metric-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>额度</small>
    </div>
  );
}

function UsageChart({
  trendView,
  monthlyTrendData,
  dailyData,
  maxUsage,
}: {
  trendView: 'day' | 'month';
  monthlyTrendData: CreditHistory[];
  dailyData: Array<{ date: string; count: number }>;
  maxUsage: number;
}) {
  if (trendView === 'day') {
    const maxDaily = Math.max(...dailyData.map((day) => day.count), 1);
    return (
      <div className="equalizer-chart" role="img" aria-label="每日创作趋势柱状图">
        {dailyData.map((day) => (
          <div key={day.date} className="eq-column">
            <i style={{ height: `${Math.max((day.count / maxDaily) * 100, 8)}%` }} />
            <span>{day.date.slice(5)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (monthlyTrendData.length === 0) {
    return <div className="empty-ledger chart-empty">暂无历史数据</div>;
  }

  return (
    <div className="equalizer-chart" role="img" aria-label="月度额度使用趋势柱状图">
      {monthlyTrendData.map((month) => {
        const monthlyHeight = maxUsage > 0 ? ((month.monthlyUsed ?? 0) / maxUsage) * 100 : 0;
        const purchasedHeight = maxUsage > 0 ? ((month.purchasedUsed ?? 0) / maxUsage) * 100 : 0;
        const totalHeight = Math.max(monthlyHeight + purchasedHeight, month.used > 0 ? 10 : 5);

        return (
          <div key={month.month} className="eq-column">
            <i className="stacked" style={{ height: `${totalHeight}%` }}>
              {(month.purchasedUsed ?? 0) > 0 && <b style={{ flex: purchasedHeight }} />}
              {((month.monthlyUsed ?? 0) > 0 || month.used > 0) && <em style={{ flex: monthlyHeight || 1 }} />}
            </i>
            <span>{month.month.slice(5)}月</span>
          </div>
        );
      })}
    </div>
  );
}

const CREDITS_PACKS_MAP: Record<number, number> = {
  9900: 50,
  17900: 100,
  32900: 200,
  7900: 50,
  14300: 100,
  26300: 200,
};

function getCreditsFromAmount(amount: number): number | null {
  return CREDITS_PACKS_MAP[amount] || null;
}

function getTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  return new Date(value).getTime();
}

function formatDate(value: Date | string | null): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(amount: number): string {
  return `¥${(amount / 100).toFixed(2)}`;
}

function formatPaymentStatus(status: PaymentRecord['status']): string {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'refunded') return '已退款';
  return '处理中';
}

const accountStyles = `
      .account-page {
        min-height: 100vh;
        background:
          linear-gradient(180deg, rgba(8, 9, 12, 0.82), rgba(8, 9, 12, 0.98)),
          var(--hc-bg);
        color: var(--hc-text);
      }

      .account-centered {
        display: grid;
        place-items: center;
        padding: 42px 22px 72px;
      }

      .account-studio-shell {
        display: grid;
        grid-template-columns: 270px minmax(0, 1fr);
        min-height: calc(100vh - 70px);
      }

      .account-rail {
        position: sticky;
        top: 70px;
        align-self: start;
        min-height: calc(100vh - 70px);
        border-right: 1px solid rgba(255, 255, 255, 0.12);
        background:
          linear-gradient(180deg, rgba(16, 19, 25, 0.96), rgba(8, 10, 13, 0.96)),
          var(--hc-bg-soft);
        padding: 30px 30px 28px;
      }

      .rail-title {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 28px;
        color: var(--hc-text);
        font-size: 23px;
        font-weight: 900;
      }

      .rail-title span {
        width: 5px;
        height: 26px;
        border-radius: 999px;
        background: var(--hc-lime);
        box-shadow: 0 0 18px rgba(206, 255, 53, 0.45);
      }

      .rail-avatar {
        display: grid;
        justify-items: center;
        gap: 9px;
        margin-bottom: 18px;
        cursor: pointer;
      }

      .rail-avatar input {
        display: none;
      }

      .rail-avatar-ring {
        width: 112px;
        height: 112px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid rgba(206, 255, 53, 0.58);
        border-radius: 50%;
        background:
          linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
        color: #08090c;
        font-size: 38px;
        font-weight: 950;
        box-shadow: 0 0 0 6px rgba(206, 255, 53, 0.06), 0 24px 46px rgba(0, 0, 0, 0.34);
      }

      .rail-avatar-ring img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .rail-avatar small {
        color: var(--hc-text-weak);
        font-size: 12px;
      }

      .rail-identity {
        text-align: center;
        margin-bottom: 17px;
      }

      .rail-identity h2 {
        margin: 0 0 6px;
        font-size: 29px;
        letter-spacing: 0;
      }

      .rail-identity p {
        margin: 0;
        color: var(--hc-text-muted);
        font-size: 14px;
        overflow-wrap: anywhere;
      }

      .rail-membership {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin: 0 auto 28px;
        width: fit-content;
        padding: 9px 14px;
        border: 1px solid rgba(206, 255, 53, 0.24);
        border-radius: 8px;
        background: rgba(206, 255, 53, 0.08);
      }

      .rail-membership b {
        color: var(--hc-lime);
        font-size: 14px;
      }

      .rail-membership span {
        border-radius: 6px;
        background: rgba(51, 210, 118, 0.15);
        color: #73f7a5;
        padding: 3px 7px;
        font-size: 12px;
        font-weight: 900;
      }

      .rail-nav {
        display: grid;
        gap: 6px;
        margin: 0 -30px 18px;
      }

      .rail-nav button {
        position: relative;
        border: 0;
        background: transparent;
        color: var(--hc-text-muted);
        padding: 16px 30px;
        text-align: left;
        font: inherit;
        font-size: 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .rail-nav button.active {
        background: linear-gradient(90deg, rgba(206, 255, 53, 0.12), rgba(206, 255, 53, 0.02));
        color: var(--hc-lime);
      }

      .rail-nav button.active::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: var(--hc-lime);
      }

      .rail-panel {
        min-height: 118px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        padding: 17px 0;
        margin-bottom: 18px;
      }

      .rail-summary span,
      .rail-form label span {
        display: block;
        color: var(--hc-text-muted);
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 7px;
      }

      .rail-summary strong {
        display: block;
        font-size: 24px;
        margin-bottom: 10px;
      }

      .rail-progress,
      .usage-track {
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
      }

      .rail-progress i,
      .usage-track i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--hc-lime), var(--hc-cyan));
      }

      .rail-form {
        display: grid;
        gap: 11px;
      }

      .rail-form input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        background: #090b0f;
        color: var(--hc-text);
        padding: 10px 11px;
        font: inherit;
        font-size: 13px;
        outline: none;
      }

      .rail-form input:focus {
        border-color: rgba(206, 255, 53, 0.55);
      }

      .rail-form button,
      .account-button,
      .plan-actions button,
      .ledger-panel .panel-head button {
        border: 1px solid rgba(206, 255, 53, 0.5);
        border-radius: 8px;
        background: var(--hc-lime);
        color: #08090c;
        padding: 11px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 950;
        cursor: pointer;
      }

      .rail-form button:disabled,
      .plan-actions button:disabled {
        cursor: not-allowed;
        opacity: 0.58;
      }

      .rail-message {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
      }

      .rail-message.success {
        color: var(--hc-lime);
      }

      .rail-message.error {
        color: #ff8b76;
      }

      .rail-logout {
        width: 100%;
        border: 0;
        background: transparent;
        color: #ff5a3d;
        padding: 14px 0;
        text-align: left;
        font: inherit;
        font-size: 15px;
        font-weight: 900;
        cursor: pointer;
      }

      .account-main {
        min-width: 0;
        padding: 28px 30px 52px;
        background:
          radial-gradient(circle at 58% 2%, rgba(82, 214, 198, 0.13), transparent 310px),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 210px);
      }

      .account-main > * {
        width: min(1420px, 100%);
        margin-left: auto;
        margin-right: auto;
      }

      .account-main-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 22px;
      }

      .account-main-head span,
      .account-state span {
        display: block;
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
      }

      .account-main-head h1 {
        margin: 0 0 8px;
        font-size: 34px;
        line-height: 1;
        letter-spacing: 0;
      }

      .account-main-head p {
        margin: 0;
        color: var(--hc-text-muted);
        font-size: 14px;
      }

      .payment-alert,
      .studio-panel,
      .credits-cockpit,
      .account-state {
        border: 1px solid var(--hc-line);
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015)),
          rgba(10, 13, 17, 0.88);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.26);
      }

      .payment-alert {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 16px;
        padding: 14px 16px;
        border-color: rgba(255, 90, 61, 0.34);
        background: rgba(255, 90, 61, 0.1);
      }

      .payment-alert strong,
      .payment-alert span {
        display: block;
      }

      .payment-alert strong {
        color: #ffb5a7;
        margin-bottom: 4px;
      }

      .payment-alert span {
        color: var(--hc-text-muted);
        font-size: 13px;
      }

      .payment-alert button {
        border: 1px solid rgba(255, 90, 61, 0.4);
        background: rgba(255, 90, 61, 0.18);
        color: #ffb5a7;
        border-radius: 999px;
        padding: 9px 12px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
      }

      .credits-cockpit {
        position: relative;
        overflow: hidden;
        padding: 20px 22px 18px;
      }

      .credits-cockpit::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(90deg, transparent 0 27px, rgba(82, 214, 198, 0.06) 28px 29px),
          linear-gradient(90deg, rgba(206, 255, 53, 0.05), rgba(82, 214, 198, 0.05), transparent);
        pointer-events: none;
      }

      .section-heading {
        position: relative;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .section-heading span {
        color: var(--hc-lime);
        font-size: 24px;
        font-weight: 950;
      }

      .cockpit-grid,
      .preview-cockpit {
        position: relative;
        display: grid;
        grid-template-columns: 1fr 280px 1fr 1.1fr;
        align-items: center;
        gap: 28px;
        min-height: 176px;
      }

      .preview-cockpit {
        grid-template-columns: 180px 1fr;
      }

      .metric-tile {
        min-width: 0;
      }

      .metric-tile span,
      .usage-mini span {
        display: block;
        color: var(--hc-text-muted);
        font-size: 14px;
        font-weight: 800;
        margin-bottom: 9px;
      }

      .metric-tile strong {
        display: block;
        font-size: 40px;
        line-height: 0.95;
      }

      .metric-tile.cyan strong {
        color: var(--hc-cyan);
      }

      .metric-tile.amber strong,
      .ledger-change {
        color: var(--hc-amber);
      }

      .metric-tile small {
        display: block;
        margin-top: 8px;
        color: var(--hc-text-muted);
      }

      .radial-meter {
        width: 256px;
        height: 256px;
        display: grid;
        place-items: center;
        justify-self: center;
        border-radius: 50%;
        background:
          conic-gradient(from -28deg, var(--hc-lime) 0deg, var(--hc-cyan) var(--usage-angle), rgba(255, 255, 255, 0.1) var(--usage-angle), rgba(255, 255, 255, 0.1) 360deg);
        box-shadow: 0 0 42px rgba(82, 214, 198, 0.16);
      }

      .radial-meter::before {
        content: "";
        position: absolute;
        width: 222px;
        height: 222px;
        border-radius: 50%;
        background: #080a0d;
        box-shadow: inset 0 0 34px rgba(255, 255, 255, 0.07);
      }

      .radial-core {
        position: relative;
        display: grid;
        place-items: center;
        width: 178px;
        height: 178px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 50%;
        text-align: center;
      }

      .radial-core span {
        color: var(--hc-text);
        font-size: 17px;
        font-weight: 800;
      }

      .radial-core strong {
        margin-top: -12px;
        font-size: clamp(54px, 7vw, 76px);
        line-height: 0.95;
        letter-spacing: 0;
      }

      .radial-core small {
        margin-top: -12px;
        color: var(--hc-text-muted);
        font-size: 14px;
      }

      .usage-mini strong {
        display: block;
        color: var(--hc-lime);
        font-size: 36px;
        line-height: 1;
        margin-bottom: 12px;
      }

      .usage-mini small {
        color: var(--hc-text);
        font-size: 20px;
      }

      .usage-mini p {
        margin: 8px 0 0;
        color: var(--hc-text-muted);
        font-size: 13px;
      }

      .account-mid-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) minmax(310px, 0.9fr);
        gap: 14px;
        margin-top: 14px;
      }

      .studio-panel {
        padding: 18px 20px;
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 16px;
      }

      .panel-head h2 {
        margin: 0;
        font-size: 21px;
      }

      .segmented {
        display: flex;
        padding: 3px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
      }

      .segmented button {
        min-width: 44px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--hc-text-muted);
        padding: 7px 10px;
        font: inherit;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
      }

      .segmented button.active {
        background: rgba(206, 255, 53, 0.14);
        color: var(--hc-lime);
      }

      .equalizer-chart {
        position: relative;
        display: flex;
        align-items: flex-end;
        gap: 9px;
        height: 190px;
        padding: 14px 4px 0;
        background:
          linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px) 0 14px / 100% 43px;
      }

      .eq-column {
        flex: 1;
        min-width: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
      }

      .eq-column > i {
        width: min(100%, 16px);
        min-height: 6px;
        border-radius: 4px 4px 0 0;
        background: linear-gradient(180deg, var(--hc-lime), var(--hc-cyan));
        box-shadow: 0 0 16px rgba(82, 214, 198, 0.2);
      }

      .eq-column > i.stacked {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.08);
      }

      .eq-column b {
        background: linear-gradient(180deg, var(--hc-amber), var(--hc-coral));
      }

      .eq-column em {
        background: linear-gradient(180deg, var(--hc-lime), var(--hc-cyan));
      }

      .eq-column span {
        color: var(--hc-text-muted);
        font-size: 11px;
        white-space: nowrap;
      }

      .status-chip {
        border-radius: 6px;
        background: rgba(51, 210, 118, 0.14);
        color: #73f7a5;
        padding: 5px 8px;
        font-size: 12px;
        font-weight: 900;
      }

      .plan-card {
        display: grid;
        gap: 16px;
      }

      .plan-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .plan-title strong {
        color: var(--hc-text);
        font-size: 23px;
      }

      .plan-title span {
        color: var(--hc-lime);
        font-size: 13px;
        font-weight: 900;
      }

      .plan-card dl {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 0;
      }

      .plan-card dt {
        color: var(--hc-text-muted);
        font-size: 12px;
        margin-bottom: 6px;
      }

      .plan-card dd {
        margin: 0;
        color: var(--hc-text);
        font-size: 14px;
        font-weight: 800;
      }

      .plan-actions {
        display: flex;
        gap: 9px;
        flex-wrap: wrap;
      }

      .plan-actions button {
        border-color: rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.05);
        color: var(--hc-text);
      }

      .plan-actions .plan-primary {
        border-color: transparent;
        background: var(--hc-lime);
        color: #08090c;
      }

      .plan-actions .plan-danger {
        border-color: rgba(255, 90, 61, 0.42);
        color: #ff8b76;
      }

      .ledger-panel {
        margin-top: 14px;
      }

      .ledger-panel .panel-head button {
        background: transparent;
        color: var(--hc-lime);
      }

      .ledger-table {
        display: grid;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
      }

      .ledger-row {
        display: grid;
        grid-template-columns: 1.2fr 1fr 0.9fr 0.9fr 0.8fr;
        gap: 12px;
        align-items: center;
        min-height: 42px;
        padding: 0 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.07);
        color: var(--hc-text);
        font-size: 13px;
      }

      .ledger-row:first-child {
        border-top: 0;
      }

      .ledger-head {
        min-height: 36px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--hc-text-muted);
        font-size: 12px;
        font-weight: 900;
      }

      .ledger-status {
        color: var(--hc-lime);
        font-weight: 900;
      }

      .empty-ledger {
        display: grid;
        place-items: center;
        min-height: 120px;
        border: 1px dashed rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        color: var(--hc-text-muted);
        font-size: 13px;
      }

      .chart-empty {
        min-height: 190px;
      }

      .muted-text {
        position: relative;
        color: var(--hc-text-muted);
      }

      .account-state {
        width: min(520px, calc(100vw - 40px));
        padding: 30px;
        text-align: center;
      }

      .account-state p {
        margin: 10px 0 18px;
        color: var(--hc-text-muted);
      }

      .account-state strong {
        display: block;
        margin-top: 10px;
        color: var(--hc-text);
        font-size: 22px;
      }

      .account-state .account-state-loader {
        height: 4px;
        overflow: hidden;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(255,255,255,.08), var(--hc-lime), var(--hc-cyan), rgba(255,255,255,.08));
        background-size: 240% 100%;
        animation: account-load 1.1s ease-in-out infinite alternate;
      }

      .account-state-actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .account-button-ghost {
        border-color: rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.04);
        color: var(--hc-text);
      }

      @keyframes account-load {
        from { background-position: 0% 50%; }
        to { background-position: 100% 50%; }
      }

      @media (max-width: 1080px) {
        .account-studio-shell {
          grid-template-columns: 230px minmax(0, 1fr);
        }

        .account-rail {
          padding: 24px 20px;
        }

        .rail-nav {
          margin-left: -20px;
          margin-right: -20px;
        }

        .rail-nav button {
          padding-left: 20px;
          padding-right: 20px;
        }

        .cockpit-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .radial-meter {
          order: -1;
          grid-column: span 2;
        }

        .account-mid-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 760px) {
        .account-studio-shell {
          display: block;
        }

        .account-rail {
          position: static;
          min-height: auto;
          border-right: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }

        .account-main {
          padding: 24px 14px 42px;
        }

        .account-main-head,
        .payment-alert,
        .panel-head {
          align-items: stretch;
          flex-direction: column;
        }

        .account-button,
        .payment-alert button,
        .ledger-panel .panel-head button {
          width: 100%;
        }

        .cockpit-grid,
        .preview-cockpit {
          grid-template-columns: 1fr;
          gap: 18px;
        }

        .radial-meter {
          grid-column: auto;
          width: min(260px, 80vw);
          height: min(260px, 80vw);
        }

        .plan-card dl {
          grid-template-columns: 1fr;
        }

        .ledger-row {
          grid-template-columns: 1fr 0.8fr;
          gap: 6px 12px;
          padding: 10px 12px;
        }

        .ledger-row span:nth-child(3),
        .ledger-row span:nth-child(4),
        .ledger-row span:nth-child(5) {
          text-align: left;
        }

        .ledger-head {
          display: none;
        }
      }
`;

function AccountStyles() {
  return <style dangerouslySetInnerHTML={{ __html: accountStyles }} />;
}
