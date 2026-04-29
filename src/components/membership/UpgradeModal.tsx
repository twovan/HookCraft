'use client';

import { useEffect, useRef } from 'react';
import type { MembershipTier } from '@/types/membership';
import { TIER_CONFIGS } from '@/config/tierConfig';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: MembershipTier;
  requiredFeature: string;
  recommendedTier?: MembershipTier;
  onNavigateToPricing: () => void;
}

/**
 * 升级引导弹窗
 * - 显示所需功能和推荐等级
 * - 提供跳转到定价页面的链接
 */
export default function UpgradeModal({
  isOpen,
  onClose,
  currentTier,
  requiredFeature,
  recommendedTier = 'pro',
  onNavigateToPricing,
}: UpgradeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const recommendedConfig = TIER_CONFIGS[recommendedTier];
  const currentConfig = TIER_CONFIGS[currentTier];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      role="presentation"
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        tabIndex={-1}
        style={{
          position: 'relative',
          background: 'white',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          animation: 'modalFadeIn 0.2s ease',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            background: '#f5f5f5',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#6B6B6B',
            transition: 'background 0.2s',
          }}
        >
          ✕
        </button>

        {/* Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F5E6D3 0%, #FDFBF7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            marginBottom: '20px',
          }}
        >
          ✨
        </div>

        {/* Title */}
        <h2
          id="upgrade-modal-title"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '22px',
            fontWeight: 700,
            color: '#2D2D2D',
            margin: '0 0 8px 0',
          }}
        >
          升级解锁更多功能
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: '14px',
            color: '#6B6B6B',
            lineHeight: 1.6,
            margin: '0 0 20px 0',
          }}
        >
          您当前为{currentConfig.name}，「{requiredFeature}」需要{recommendedConfig.name}或更高等级才能使用。
        </p>

        {/* Recommended tier card */}
        <div
          style={{
            background: '#FDFBF7',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #f0ebe4',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#2D2D2D',
              }}
            >
              推荐：{recommendedConfig.name}
            </span>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#D4A574',
                fontFamily: "'Playfair Display', serif",
              }}
            >
              ¥{(recommendedConfig.monthlyPrice / 100).toFixed(0)}/月
            </span>
          </div>
          <div style={{ fontSize: '13px', color: '#6B6B6B', lineHeight: 1.6 }}>
            {recommendedConfig.monthlyCredits} Credits/月 · 完整 Demo 生成 · 高级声模
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: '20px',
              border: '1px solid #E5E5E5',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 500,
              color: '#6B6B6B',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            稍后再说
          </button>
          <button
            onClick={onNavigateToPricing}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: '20px',
              border: 'none',
              background: 'linear-gradient(135deg, #D4A574 0%, #C9A86A 100%)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'white',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              boxShadow: '0 4px 12px rgba(212, 165, 116, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            查看方案
          </button>
        </div>
      </div>
    </div>
  );
}
