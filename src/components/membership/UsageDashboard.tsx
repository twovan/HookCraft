'use client';

import { useCreditStore } from '@/store/creditStore';
import { useMembershipStore } from '@/store/membershipStore';

export interface UsageDashboardProps {
  onUpgrade?: () => void;
  onBuyCredits?: () => void;
}

export default function UsageDashboard({ onUpgrade, onBuyCredits }: UsageDashboardProps) {
  const credits = useCreditStore((s) => s.credits);
  const previewCount = useCreditStore((s) => s.previewCount);
  const isLow = useCreditStore((s) => s.isLow());
  const isExhausted = useCreditStore((s) => s.isExhausted());
  const isMonthlyExhausted = useCreditStore((s) => s.isMonthlyExhausted());
  const resetCountdown = useCreditStore((s) => s.resetCountdown());
  const isPaid = useMembershipStore((s) => s.isPaid());

  const isFreeExhausted = !isPaid && previewCount !== null && previewCount.remaining === 0;
  const monthlyPercent = credits?.monthlyTotal ? Math.min(100, (credits.monthlyUsed / credits.monthlyTotal) * 100) : 0;

  return (
    <section className={isExhausted || isFreeExhausted ? 'usage-card danger' : isLow ? 'usage-card warn' : 'usage-card'} aria-label="用量面板">
      <div className="usage-head">
        <h3>{isPaid ? '额度用量' : '预览次数'}</h3>
        {resetCountdown && <span>{resetCountdown}</span>}
      </div>

      {isPaid && credits && (
        <>
          <div className="progress-label">
            <span>月度额度</span>
            <b>{credits.monthlyUsed} / {credits.monthlyTotal}</b>
          </div>
          <div className="track"><div style={{ width: `${monthlyPercent}%` }} /></div>

          <div className="usage-row">
            <span>购买额度</span>
            <b>{credits.purchasedBalance}</b>
          </div>

          <div className="big-metric">
            <strong>{credits.totalAvailable}</strong>
            <span>可用额度</span>
          </div>

          <p>本月已消耗 {credits.monthlyUsed} 点额度</p>

          {isMonthlyExhausted && !isExhausted && <div className="notice">月度额度已用尽，当前使用购买额度。</div>}
          {isExhausted && <div className="notice danger">额度不足，请购买额度充值包或升级会员。</div>}
          {isLow && !isExhausted && !isMonthlyExhausted && <div className="notice warn">额度即将用尽，建议购买额度充值包。</div>}

          {(isLow || isExhausted) && onBuyCredits && (
            <button onClick={onBuyCredits}>购买额度充值包</button>
          )}
        </>
      )}

      {!isPaid && previewCount && (
        <>
          <div className="preview-dots">
            {Array.from({ length: previewCount.total }).map((_, i) => (
              <span key={i} className={i < previewCount.used ? 'used' : ''}>{i + 1}</span>
            ))}
          </div>
          <div className="free-count">剩余 {previewCount.remaining}/{previewCount.total} 次预览</div>
          {isFreeExhausted && (
            <>
              <div className="notice danger">本月预览次数已用尽，升级到专业版可获得更多创作额度。</div>
              {onUpgrade && <button onClick={onUpgrade}>升级到专业版</button>}
            </>
          )}
        </>
      )}

      {!credits && isPaid && <p>加载中...</p>}
      {!previewCount && !isPaid && <p>加载中...</p>}

      <style>{`
        .usage-card {
          border: 1px solid var(--hc-line);
          border-radius: var(--hc-radius);
          background: rgba(24,26,34,.88);
          box-shadow: var(--hc-shadow);
          padding: 18px;
        }

        .usage-card.warn {
          border-color: rgba(245,197,66,.36);
        }

        .usage-card.danger {
          border-color: rgba(255,90,61,.36);
        }

        .usage-head,
        .progress-label,
        .usage-row,
        .big-metric {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .usage-head {
          margin-bottom: 14px;
        }

        .usage-head h3 {
          margin: 0;
          color: var(--hc-text);
          font-size: 16px;
        }

        .usage-head span,
        .progress-label,
        .usage-row,
        .usage-card p {
          color: var(--hc-muted);
          font-size: 12px;
        }

        .track {
          height: 8px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          margin: 8px 0 12px;
        }

        .track div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--hc-lime), var(--hc-cyan));
        }

        .usage-row b {
          border: 1px solid rgba(206,255,53,.28);
          border-radius: 999px;
          background: rgba(206,255,53,.09);
          color: var(--hc-lime);
          padding: 3px 8px;
        }

        .big-metric {
          justify-content: flex-start;
          align-items: baseline;
          margin-top: 10px;
        }

        .big-metric strong {
          color: var(--hc-lime);
          font-size: 32px;
          line-height: 1;
        }

        .notice {
          border: 1px solid rgba(206,255,53,.28);
          border-radius: 10px;
          background: rgba(206,255,53,.08);
          color: var(--hc-lime);
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 800;
          margin: 12px 0;
        }

        .notice.warn {
          border-color: rgba(245,197,66,.36);
          background: rgba(245,197,66,.08);
          color: #f5c542;
        }

        .notice.danger {
          border-color: rgba(255,90,61,.36);
          background: rgba(255,90,61,.1);
          color: #ff8b76;
        }

        .usage-card button {
          width: 100%;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
          color: #08090c;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 950;
          cursor: pointer;
        }

        .preview-dots {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .preview-dots span {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(206,255,53,.34);
          border-radius: 50%;
          color: var(--hc-lime);
          font-size: 12px;
          font-weight: 950;
        }

        .preview-dots span.used {
          border-color: var(--hc-line);
          background: rgba(255,255,255,.05);
          color: var(--hc-muted);
        }

        .free-count {
          color: var(--hc-text);
          font-weight: 900;
          margin-bottom: 12px;
        }
      `}</style>
    </section>
  );
}
