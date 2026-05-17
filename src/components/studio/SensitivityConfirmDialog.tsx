'use client';

import { useEffect, useState } from 'react';

export interface SensitivityConfirmDialogProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 风格标签列表，动态插入提示信息中 */
  styleTags: string[];
  /** 用户点击【是】时的回调（使用改写 Prompt 调用生成 API） */
  onConfirm: () => void;
  /** 用户点击【否】时的回调（关闭弹窗返回编辑） */
  onCancel: () => void;
}

/**
 * 敏感词确认弹窗组件（rewrite 类型）
 *
 * 当 Sensitivity_Filter 检测到创作描述中包含明星名字或歌曲名称时，
 * 展示确认弹窗，告知用户系统将使用改写后的风格标签生成歌曲，
 * 用户可选择继续生成或返回编辑。
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export default function SensitivityConfirmDialog({
  open,
  styleTags,
  onConfirm,
  onCancel,
}: SensitivityConfirmDialogProps) {
  const [visible, setVisible] = useState(false);

  // 控制淡入动画：open 变为 true 时延迟一帧触发 CSS transition
  useEffect(() => {
    if (open) {
      // 使用 requestAnimationFrame 确保 DOM 先渲染再触发动画
      const raf = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const styleTagsText = styleTags.join('/');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sensitivity-confirm-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* 遮罩层 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onCancel}
      />

      {/* 弹窗内容 */}
      <div
        style={{
          position: 'relative',
          background: '#1a1a2e',
          borderRadius: 20,
          padding: '32px 28px',
          border: '1px solid #2a2a40',
          boxShadow: '0 8px 32px rgba(117, 54, 213, 0.15)',
          maxWidth: 440,
          width: '90%',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        }}
      >
        {/* 图标 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(117, 54, 213, 0.2), rgba(90, 45, 184, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            🎵
          </div>
        </div>

        {/* 提示信息 */}
        <p
          id="sensitivity-confirm-title"
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: '#e8e8f0',
            textAlign: 'center',
            margin: '0 0 28px 0',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}
        >
          非常抱歉，因版权保护，我们暂时无法直接模仿和引用TA的作品，但我们能为你生成
          <span
            style={{
              color: '#7536d5',
              fontWeight: 600,
            }}
          >
            【{styleTagsText}】
          </span>
          的歌曲，是否继续生成歌曲？
        </p>

        {/* 按钮区域 */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
          }}
        >
          {/* 否 - 次要按钮 */}
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 24px',
              borderRadius: 12,
              border: '1px solid #2a2a40',
              background: 'transparent',
              color: '#9ca3af',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#7536d5';
              e.currentTarget.style.color = '#e8e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a40';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            否
          </button>

          {/* 是 - 主要按钮 */}
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #7536d5, #5a2db8)',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(117, 54, 213, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(117, 54, 213, 0.5)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(117, 54, 213, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            是
          </button>
        </div>
      </div>
    </div>
  );
}
