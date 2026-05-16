'use client';

import { useState, useEffect } from 'react';
import { useMembershipStore } from '@/store/membershipStore';
import type { Template, TemplateCategory } from '@/types/template';

export interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplateId?: string;
  onSelect: (template: Template) => void;
}

/**
 * 模板选择器组件
 * - 免费/付费 Tab 切换
 * - Mini 卡片（3 列，2:3 比例）
 * - Free 用户：仅显示 Free_Template，Paid_Template 显示锁定状态
 * - 点击模板选中
 */
export default function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
}: TemplateSelectorProps) {
  const [activeTab, setActiveTab] = useState<TemplateCategory | 'purchased'>('free_template');
  const isPaid = useMembershipStore((s) => s.isPaid());
  const [purchasedTemplates, setPurchasedTemplates] = useState<Template[]>([]);
  const [purchasedLoading, setPurchasedLoading] = useState(false);

  const freeTemplates = templates.filter((t) => t.category === 'free_template');
  const paidTemplates = templates.filter((t) => t.category === 'paid_template');

  // Fetch purchased templates when tab is active
  useEffect(() => {
    if (activeTab !== 'purchased') return;
    setPurchasedLoading(true);
    fetch('/api/templates/purchased')
      .then((res) => {
        if (res.ok) return res.json();
        return { templates: [] };
      })
      .then((data) => {
        const mapped: Template[] = (data.templates || []).map((t: { id: string; name: string; genre: string; cover_url: string | null; category: string }) => ({
          id: t.id,
          name: t.name,
          genre: t.genre,
          coverUrl: t.cover_url,
          category: t.category as TemplateCategory,
          description: '',
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

  const isLocked = !isPaid && activeTab === 'paid_template';
  const isPurchasedTab = activeTab === 'purchased';

  const tabs: { key: TemplateCategory | 'purchased'; label: string; icon?: string }[] = [
    { key: 'free_template', label: '免费' },
    { key: 'paid_template', label: '付费', icon: !isPaid ? '🔒' : undefined },
    { key: 'purchased', label: '已购' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          marginBottom: '20px',
          borderBottom: '1px solid #2a2a40',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#7536d5' : '#9ca3af',
              borderBottom: activeTab === tab.key ? '2px solid #7536d5' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              transition: 'all 0.2s ease',
            }}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            {tab.label}
            {tab.icon && (
              <span style={{ marginLeft: '4px', fontSize: '12px' }}>{tab.icon}</span>
            )}
          </button>
        ))}
      </div>

      {/* Template Grid - 3 per row, 2:3 aspect ratio */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}
        role="listbox"
        aria-label="模板列表"
      >
        {displayTemplates.map((template) => {
          const isSelected = template.id === selectedTemplateId;

          return (
            <button
              key={template.id}
              onClick={() => {
                if (!isLocked || isPurchasedTab) {
                  onSelect(template);
                }
              }}
              disabled={isLocked && !isPurchasedTab}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isLocked}
              style={{
                position: 'relative',
                aspectRatio: '2 / 3',
                borderRadius: '12px',
                border: isSelected
                  ? '2px solid #7536d5'
                  : '1px solid #2a2a40',
                background: template.coverUrl
                  ? `url(${template.coverUrl}) center/cover`
                  : 'linear-gradient(135deg, rgba(117, 54, 213, 0.15) 0%, #0d0d14 100%)',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                overflow: 'hidden',
                padding: 0,
                transition: 'all 0.2s ease',
                opacity: isLocked ? 0.6 : 1,
                boxShadow: isSelected
                  ? '0 4px 12px rgba(117, 54, 213, 0.3)'
                  : '0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Locked overlay */}
              {isLocked && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '4px',
                    backdropFilter: 'blur(2px)',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>🔒</span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      fontWeight: 500,
                    }}
                  >
                    升级解锁
                  </span>
                </div>
              )}

              {/* Template info at bottom */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                  padding: '24px 10px 10px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'white',
                    lineHeight: 1.3,
                    textAlign: 'left',
                  }}
                >
                  {template.name}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.8)',
                    textAlign: 'left',
                    marginTop: '2px',
                  }}
                >
                  {template.genre}
                </div>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#7536d5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    color: 'white',
                  }}
                >
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {displayTemplates.length === 0 && !purchasedLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: '#999',
            fontSize: '13px',
          }}
        >
          {activeTab === 'purchased' ? '暂无已购模板，去模板中心看看吧' : '暂无模板'}
        </div>
      )}
      {purchasedLoading && activeTab === 'purchased' && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: '#999',
            fontSize: '13px',
          }}
        >
          加载中...
        </div>
      )}
    </div>
  );
}
