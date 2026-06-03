'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useMembershipStore } from '@/store/membershipStore';
import { useCreditStore } from '@/store/creditStore';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import SubscriptionPanel from '@/components/membership/SubscriptionPanel';
import ProfileSettings from '@/components/account/ProfileSettings';
import type { PaymentRecord } from '@/types/payment';
import type { CreditHistory } from '@/types/credits';
import type { MembershipTier } from '@/types/membership';

export default function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
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
    if (!user) {
      router.replace('/login?redirectTo=/account');
    }
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
        setPurchaseHistory(data.filter((r: PaymentRecord) => r.status !== 'pending'));
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
      const res = await fetchWithAuth('/api/membership/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      if (res.ok) {
        fetchMembership({ force: true });
        fetchCredits({ force: true });
      } else {
        const data = await res.json();
        setPaymentError(data.error || '升级失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    }
  };

  const handleDowngrade = async (targetTier: MembershipTier) => {
    try {
      const res = await fetchWithAuth('/api/membership/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      if (res.ok) {
        fetchMembership({ force: true });
      } else {
        const data = await res.json();
        setPaymentError(data.error || '降级失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    }
  };

  const handleCancel = async () => {
    try {
      const res = await fetchWithAuth('/api/membership/cancel', { method: 'POST' });
      if (res.ok) {
        fetchMembership({ force: true });
      } else {
        const data = await res.json();
        setPaymentError(data.error || '取消订阅失败');
      }
    } catch {
      setPaymentError('网络连接失败，请检查网络后重试');
    }
  };

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
    () => (monthlyTrendData.length > 0 ? Math.max(...monthlyTrendData.map((h) => h.total), 1) : 1),
    [monthlyTrendData]
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
            <button className="hc-button" onClick={handleRetryAccountData}>
              重新同步
            </button>
            <button className="hc-button hc-button-ghost" onClick={() => router.push('/studio')}>
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
  const purchasedBalance = credits?.purchasedBalance ?? 0;
  const totalAvailable = credits?.totalAvailable ?? 0;
  const availablePool = Math.max(totalAvailable, 1);
  const monthlySharePercent = credits ? Math.min(100, (monthlyRemaining / availablePool) * 100) : 0;
  const purchasedSharePercent = credits ? Math.min(100, (purchasedBalance / availablePool) * 100) : 0;
  const previewPercent = !isPaid && previewCount?.total
    ? Math.min(100, (previewCount.used / previewCount.total) * 100)
    : 0;

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <div>
            <span>账户中心</span>
            <h1>账户管理</h1>
            <p>{user.email} · 管理你的会员订阅、额度余额和创作记录。</p>
          </div>
          <button onClick={signOut} className="hc-button hc-button-ghost">
            退出登录
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

        <ProfileSettings />

        <section className="account-grid">
          <article className="account-card usage-card">
            <div className="card-heading">
              <span>额度</span>
              <h2>本月用量</h2>
            </div>

            {isPaid && credits ? (
              <>
                <div className="credit-hero">
                  <div>
                    <span className="credit-label">总可用</span>
                    <strong>{totalAvailable}</strong>
                    <small>点额度</small>
                  </div>
                  <button type="button" onClick={() => router.push('/pricing#credits-pack')}>
                    购买额度
                  </button>
                </div>

                <div className="credit-wallet" aria-label="额度钱包构成">
                  <div className="wallet-card monthly">
                    <span>月度剩余</span>
                    <strong>{monthlyRemaining}</strong>
                    <small>
                      {monthlyRemaining > 0
                        ? `本月配额 ${credits.monthlyTotal} · 已用 ${credits.monthlyUsed}`
                        : '月度额度已用尽，正在使用购买额度'}
                    </small>
                  </div>
                  <div className="wallet-card purchased">
                    <span>购买额度</span>
                    <strong>{purchasedBalance}</strong>
                    <small>{purchasedBalance > 0 ? '后续生成会从这里扣除，不会因月度额度用尽而中断' : '购买后会显示在这里，并参与生成扣减'}</small>
                  </div>
                </div>

                <div className="wallet-stack" aria-label="可用额度构成">
                  <i style={{ width: `${monthlySharePercent}%` }} />
                  <b style={{ width: `${purchasedSharePercent}%` }} />
                </div>
                <div className="wallet-legend">
                  <span><i />月度剩余 {monthlyRemaining}</span>
                  <span><b />购买余额 {purchasedBalance}</span>
                </div>

                <div className="monthly-usage">
                  <div>
                    <span>本月消耗</span>
                    <b>{credits.monthlyUsed} / {credits.monthlyTotal}</b>
                  </div>
                  <div className="progress-track" aria-label="本月额度使用进度">
                    <div style={{ width: `${monthlyPercent}%` }} />
                  </div>
                </div>
              </>
            ) : !isPaid && previewCount ? (
              <>
                <div className="metric-line">
                  <strong>{previewCount.used}</strong>
                  <span>/ {previewCount.total} 次预览已使用</span>
                </div>
                <div className="progress-track" aria-label="免费预览使用进度">
                  <div style={{ width: `${previewPercent}%` }} />
                </div>
                <div className="preview-dots">
                  {Array.from({ length: previewCount.total }).map((_, i) => (
                    <span key={i} className={i < previewCount.used ? 'used' : ''}>
                      {i + 1}
                    </span>
                  ))}
                </div>
                <p>剩余 {previewCount.remaining} 次预览</p>
              </>
            ) : (
              <p>正在加载额度...</p>
            )}
          </article>

          <article className="account-card trend-card">
            <div className="card-heading row">
              <div>
                <span>趋势</span>
                <h2>使用趋势</h2>
              </div>
              <div className="segmented">
                <button className={trendView === 'day' ? 'active' : ''} onClick={() => setTrendView('day')}>
                  日
                </button>
                <button className={trendView === 'month' ? 'active' : ''} onClick={() => setTrendView('month')}>
                  月
                </button>
              </div>
            </div>

            {trendView === 'month' && monthlyTrendData.length > 0 ? (
              <div className="bar-chart" role="img" aria-label="月度额度使用趋势柱状图">
                {monthlyTrendData.map((month) => {
                  const monthlyHeight = maxUsage > 0 ? ((month.monthlyUsed ?? 0) / maxUsage) * 100 : 0;
                  const purchasedHeight = maxUsage > 0 ? ((month.purchasedUsed ?? 0) / maxUsage) * 100 : 0;
                  const totalHeight = monthlyHeight + purchasedHeight;
                  return (
                    <div key={month.month} className="bar-column">
                      <div
                        className="stacked-bar"
                        style={{ height: `${Math.max(totalHeight, month.used > 0 ? 6 : 4)}%` }}
                        title={`${month.month}: 月度 ${month.monthlyUsed ?? 0} + 购买 ${month.purchasedUsed ?? 0} / ${month.total}`}
                      >
                        {(month.purchasedUsed ?? 0) > 0 && <i style={{ flex: purchasedHeight }} />}
                        {((month.monthlyUsed ?? 0) > 0 || month.used > 0) && <b style={{ flex: monthlyHeight || 1 }} />}
                      </div>
                      <span>{month.month.slice(5)}月</span>
                    </div>
                  );
                })}
              </div>
            ) : trendView === 'day' && dailyData.length > 0 ? (
              <div className="bar-chart daily" role="img" aria-label="每日创作趋势柱状图">
                {dailyData.map((day) => {
                  const maxDaily = Math.max(...dailyData.map((d) => d.count), 1);
                  const height = (day.count / maxDaily) * 100;
                  return (
                    <div key={day.date} className="bar-column">
                      <div className={day.count > 0 ? 'single-bar active' : 'single-bar'} style={{ height: `${Math.max(height, 4)}%` }} title={`${day.date}: ${day.count} 次创作`} />
                      <span>{day.date.slice(8)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-chart">暂无历史数据</div>
            )}
          </article>
        </section>

        <SubscriptionPanel
          membership={membership}
          creditsPurchaseHistory={purchaseHistory}
          onUpgrade={handleUpgrade}
          onDowngrade={handleDowngrade}
          onCancel={handleCancel}
          onBuyCredits={() => router.push('/pricing#credits-pack')}
        />
      </div>
      <AccountStyles />
    </main>
  );
}

const accountStyles = `
      .account-page {
        min-height: 100vh;
        background:
          radial-gradient(circle at 12% 12%, rgba(206, 255, 53, 0.10), transparent 300px),
          radial-gradient(circle at 88% 20%, rgba(82, 214, 198, 0.08), transparent 340px),
          var(--hc-bg);
        color: var(--hc-text);
        padding: 42px 22px 72px;
      }

      .account-centered {
        display: grid;
        place-items: center;
      }

      .account-shell {
        max-width: 1040px;
        margin: 0 auto;
      }

      .account-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 26px;
      }

      .account-header span,
      .card-heading span,
      .account-state span {
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .1em;
        text-transform: uppercase;
      }

      .account-header h1 {
        margin: 8px 0 8px;
        font-size: clamp(34px, 5vw, 58px);
        line-height: 1;
        letter-spacing: 0;
      }

      .account-header p,
      .usage-card p {
        margin: 0;
        color: var(--hc-muted);
        font-size: 14px;
        overflow-wrap: anywhere;
      }

      .payment-alert,
      .account-card,
      .account-state {
        border: 1px solid var(--hc-line);
        background: rgba(24, 26, 34, 0.88);
        border-radius: var(--hc-radius-lg);
        box-shadow: var(--hc-shadow);
      }

      .payment-alert {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 20px;
        padding: 16px;
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
        color: var(--hc-muted);
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

      .account-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
        margin: 22px 0;
      }

      .account-card {
        padding: 22px;
        min-width: 0;
      }

      .usage-card {
        background:
          linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.018)),
          rgba(18,20,27,.92);
      }

      .card-heading {
        margin-bottom: 18px;
      }

      .card-heading.row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .card-heading h2 {
        margin: 6px 0 0;
        color: var(--hc-text);
        font-size: 18px;
      }

      .credit-hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
        padding: 18px 20px;
        border: 1px solid rgba(206,255,53,.24);
        border-radius: 12px;
        background:
          linear-gradient(135deg, rgba(206,255,53,.14), rgba(82,214,198,.08) 52%, rgba(255,255,255,.035)),
          rgba(8,9,12,.5);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      }

      .credit-hero > div {
        min-width: 0;
      }

      .credit-label {
        display: block;
        color: var(--hc-muted);
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 7px;
      }

      .credit-hero strong {
        color: var(--hc-lime);
        font-size: clamp(50px, 7vw, 74px);
        line-height: .9;
        letter-spacing: 0;
      }

      .credit-hero small {
        margin-left: 8px;
        color: var(--hc-text);
        font-size: 13px;
        font-weight: 900;
      }

      .credit-hero button {
        min-height: 42px;
        border: 1px solid rgba(206,255,53,.42);
        border-radius: 999px;
        background: linear-gradient(135deg, var(--hc-lime), #73e8c6);
        color: #08090c;
        padding: 0 18px;
        font-size: 13px;
        font-weight: 950;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 12px 28px rgba(206,255,53,.16);
      }

      .credit-wallet {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }

      .wallet-card {
        min-width: 0;
        min-height: 122px;
        padding: 15px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 10px;
        background: rgba(8,9,12,.36);
      }

      .wallet-card.purchased {
        border-color: rgba(245,197,66,.44);
        background:
          linear-gradient(160deg, rgba(245,197,66,.18), rgba(255,90,61,.07)),
          rgba(8,9,12,.34);
      }

      .wallet-card span,
      .monthly-usage span {
        display: block;
        color: var(--hc-muted);
        font-size: 12px;
        font-weight: 900;
        margin-bottom: 7px;
      }

      .wallet-card strong {
        display: block;
        color: var(--hc-text);
        font-size: 34px;
        line-height: 1;
      }

      .wallet-card.purchased strong {
        color: var(--hc-amber);
      }

      .wallet-card small {
        display: block;
        margin-top: 9px;
        color: var(--hc-muted);
        font-size: 12px;
        line-height: 1.55;
      }

      .wallet-stack {
        display: flex;
        height: 9px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,.08);
      }

      .wallet-stack i,
      .wallet-stack b {
        min-width: 0;
        transition: width .25s ease;
      }

      .wallet-stack i {
        background: linear-gradient(90deg, var(--hc-lime), var(--hc-cyan));
      }

      .wallet-stack b {
        background: linear-gradient(90deg, var(--hc-amber), var(--hc-coral));
      }

      .wallet-legend {
        display: flex;
        justify-content: flex-start;
        gap: 18px;
        margin: 10px 0 18px;
        color: var(--hc-muted);
        font-size: 12px;
        flex-wrap: wrap;
      }

      .wallet-legend span {
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }

      .wallet-legend i,
      .wallet-legend b {
        width: 8px;
        height: 8px;
        border-radius: 999px;
      }

      .wallet-legend i {
        background: var(--hc-cyan);
      }

      .wallet-legend b {
        background: var(--hc-amber);
      }

      .monthly-usage {
        padding: 14px;
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 10px;
        background: rgba(8,9,12,.28);
      }

      .monthly-usage > div:first-child {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .monthly-usage b {
        color: var(--hc-text);
        font-size: 12px;
      }

      .metric-line {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }

      .metric-line strong {
        color: var(--hc-lime);
        font-size: 42px;
        line-height: 1;
      }

      .metric-line span,
      .usage-meta {
        color: var(--hc-muted);
        font-size: 13px;
      }

      .progress-track {
        height: 9px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,.08);
      }

      .progress-track div {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--hc-lime), var(--hc-cyan));
        transition: width .25s ease;
      }

      .usage-meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin: 10px 0 8px;
        flex-wrap: wrap;
      }

      .preview-dots {
        display: flex;
        gap: 8px;
        margin: 12px 0 10px;
        flex-wrap: wrap;
      }

      .preview-dots span {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        border: 1px solid rgba(206, 255, 53, 0.32);
        color: var(--hc-lime);
        font-size: 12px;
        font-weight: 900;
      }

      .preview-dots span.used {
        border-color: var(--hc-line);
        color: var(--hc-muted);
        background: rgba(255,255,255,.05);
      }

      .segmented {
        display: flex;
        padding: 3px;
        gap: 3px;
        border: 1px solid var(--hc-line);
        border-radius: 999px;
        background: rgba(255,255,255,.03);
      }

      .segmented button {
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--hc-muted);
        padding: 6px 11px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .segmented button.active {
        background: rgba(206, 255, 53, 0.13);
        color: var(--hc-lime);
      }

      .bar-chart {
        height: 142px;
        display: flex;
        align-items: flex-end;
        gap: 10px;
      }

      .bar-chart.daily {
        gap: 5px;
      }

      .bar-column {
        flex: 1;
        min-width: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
      }

      .stacked-bar,
      .single-bar {
        width: min(100%, 32px);
        min-height: 4px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        overflow: hidden;
        border-radius: 6px 6px 0 0;
        background: rgba(255,255,255,.06);
      }

      .single-bar {
        width: min(100%, 20px);
      }

      .single-bar.active,
      .stacked-bar b {
        background: linear-gradient(180deg, var(--hc-lime), rgba(82,214,198,.7));
      }

      .stacked-bar i {
        background: linear-gradient(180deg, #f5c542, var(--hc-coral));
      }

      .bar-column span {
        color: var(--hc-muted);
        font-size: 10px;
        white-space: nowrap;
      }

      .empty-chart {
        height: 142px;
        display: grid;
        place-items: center;
        color: var(--hc-muted);
        font-size: 13px;
      }

      .account-state {
        width: min(520px, calc(100vw - 40px));
        padding: 30px;
        text-align: center;
      }

      .account-state p {
        margin: 10px 0 18px;
        color: var(--hc-muted);
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

      @keyframes account-load {
        from { background-position: 0% 50%; }
        to { background-position: 100% 50%; }
      }

      @media (max-width: 760px) {
        .account-page {
          padding: 28px 14px 56px;
        }

        .account-header,
        .payment-alert {
          align-items: stretch;
          flex-direction: column;
        }

        .account-header .hc-button,
        .payment-alert button {
          width: 100%;
        }

        .card-heading.row {
          align-items: stretch;
          flex-direction: column;
        }

        .account-grid {
          grid-template-columns: 1fr;
        }

        .credit-hero {
          align-items: stretch;
          flex-direction: column;
        }

        .credit-hero button {
          width: 100%;
        }

        .credit-wallet {
          grid-template-columns: 1fr;
        }

        .bar-chart {
          gap: 7px;
        }

        .segmented {
          width: 100%;
        }

        .segmented button {
          flex: 1;
        }
      }
`;

function AccountStyles() {
  return <style dangerouslySetInnerHTML={{ __html: accountStyles }} />;
}
