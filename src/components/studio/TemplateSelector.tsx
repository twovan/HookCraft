'use client';

import { useState, useEffect } from 'react';
import { useMembershipStore } from '@/store/membershipStore';
import type { Template, TemplateCategory } from '@/types/template';

const PUBLIC_PRODUCER_NAME = 'HOOKCRAFT';
const PUBLIC_PRODUCER_AVATAR = '/icon.svg';

export interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplateId?: string;
  onSelect: (template: Template) => void;
  loading?: boolean;
  columns?: 2 | 3;
}

export default function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  loading = false,
  columns = 3,
}: TemplateSelectorProps) {
  const [activeTab, setActiveTab] = useState<TemplateCategory | 'purchased'>('free_template');
  const isPaid = useMembershipStore((s) => s.isPaid());
  const [purchasedTemplates, setPurchasedTemplates] = useState<Template[]>([]);
  const [purchasedLoading, setPurchasedLoading] = useState(false);

  const freeTemplates = templates.filter((t) => t.category === 'free_template');
  const paidTemplates = templates.filter((t) => t.category === 'paid_template');

  useEffect(() => {
    if (activeTab !== 'purchased') return;
    setPurchasedLoading(true);
    fetch('/api/templates/purchased')
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => {
        const mapped: Template[] = (data.templates || []).map((t: {
          id: string;
          name: string;
          genre: string;
          cover_url: string | null;
          category: string;
          producer_id?: string | null;
          producer_name?: string;
          producer_avatar_url?: string;
        }) => ({
          id: t.id,
          name: t.name,
          genre: t.genre,
          coverUrl: t.cover_url,
          category: t.category as TemplateCategory,
          description: '',
          producerId: t.producer_id || undefined,
          producerName: t.producer_name,
          producerAvatarUrl: t.producer_avatar_url,
        }));
        setPurchasedTemplates(mapped);
      })
      .catch(() => setPurchasedTemplates([]))
      .finally(() => setPurchasedLoading(false));
  }, [activeTab]);

  const displayTemplates = activeTab === 'free_template'
    ? freeTemplates
    : activeTab === 'paid_template'
      ? paidTemplates
      : purchasedTemplates;
  const isLoading = loading || (purchasedLoading && activeTab === 'purchased');
  const isLocked = !isPaid && activeTab === 'paid_template';
  const isPurchasedTab = activeTab === 'purchased';

  const tabs: { key: TemplateCategory | 'purchased'; label: string }[] = [
    { key: 'free_template', label: '免费' },
    { key: 'purchased', label: '已购' },
  ];

  return (
    <div>
      <div style={tabsStyle} role="tablist" aria-label="模板类型">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...tabStyle,
                borderColor: active ? 'rgba(206,255,53,.42)' : 'transparent',
                background: active ? 'rgba(206,255,53,.12)' : 'transparent',
                color: active ? 'var(--hc-lime)' : 'var(--hc-muted)',
              }}
              aria-selected={active}
              role="tab"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 12,
        }}
        role="listbox"
        aria-label="模板列表"
      >
        {isLoading && Array.from({ length: 6 }).map((_, index) => (
          <div key={`template-skeleton-${index}`} style={skeletonStyle}>
            <span style={skeletonShineStyle} />
          </div>
        ))}

        {!isLoading && displayTemplates.map((template) => {
          const isSelected = template.id === selectedTemplateId;
          return (
            <button
              key={template.id}
              onClick={() => {
                if (!isLocked || isPurchasedTab) onSelect(template);
              }}
              disabled={isLocked && !isPurchasedTab}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isLocked}
              style={{
                ...cardStyle,
                borderColor: isSelected ? 'rgba(206,255,53,.66)' : 'var(--hc-line)',
                background: template.coverUrl
                  ? `url(${template.coverUrl}) center/cover`
                  : 'linear-gradient(135deg, rgba(206,255,53,.16), rgba(82,214,198,.08) 48%, rgba(255,90,61,.10))',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.58 : 1,
                boxShadow: isSelected ? '0 14px 34px rgba(206,255,53,.12)' : 'none',
              }}
            >
              {isLocked && (
                <div style={lockedOverlayStyle}>
                  <span style={lockMarkStyle}>锁定</span>
                  <span>升级解锁</span>
                </div>
              )}

              <div style={cardInfoStyle}>
                <div style={templateNameStyle}>{template.name}</div>
                <div style={templateGenreStyle}>{template.genre}</div>
                <div style={producerStyle}>
                  <img
                    src={template.producerAvatarUrl || PUBLIC_PRODUCER_AVATAR}
                    alt=""
                    style={avatarStyle}
                  />
                  <span>{template.producerName || PUBLIC_PRODUCER_NAME}</span>
                </div>
              </div>

              {isSelected && <div style={selectedMarkStyle}>已选</div>}
            </button>
          );
        })}
      </div>

      {displayTemplates.length === 0 && !isLoading && (
        <div style={emptyStyle}>
          {activeTab === 'purchased' ? '暂无已购模板，去模板市场看看。' : '暂无模板'}
        </div>
      )}

      <style>{`
        @keyframes templateSkeleton {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

const tabsStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 4,
  marginBottom: 16,
  padding: 4,
  border: '1px solid var(--hc-line)',
  borderRadius: 999,
  background: 'rgba(255,255,255,.03)',
};

const tabStyle: React.CSSProperties = {
  border: '1px solid transparent',
  borderRadius: 999,
  background: 'transparent',
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
};

const skeletonStyle: React.CSSProperties = {
  aspectRatio: '1 / 1.45',
  borderRadius: 12,
  border: '1px solid var(--hc-line)',
  background: 'rgba(24,26,34,.86)',
  position: 'relative',
  overflow: 'hidden',
};

const skeletonShineStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent)',
  animation: 'templateSkeleton 1.4s ease-in-out infinite',
};

const cardStyle: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '1 / 1.45',
  borderRadius: 12,
  border: '1px solid var(--hc-line)',
  overflow: 'hidden',
  padding: 0,
  transition: 'border-color .2s ease, box-shadow .2s ease, opacity .2s ease',
};

const lockedOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 3,
  display: 'grid',
  placeItems: 'center',
  gap: 5,
  alignContent: 'center',
  background: 'rgba(8,9,12,.72)',
  backdropFilter: 'blur(2px)',
  color: 'var(--hc-muted)',
  fontSize: 12,
  fontWeight: 900,
};

const lockMarkStyle: React.CSSProperties = {
  color: 'var(--hc-lime)',
  letterSpacing: '.1em',
  fontSize: 10,
};

const cardInfoStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '42px 10px 10px',
  background: 'linear-gradient(transparent, rgba(0,0,0,.84))',
  textAlign: 'left',
};

const templateNameStyle: React.CSSProperties = {
  color: 'white',
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.35,
};

const templateGenreStyle: React.CSSProperties = {
  marginTop: 3,
  color: 'rgba(255,255,255,.78)',
  fontSize: 10,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const producerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  marginTop: 8,
  color: 'rgba(255,255,255,.9)',
  fontSize: 10,
  fontWeight: 800,
};

const avatarStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  objectFit: 'cover',
  background: 'rgba(255,255,255,.12)',
  flexShrink: 0,
};

const selectedMarkStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  border: '1px solid rgba(206,255,53,.42)',
  borderRadius: 999,
  padding: '4px 7px',
  background: 'rgba(8,9,12,.62)',
  color: 'var(--hc-lime)',
  fontSize: 10,
  fontWeight: 950,
};

const emptyStyle: React.CSSProperties = {
  marginTop: 12,
  border: '1px solid var(--hc-line)',
  borderRadius: 12,
  padding: '28px 16px',
  color: 'var(--hc-muted)',
  background: 'rgba(255,255,255,.03)',
  textAlign: 'center',
  fontSize: 13,
};
