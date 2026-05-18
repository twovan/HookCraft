'use client';

import { useRef, useState, useCallback } from 'react';
import { validateAudioFile } from '@/lib/audio/validateAudioFile';
import { fileToBase64 } from '@/lib/audio/fileToBase64';

/**
 * AudioUploader 组件 Props
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12
 */
export interface AudioUploaderProps {
  onFileSelected: (file: File, base64: string, duration: number) => void;
  onError: (error: string) => void;
  onRemove: () => void;
  audioFile: File | null;
  status: 'idle' | 'validating' | 'ready' | 'error';
  error: string | null;
}

/** 允许的 MIME 类型 */
const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav'];

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * AudioUploader - 音频文件拖拽上传组件
 *
 * 功能：
 * - 拖拽上传区域（drag & drop）和点击选择文件
 * - 集成 validateAudioFile 进行客户端校验（格式 → 大小 → 时长）
 * - 显示校验状态（validating → ready / error）
 * - 显示具体错误信息（格式、大小、时长）
 * - 文件移除功能，释放 AudioBuffer 引用
 * - 支持替换文件（ready 状态下拖入新文件）
 */
export default function AudioUploader({
  onFileSelected,
  onError,
  onRemove,
  audioFile,
  status,
  error,
}: AudioUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理文件选择后的校验和 Base64 编码流程
   */
  const handleFile = useCallback(
    async (file: File) => {
      // 校验音频文件（格式 → 大小 → 时长）
      const result = await validateAudioFile(file);

      if (!result.valid) {
        onError(result.error!);
        return;
      }

      // 校验通过，编码为 Base64
      try {
        const base64 = await fileToBase64(file);
        onFileSelected(file, base64, result.duration!);
      } catch {
        onError('文件编码失败，请重试');
      }
    },
    [onFileSelected, onError]
  );

  /**
   * 从 DataTransfer 或 FileList 中提取第一个音频文件
   */
  const extractFile = useCallback((files: FileList | null): File | null => {
    if (!files || files.length === 0) return null;
    return files[0];
  }, []);

  // --- Drag & Drop handlers ---

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = extractFile(e.dataTransfer.files);
      if (file) {
        handleFile(file);
      }
    },
    [extractFile, handleFile]
  );

  // --- Click to select ---

  const handleClick = useCallback(() => {
    if (status === 'validating') return;
    fileInputRef.current?.click();
  }, [status]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = extractFile(e.target.files);
      if (file) {
        handleFile(file);
      }
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [extractFile, handleFile]
  );

  // --- Remove handler ---

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove]
  );

  // --- Render ---

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="音频上传区域"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 200,
        borderRadius: 16,
        border: isDragOver
          ? '2px solid #7536d5'
          : status === 'error'
            ? '2px dashed #ef4444'
            : status === 'ready'
              ? '2px solid #2a2a40'
              : '2px dashed #2a2a40',
        background: isDragOver
          ? 'rgba(117, 54, 213, 0.08)'
          : status === 'ready'
            ? '#1a1a2e'
            : '#12121e',
        cursor: status === 'validating' ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Idle state: upload prompt */}
      {status === 'idle' && (
        <>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(117, 54, 213, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7536d5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p
            style={{
              fontSize: 14,
              color: '#e8e8f0',
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            拖拽音频文件到此处，或点击选择
          </p>
          <p
            style={{
              fontSize: 12,
              color: '#9ca3af',
            }}
          >
            支持 MP3/WAV 格式，最大 50MB，时长 6秒-6分钟
          </p>
        </>
      )}

      {/* Validating state: spinner */}
      {status === 'validating' && (
        <>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(117, 54, 213, 0.2)',
              borderTopColor: '#7536d5',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginBottom: 16,
            }}
          />
          <p
            style={{
              fontSize: 14,
              color: '#e8e8f0',
              fontWeight: 500,
            }}
          >
            正在校验音频文件...
          </p>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}

      {/* Ready state: file info */}
      {status === 'ready' && audioFile && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
            }}
          >
            {/* Audio file icon */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(117, 54, 213, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7536d5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>

            {/* File info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#e8e8f0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  margin: 0,
                }}
              >
                {audioFile.name}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: '#9ca3af',
                  margin: '4px 0 0 0',
                }}
              >
                {formatFileSize(audioFile.size)}
              </p>
            </div>

            {/* Remove button */}
            <button
              onClick={handleRemove}
              aria-label="移除文件"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'rgba(239, 68, 68, 0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'rgba(239, 68, 68, 0.1)';
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Replace hint */}
          <p
            style={{
              fontSize: 11,
              color: '#6b7280',
              marginTop: 12,
              textAlign: 'center',
            }}
          >
            拖入新文件可替换当前音频
          </p>
        </>
      )}

      {/* Error state */}
      {status === 'error' && (
        <>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          {error && (
            <p
              style={{
                fontSize: 14,
                color: '#ef4444',
                fontWeight: 500,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}
          <p
            style={{
              fontSize: 12,
              color: '#9ca3af',
              textAlign: 'center',
            }}
          >
            请重新选择文件
          </p>
        </>
      )}
    </div>
  );
}
