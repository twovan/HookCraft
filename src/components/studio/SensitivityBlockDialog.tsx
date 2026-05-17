'use client';

import { useEffect, useState } from 'react';

export interface SensitivityBlockDialogProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 检测到的违禁词/敏感词列表 */
  blockedWords: string[];
  /** 触发拦截的来源：description（创作描述）或 lyrics（歌词） */
  source: 'description' | 'lyrics';
  /** 用户确认关闭弹窗时的回调 */
  onClose: () => void;
}

/**
 * 敏感词拦截弹窗组件（block 类型）
 *
 * 当 Sensitivity_Filter 检测到创作描述中包含违禁词或歌词中包含敏感词时，
 * 展示拦截弹窗，高亮标注检测到的违禁词/敏感词，
 * 用户确认后关闭弹窗，光标定位到对应输入区域。
 *
 * 支持两种场景：
 * - description: 创作描述中包含违禁词
 * - lyrics: 歌词中包含敏感词
 *
 * Validates: Requirements 3.1(需求3.1), 3.1.2, 3.1.3, 3.1.4, 3.1.5, 4.2, 4.3, 4.4
 */
export default function SensitivityBlockDialog({
  open,
  blockedWords,
  source,
  onClose,
}: SensitivityBlockDialogProps) {
  const [visible, setVisible] = useState(false);

  // 控制淡入动画：open 变为 true 时延迟一帧触发 CSS transition
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  // 根据来源显示不同的提示信息
  const message =
    source === 'description'
      ? '您的创作描述中包含不合规内容，请修改后重试'
      : '您的歌词中包含不合规内容，请修改后重试';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sensitivity-block-title"
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
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div
        style={{
          position: 'relative',
          background: '#1a1a2e',
          borderRadius: 20,
          padding: '32px 28px',
          border: '1px solid #2a2a40',
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)',
          maxWidth: 440,
          width: '90%',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        }}
      >
        {/* 警告图标 */}
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
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            ⚠️
          </div>
        </div>

        {/* 提示信息 */}
        <p
          id="sensitivity-block-title"
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: '#e8e8f0',
            textAlign: 'center',
            margin: '0 0 20px 0',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}
        >
          {message}
        </p>

        {/* 违禁词高亮展示区域 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 28,
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.06)',
            borderRadius: 12,
            border: '1px solid rgba(239, 68, 68, 0.15)',
          }}
        >
          {blockedWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* 返回修改按钮 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
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
            返回修改
          </button>
        </div>
      </div>
    </div>
  );
}
