'use client';

import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<TemplateCategory>('free_template');
  const isPaid = useMembershipStore((s) => s.isPaid());

  const freeTemplates = templates.filter((t) => t.category === 'free_template');
  const paidTemplates = templates.filter((t) => t.category === 'paid_template');
  const displayTemplates = activeTab === 'free_template' ? freeTemplates : paidTemplates;

  const isLocked = !isPaid && activeTab === 'paid_template';

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          marginBottom: '20px',
          borderBottom: '1px solid #f0ebe4',
        }}
      >
        <button
          onClick={() => setActiveTab('free_template')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            fontSize: '14px',
            fontWeight: activeTab === 'free_template' ? 600 : 400,
            color: activeTab === 'free_template' ? '#D4A574' : '#6B6B6B',
            borderBottom: activeTab === 'free_template' ? '2px solid #D4A574' : '2px solid transparent',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            transition: 'all 0.2s ease',
          }}
          aria-selected={activeTab === 'free_template'}
          role="tab"
        >
          免费
        </button>
        <button
          onClick={() => setActiveTab('paid_template')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            fontSize: '14px',
            fontWeight: activeTab === 'paid_template' ? 600 : 400,
            color: activeTab === 'paid_template' ? '#D4A574' : '#6B6B6B',
            borderBottom: activeTab === 'paid_template' ? '2px solid #D4A574' : '2px solid transparent',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            transition: 'all 0.2s ease',
          }}
          aria-selected={activeTab === 'paid_template'}
          role="tab"
        >
          付费
          {!isPaid && (
            <span style={{ marginLeft: '4px', fontSize: '12px' }}>🔒</span>
          )}
        </button>
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
                if (!isLocked) {
                  onSelect(template);
                }
              }}
              disabled={isLocked}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isLocked}
              style={{
                position: 'relative',
                aspectRatio: '2 / 3',
                borderRadius: '12px',
                border: isSelected
                  ? '2px solid #D4A574'
                  : '1px solid #f0ebe4',
                background: template.coverUrl
                  ? `url(${template.coverUrl}) center/cover`
                  : 'linear-gradient(135deg, #F5E6D3 0%, #FDFBF7 100%)',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                overflow: 'hidden',
                padding: 0,
                transition: 'all 0.2s ease',
                opacity: isLocked ? 0.6 : 1,
                boxShadow: isSelected
                  ? '0 4px 12px rgba(212, 165, 116, 0.3)'
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
                      color: '#6B6B6B',
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
                    background: '#D4A574',
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
      {displayTemplates.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: '#999',
            fontSize: '13px',
          }}
        >
          暂无模板
        </div>
      )}
    </div>
  );
}
