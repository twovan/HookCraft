'use client';

import { useState } from 'react';
import type { MembershipInfo, MembershipTier, FeatureKey } from '@/types/membership';
import type { PaymentRecord } from '@/types/payment';
import { TIER_CONFIGS } from '@/config/tierConfig';

export interface SubscriptionPanelProps {
  membership: MembershipInfo;
  creditsPurchaseHistory: PaymentRecord[];
  onUpgrade?: (targetTier: MembershipTier) => void;
  onDowngrade?: (targetTier: MembershipTier) => void;
  onCancel?: () => void;
  onChangePayment?: () => void;
  onBuyCredits?: () => void;
}

const TIER_LABELS: Record<MembershipTier, string> = {
  free: '免费版',
  pro: '专业版',
  business: '商业版',
};

const STATUS_LABELS: Record<MembershipInfo['status'], string> = {
  active: '活跃',
  cancelled: '已取消',
  expiring: '即将到期',
  expired: '已过期',
  grace_period: '宽限期',
};

const FEATURE_LABELS: Partial<Record<FeatureKey, string>> = {
  full_demo: '完整 Demo 生成',
  premium_singer: '高级歌手声模',
  paid_template: '付费模板',
  priority_queue: '优先队列',
  ai_mixing: 'AI 辅助混音',
  ai_mastering: 'AI 母带处理',
  export_wav: 'WAV 导出',
  export_midi: 'MIDI 导出',
  export_stems: '分轨导出',
  commercial_use: '个人商用授权',
  full_commercial_use: '完整商用授权',
  credits_pack_discount: '额度充值包折扣',
  image_input: '图片灵感输入',
};

