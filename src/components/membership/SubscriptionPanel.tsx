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

/** Feature display names */
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
  credits_pack_discount: 'Credits 充值折扣',
  image_input: '图片灵感输入',
};

/**
 * 订阅管理面板
 * - 显示当前等级、到期日期、自动续费状态
 * - 升级/降级/取消按钮
 * - 降级显示失去功能警告
 * - 升级显示按比例差价
 * - Credits Pack 购买历史
 */
export default function SubscriptionPanel({
  membership,
  creditsPurchaseHistory,
  onUpgrade,
  onDowngrade,
  onCancel,
  onBuyCredits,
}: SubscriptionPanelProps) {
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<MembershipTier | null>(null);
  const [showUpgradeInfo, setShowUpgradeInfo] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<MembershipTier | null>(null);

  const currentConfig = TIER_CONFIGS[membership.tier];
  const tierOrder: Record<MembershipTier, number> = { free: 0, pro: 1, business: 2 };

  // Calculate lost features for downgrade
  const getLostFeatures = (targetTier: MembershipTier): FeatureKey[] => {
    const currentFeatures = TIER_CONFIGS[membership.tier].features;
    const targetFeatures = new Set(TIER_CONFIGS[targetTier].features);
    return currentFeatures.filter((f) => !targetFeatures.has(f));
  };

  // Calculate prorated price for upgrade
  const calculateProratedPrice = (targetTier: MembershipTier): number => {
    if (!membership.expiresAt) return TIER_CONFIGS[targetTier].monthlyPrice;
    const now = new Date();
    const expiresAt = new Date(membership.expiresAt);
    const remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const currentDailyRate = currentConfig.monthlyPrice / 30;
    const targetDailyRate = TIER_CONFIGS[targetTier].monthlyPrice / 30;
    return Math.max(0, Math.round((targetDailyRate - currentDailyRate) * remainingDays));
  };

  const handleDowngradeClick = (target: MembershipTier) => {
    setDowngradeTarget(target);
    setShowDowngradeWarning(true);
    setShowUpgradeInfo(false);
  };

  const handleUpgradeClick = (target: MembershipTier) => {
    setUpgradeTarget(target);
    setShowUpgradeInfo(true);
    setShowDowngradeWarning(false);
  };

  const confirmDowngrade = () => {
    if (downgradeTarget && onDowngrade) {
      onDowngrade(downgradeTarget);
    }
    setShowDowngradeWarning(false);
    setDowngradeTarget(null);
  };

  const confirmUpgrade = () => {
    if (upgradeTarget && onUpgrade) {
      onUpgrade(upgradeTarget);
    }
    setShowUpgradeInfo(false);
    setUpgradeTarget(null);
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatAmount = (amount: number): string => {
    return `¥${(amount / 100).toFixed(2)}`;
  };

  return (
    <div
      style={{
        background: '#1a1a2e',
        borderRadius: '20px',
        padding: '32px',
        border: '1px solid #2a2a40',
        boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
      }}
    >
      {/* Header */}
      <h2
        style={{
          fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          fontSize: '22px',
          fontWeight: 700,
          color: '#e8e8f0',
          margin: '0 0 24px 0',
        }}
      >
        订阅管理
      </h2>

      {/* Current Plan Info */}
      <div
        style={{
          background: '#0d0d14',
          borderRadius: '16px',
          padding: '20px 24px',
          border: '1px solid #2a2a40',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#7536d5',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}
            >
              {currentConfig.name}
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                background: membership.status === 'active'
                  ? 'rgba(72, 187, 120, 0.1)'
                  : membership.status === 'cancelled'
                    ? 'rgba(237, 137, 54, 0.1)'
                    : membership.status === 'expiring'
                      ? 'rgba(237, 137, 54, 0.1)'
                      : 'rgba(229, 62, 62, 0.1)',
                color: membership.status === 'active'
                  ? '#38A169'
                  : membership.status === 'cancelled'
                    ? '#DD6B20'
                    : membership.status === 'expiring'
                      ? '#DD6B20'
                      : '#E53E3E',
              }}
            >
              {membership.status === 'active' && '活跃'}
              {membership.status === 'cancelled' && '已取消'}
              {membership.status === 'expiring' && '即将到期'}
              {membership.status === 'expired' && '已过期'}
              {membership.status === 'grace_period' && '宽限期'}
            </span>
          </div>
          {membership.tier !== 'free' && (
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#e8e8f0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
              {formatAmount(currentConfig.monthlyPrice)}/月
            </span>
          )}
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>到期日期</div>
            <div style={{ fontSize: '14px', color: '#e8e8f0', fontWeight: 500 }}>
              {membership.tier === 'free' ? '永久免费' : formatDate(membership.expiresAt)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>自动续费</div>
            <div style={{ fontSize: '14px', color: '#e8e8f0', fontWeight: 500 }}>
              {membership.tier === 'free' ? '—' : membership.autoRenew ? '已开启' : '已关闭'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>月度 Credits</div>
            <div style={{ fontSize: '14px', color: '#e8e8f0', fontWeight: 500 }}>
              {currentConfig.monthlyCredits > 0 ? `${currentConfig.monthlyCredits} Credits` : `${currentConfig.monthlyPreviews} 次预览`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>计费周期</div>
            <div style={{ fontSize: '14px', color: '#e8e8f0', fontWeight: 500 }}>
              {membership.billingCycle === 'monthly' ? '月付' : membership.billingCycle === 'yearly' ? '年付' : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {/* Upgrade buttons */}
        {membership.tier !== 'business' && (
          <button
            onClick={() => handleUpgradeClick(membership.tier === 'free' ? 'pro' : 'business')}
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: 'none',
              background: 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              boxShadow: '0 2px 8px rgba(117, 54, 213, 0.3)',
            }}
          >
            升级到{TIER_CONFIGS[membership.tier === 'free' ? 'pro' : 'business'].name}
          </button>
        )}

        {/* Downgrade button */}
        {membership.tier !== 'free' && (
          <button
            onClick={() => handleDowngradeClick(membership.tier === 'business' ? 'pro' : 'free')}
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: '1px solid #2a2a40',
              background: 'transparent',
              color: '#9ca3af',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            降级
          </button>
        )}

        {/* Cancel button */}
        {membership.tier !== 'free' && membership.status !== 'cancelled' && onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: '1px solid rgba(229, 57, 53, 0.3)',
              background: 'transparent',
              color: '#E53E3E',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            取消订阅
          </button>
        )}

        {/* Buy Credits */}
        {membership.tier !== 'free' && onBuyCredits && (
          <button
            onClick={onBuyCredits}
            style={{
              padding: '10px 20px',
              borderRadius: '20px',
              border: '1px solid #2a2a40',
              background: '#0d0d14',
              color: '#7536d5',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            购买 Credits 充值包
          </button>
        )}
      </div>

      {/* Downgrade Warning */}
      {showDowngradeWarning && downgradeTarget && (
        <div
          style={{
            background: 'rgba(229, 57, 53, 0.1)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            marginBottom: '24px',
          }}
          role="alert"
        >
          <h4
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#C53030',
              margin: '0 0 12px 0',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            ⚠️ 降级后将失去以下功能
          </h4>
          <ul style={{ margin: '0 0 16px 0', padding: '0 0 0 20px', listStyle: 'disc' }}>
            {getLostFeatures(downgradeTarget).map((feature) => (
              <li
                key={feature}
                style={{ fontSize: '13px', color: '#742A2A', marginBottom: '6px', lineHeight: 1.5 }}
              >
                {FEATURE_LABELS[feature] || feature}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: '13px', color: '#742A2A', margin: '0 0 16px 0' }}>
            降级将在当前计费周期结束后生效，届时您的等级将变为{TIER_CONFIGS[downgradeTarget].name}。
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={confirmDowngrade}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: 'none',
                background: '#E53E3E',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}
            >
              确认降级
            </button>
            <button
              onClick={() => { setShowDowngradeWarning(false); setDowngradeTarget(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: '1px solid #2a2a40',
                background: '#1a1a2e',
                color: '#9ca3af',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Info */}
      {showUpgradeInfo && upgradeTarget && (
        <div
          style={{
            background: '#F0FFF4',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #C6F6D5',
            marginBottom: '24px',
          }}
        >
          <h4
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#276749',
              margin: '0 0 12px 0',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            ✨ 升级到{TIER_CONFIGS[upgradeTarget].name}
          </h4>
          <p style={{ fontSize: '13px', color: '#2F855A', margin: '0 0 8px 0' }}>
            按剩余天数比例计算差价，仅需补缴：
          </p>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#276749',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              marginBottom: '16px',
            }}
          >
            {formatAmount(calculateProratedPrice(upgradeTarget))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={confirmUpgrade}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(135deg, #7536d5 0%, #5a2db8 100%)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}
            >
              确认升级
            </button>
            <button
              onClick={() => { setShowUpgradeInfo(false); setUpgradeTarget(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '16px',
                border: '1px solid #2a2a40',
                background: '#1a1a2e',
                color: '#9ca3af',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Credits Pack Purchase History */}
      <div>
        <h3
          style={{
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: '16px',
            fontWeight: 600,
            color: '#e8e8f0',
            margin: '0 0 16px 0',
          }}
        >
          Credits 充值记录
        </h3>
        {creditsPurchaseHistory.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px',
              color: '#999',
              fontSize: '13px',
              background: '#0d0d14',
              borderRadius: '12px',
              border: '1px solid #2a2a40',
            }}
          >
            暂无充值记录
          </div>
        ) : (
          <CreditsPurchaseList records={creditsPurchaseHistory} />
        )}
      </div>
    </div>
  );
}


// ─── Credits 充值记录子组件（含分页和 Credits 数量显示） ───

const CREDITS_PACKS_MAP: Record<number, number> = {
  9900: 50,
  17900: 100,
  32900: 200,
  7900: 50,   // 商业版折扣价
  14300: 100, // 商业版折扣价
  26300: 200, // 商业版折扣价
};

function getCreditsFromAmount(amount: number): number | null {
  return CREDITS_PACKS_MAP[amount] || null;
}

function CreditsPurchaseList({ records }: { records: PaymentRecord[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // 按时间倒序排列
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = new Date((a as any).created_at || a.createdAt || 0).getTime();
    const dateB = new Date((b as any).created_at || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const totalPages = Math.ceil(sortedRecords.length / pageSize);
  const paginatedRecords = sortedRecords.slice((page - 1) * pageSize, page * pageSize);

  const fmtDate = (date: Date | string | null): string => {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const fmtAmount = (amount: number): string => {
    return `¥${(amount / 100).toFixed(2)}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {paginatedRecords.map((record) => {
          const creditsAmount = getCreditsFromAmount(record.amount);
          return (
            <div
              key={record.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                background: '#0d0d14',
                border: '1px solid #2a2a40',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#e8e8f0' }}>
                  Credits 充值包
                  {creditsAmount && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#7536d5', fontWeight: 600 }}>
                      +{creditsAmount} Credits
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                  {fmtDate(record.createdAt || (record as any).created_at || (record as any).completed_at)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#7536d5' }}>
                  {fmtAmount(record.amount)}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: record.status === 'completed' ? '#38A169' : record.status === 'failed' ? '#E53E3E' : '#DD6B20',
                    marginTop: '2px',
                  }}
                >
                  {record.status === 'completed' && '已完成'}
                  {record.status === 'pending' && '处理中'}
                  {record.status === 'failed' && '失败'}
                  {record.status === 'refunded' && '已退款'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid #2a2a40',
              background: '#1a1a2e', fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.4 : 1, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            上一页
          </button>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid #2a2a40',
              background: '#1a1a2e', fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.4 : 1, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