export default function SubscriptionPanel({
  membership,
  creditsPurchaseHistory,
  onUpgrade,
  onDowngrade,
  onCancel,
  onBuyCredits,
}: SubscriptionPanelProps) {
  const [downgradeTarget, setDowngradeTarget] = useState<MembershipTier | null>(null);
  const [upgradeTarget, setUpgradeTarget] = useState<MembershipTier | null>(null);

  const currentConfig = TIER_CONFIGS[membership.tier];

  const getLostFeatures = (targetTier: MembershipTier): FeatureKey[] => {
    const targetFeatures = new Set(TIER_CONFIGS[targetTier].features);
    return currentConfig.features.filter((feature) => !targetFeatures.has(feature));
  };

  const calculateProratedPrice = (targetTier: MembershipTier): number => {
    if (!membership.expiresAt) return TIER_CONFIGS[targetTier].monthlyPrice;
    const now = new Date();
    const expiresAt = new Date(membership.expiresAt);
    const remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const currentDailyRate = currentConfig.monthlyPrice / 30;
    const targetDailyRate = TIER_CONFIGS[targetTier].monthlyPrice / 30;
    return Math.max(0, Math.round((targetDailyRate - currentDailyRate) * remainingDays));
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatAmount = (amount: number): string => `¥${(amount / 100).toFixed(2)}`;

  const nextUpgradeTier: MembershipTier | null = membership.tier === 'free' ? 'pro' : membership.tier === 'pro' ? 'business' : null;
  const nextDowngradeTier: MembershipTier | null = membership.tier === 'business' ? 'pro' : membership.tier === 'pro' ? 'free' : null;

  return (
    <section className="subscription-panel">
      <header className="panel-head">
        <div>
          <span>订阅</span>
          <h2>订阅管理</h2>
        </div>
        <b>{STATUS_LABELS[membership.status]}</b>
      </header>

      <div className="current-plan">
        <div className="plan-title">
          <strong>{TIER_LABELS[membership.tier]}</strong>
          {membership.tier !== 'free' && <span>{formatAmount(currentConfig.monthlyPrice)}/月</span>}
        </div>
        <div className="plan-grid">
          <InfoCell label="到期日期" value={membership.tier === 'free' ? '永久免费' : formatDate(membership.expiresAt)} />
          <InfoCell label="自动续费" value={membership.tier === 'free' ? '-' : membership.autoRenew ? '已开启' : '已关闭'} />
          <InfoCell label="月度额度" value={currentConfig.monthlyCredits > 0 ? `${currentConfig.monthlyCredits} 点额度` : `${currentConfig.monthlyPreviews} 次预览`} />
          <InfoCell label="计费周期" value={membership.billingCycle === 'monthly' ? '月付' : membership.billingCycle === 'yearly' ? '年付' : '-'} />
        </div>
      </div>

      <div className="action-row">
        {nextUpgradeTier && onUpgrade && (
          <button className="primary" onClick={() => { setUpgradeTarget(nextUpgradeTier); setDowngradeTarget(null); }}>
            升级到 {TIER_LABELS[nextUpgradeTier]}
          </button>
        )}
        {nextDowngradeTier && onDowngrade && (
          <button onClick={() => { setDowngradeTarget(nextDowngradeTier); setUpgradeTarget(null); }}>降级</button>
        )}
        {membership.tier !== 'free' && membership.status !== 'cancelled' && onCancel && (
          <button className="danger" onClick={onCancel}>取消订阅</button>
        )}
        {membership.tier !== 'free' && onBuyCredits && (
          <button onClick={onBuyCredits}>购买额度充值包</button>
        )}
      </div>

      {downgradeTarget && (
        <div className="notice danger" role="alert">
          <h3>降级后将失去以下功能</h3>
          <ul>
            {getLostFeatures(downgradeTarget).map((feature) => <li key={feature}>{FEATURE_LABELS[feature] || feature}</li>)}
          </ul>
          <p>降级将在当前计费周期结束后生效，届时等级将变为 {TIER_LABELS[downgradeTarget]}。</p>
          <div className="notice-actions">
            <button className="danger-fill" onClick={() => { onDowngrade?.(downgradeTarget); setDowngradeTarget(null); }}>确认降级</button>
            <button onClick={() => setDowngradeTarget(null)}>取消</button>
          </div>
        </div>
      )}

      {upgradeTarget && (
        <div className="notice success">
          <h3>升级到 {TIER_LABELS[upgradeTarget]}</h3>
          <p>按剩余天数比例计算差价，预计补缴：</p>
          <strong>{formatAmount(calculateProratedPrice(upgradeTarget))}</strong>
          <div className="notice-actions">
            <button className="primary" onClick={() => { onUpgrade?.(upgradeTarget); setUpgradeTarget(null); }}>确认升级</button>
            <button onClick={() => setUpgradeTarget(null)}>取消</button>
          </div>
        </div>
      )}

      <section className="purchase-history">
        <h3>额度充值记录</h3>
        {creditsPurchaseHistory.length === 0 ? (
          <div className="empty-history">暂无充值记录</div>
        ) : (
          <CreditsPurchaseList records={creditsPurchaseHistory} />
        )}
      </section>

      <style>{`
        .subscription-panel {
          border: 1px solid var(--hc-line);
          border-radius: var(--hc-radius-lg);
          background: rgba(24,26,34,.88);
          box-shadow: var(--hc-shadow);
          padding: 24px;
        }

        .panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panel-head span {
          color: var(--hc-lime);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .panel-head h2 {
          margin: 6px 0 0;
          color: var(--hc-text);
          font-size: 22px;
        }

        .panel-head b,
        .plan-title span {
          border: 1px solid rgba(206,255,53,.32);
          border-radius: 999px;
          background: rgba(206,255,53,.1);
          color: var(--hc-lime);
          padding: 6px 10px;
          font-size: 12px;
          white-space: nowrap;
        }

        .current-plan {
          border: 1px solid var(--hc-line);
          border-radius: var(--hc-radius);
          background: rgba(8,9,12,.34);
          padding: 18px;
          margin-bottom: 18px;
        }

        .plan-title {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          margin-bottom: 16px;
        }

        .plan-title strong {
          color: var(--hc-lime);
          font-size: 22px;
        }

        .plan-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .info-cell span {
          display: block;
          color: var(--hc-muted);
          font-size: 12px;
          margin-bottom: 4px;
        }

        .info-cell strong {
          color: var(--hc-text);
          font-size: 14px;
        }

        .action-row,
        .notice-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .action-row {
          margin-bottom: 18px;
        }

        .action-row button,
        .notice-actions button {
          border: 1px solid var(--hc-line);
          border-radius: 999px;
          background: rgba(255,255,255,.04);
          color: var(--hc-text);
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        button.primary,
        .notice-actions button.primary {
          border-color: transparent;
          background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
          color: #08090c;
        }

        button.danger {
          border-color: rgba(255,90,61,.34);
          color: #ff8b76;
        }

        .danger-fill {
          border-color: transparent !important;
          background: #ff5a3d !important;
          color: #08090c !important;
        }

        .notice {
          border-radius: var(--hc-radius);
          padding: 16px;
          margin-bottom: 18px;
        }

        .notice h3 {
          margin: 0 0 10px;
          font-size: 15px;
        }

        .notice p {
          color: var(--hc-muted);
          margin: 0 0 12px;
          line-height: 1.6;
        }

        .notice strong {
          display: block;
          color: var(--hc-lime);
          font-size: 24px;
          margin-bottom: 12px;
        }

        .notice ul {
          margin: 0 0 12px;
          padding-left: 20px;
          color: var(--hc-muted);
        }

        .notice.danger {
          border: 1px solid rgba(255,90,61,.34);
          background: rgba(255,90,61,.1);
        }

        .notice.success {
          border: 1px solid rgba(206,255,53,.3);
          background: rgba(206,255,53,.08);
        }

        .purchase-history h3 {
          margin: 0 0 14px;
          color: var(--hc-text);
          font-size: 16px;
        }

        .empty-history {
          border: 1px solid var(--hc-line);
          border-radius: 12px;
          background: rgba(8,9,12,.34);
          color: var(--hc-muted);
          padding: 22px;
          text-align: center;
          font-size: 13px;
        }

        .history-list {
          display: grid;
          gap: 8px;
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid var(--hc-line);
          border-radius: 12px;
          background: rgba(8,9,12,.34);
          padding: 12px 14px;
        }

        .history-item span {
          color: var(--hc-muted);
          font-size: 12px;
        }

        .history-item strong {
          color: var(--hc-text);
          font-size: 13px;
        }

        .history-item b {
          color: var(--hc-lime);
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
        }

        .pagination button {
          border: 1px solid var(--hc-line);
          border-radius: 999px;
          background: rgba(255,255,255,.04);
          color: var(--hc-text);
          padding: 8px 12px;
          cursor: pointer;
        }

        .pagination button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .plan-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-cell">
      <span>{label}</span>
      <strong>{value}</strong>
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

function CreditsPurchaseList({ records }: { records: PaymentRecord[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = new Date((a as any).created_at || a.createdAt || 0).getTime();
    const dateB = new Date((b as any).created_at || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const paginatedRecords = sortedRecords.slice((page - 1) * pageSize, page * pageSize);

  const fmtDate = (date: Date | string | null): string => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const fmtAmount = (amount: number): string => `¥${(amount / 100).toFixed(2)}`;

  return (
    <div>
      <div className="history-list">
        {paginatedRecords.map((record) => {
          const creditsAmount = getCreditsFromAmount(record.amount);
          return (
            <div key={record.id} className="history-item">
              <div>
                <strong>额度充值包 {creditsAmount ? `+${creditsAmount} 点额度` : ''}</strong>
                <span>{fmtDate(record.createdAt || (record as any).created_at || (record as any).completed_at)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>{fmtAmount(record.amount)}</b>
                <span>{record.status === 'completed' ? '已完成' : record.status === 'pending' ? '处理中' : record.status === 'failed' ? '失败' : '已退款'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</button>
        </div>
      )}
    </div>
  );
}
