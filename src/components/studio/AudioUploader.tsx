'use client';

import { useCallback, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { validateAudioFile } from '@/lib/audio/validateAudioFile';
import { fileToBase64 } from '@/lib/audio/fileToBase64';

export interface AudioUploaderProps {
  onFileSelected: (file: File, base64: string, duration: number) => void;
  onError: (error: string) => void;
  onRemove: () => void;
  audioFile: File | null;
  status: 'idle' | 'validating' | 'ready' | 'error';
  error: string | null;
  maxSizeMB?: number;
  maxDurationSeconds?: number;
  requirementText?: string;
  compact?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioUploader({
  onFileSelected,
  onError,
  onRemove,
  audioFile,
  status,
  error,
  maxSizeMB,
  maxDurationSeconds,
  compact = false,
  requirementText = '支持 MP3/WAV，最大 50MB，时长 6 秒到 6 分钟。',
}: AudioUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const result = await validateAudioFile(file, {
        maxSizeMB,
        maxDurationSeconds,
      });

      if (!result.valid) {
        onError(result.error!);
        return;
      }

      try {
        const base64 = await fileToBase64(file);
        onFileSelected(file, base64, result.duration!);
      } catch {
        onError('文件编码失败，请重新选择音频。');
      }
    },
    [maxDurationSeconds, maxSizeMB, onFileSelected, onError]
  );

  const extractFile = useCallback((files: FileList | null): File | null => {
    if (!files || files.length === 0) return null;
    return files[0];
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const file = extractFile(event.dataTransfer.files);
      if (file) {
        handleFile(file);
      }
    },
    [extractFile, handleFile]
  );

  const handleClick = useCallback(() => {
    if (status === 'validating') return;
    fileInputRef.current?.click();
  }, [status]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = extractFile(event.target.files);
      if (file) {
        handleFile(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [extractFile, handleFile]
  );

  const handleRemove = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRemove();
    },
    [onRemove]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="选择或拖拽上传音频"
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      style={dropzoneStyle(status, isDragOver, compact)}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {status === 'idle' && (
        <div style={centerStackStyle}>
          <IconBadge tone="lime">
            <UploadIcon />
          </IconBadge>
          <div style={copyStackStyle}>
            <p style={titleStyle}>拖入参考音频，或点击选择文件</p>
            <p style={hintStyle}>{requirementText}</p>
          </div>
          <span style={actionPillStyle}>选择音频</span>
        </div>
      )}

      {status === 'validating' && (
        <div style={centerStackStyle}>
          <span style={spinnerStyle} />
          <div style={copyStackStyle}>
            <p style={titleStyle}>正在读取音频</p>
            <p style={hintStyle}>校验格式、大小和时长后会自动进入下一步。</p>
          </div>
        </div>
      )}

      {status === 'ready' && audioFile && (
        <div style={readyShellStyle}>
          <IconBadge tone="cyan">
            <MusicIcon />
          </IconBadge>
          <div style={fileInfoStyle}>
            <p style={fileNameStyle}>{audioFile.name}</p>
            <p style={hintStyle}>{formatFileSize(audioFile.size)} · 拖入新文件可替换当前音频</p>
          </div>
          <button type="button" onClick={handleRemove} aria-label="移除音频文件" style={removeButtonStyle}>
            <CloseIcon />
          </button>
        </div>
      )}

      {status === 'error' && (
        <div style={centerStackStyle}>
          <IconBadge tone="error">
            <CloseIcon />
          </IconBadge>
          <div style={copyStackStyle}>
            <p style={errorTitleStyle}>{error || '音频无法使用'}</p>
            <p style={hintStyle}>请重新选择 MP3 或 WAV 文件。</p>
          </div>
          <span style={retryPillStyle}>重新选择</span>
        </div>
      )}
    </div>
  );
}

function IconBadge({ tone, children }: { tone: 'lime' | 'cyan' | 'error'; children: React.ReactNode }) {
  const color =
    tone === 'lime' ? 'var(--hc-lime)' : tone === 'cyan' ? 'var(--hc-cyan)' : '#ff7a66';

  return (
    <span
      style={{
        ...iconBadgeStyle,
        color,
        borderColor: tone === 'error' ? 'rgba(255,122,102,0.28)' : 'rgba(255,255,255,0.11)',
        background:
          tone === 'error' ? 'rgba(255,122,102,0.1)' : 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))',
      }}
    >
      {children}
    </span>
  );
}

function UploadIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="2.8" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.5" cy="16" r="2.8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function dropzoneStyle(status: AudioUploaderProps['status'], isDragOver: boolean, compact: boolean): CSSProperties {
  const isError = status === 'error';
  const isReady = status === 'ready';
  const borderColor = isDragOver
    ? 'var(--hc-lime)'
    : isError
      ? 'rgba(255,122,102,0.7)'
      : isReady
        ? 'rgba(115,247,215,0.38)'
        : 'var(--hc-line)';

  return {
    position: 'relative',
    minHeight: compact ? 148 : 218,
    borderRadius: compact ? 14 : 18,
    overflow: 'hidden',
    border: `1px ${isReady ? 'solid' : 'dashed'} ${borderColor}`,
    background: isDragOver
      ? 'rgba(208,255,90,0.1)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))',
    cursor: status === 'validating' ? 'wait' : 'pointer',
    transition: 'border-color 0.2s ease, background 0.2s ease, transform 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: compact ? 18 : 24,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  };
}

const centerStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 14,
  textAlign: 'center',
  width: '100%',
};

const copyStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxWidth: 420,
};

const iconBadgeStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 64,
  height: 64,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.1)',
};

const titleStyle: CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 15,
  fontWeight: 850,
  lineHeight: 1.4,
  margin: 0,
};

const errorTitleStyle: CSSProperties = {
  ...titleStyle,
  color: '#ff9a88',
};

const hintStyle: CSSProperties = {
  color: 'var(--hc-muted)',
  fontSize: 12,
  lineHeight: 1.55,
  margin: 0,
};

const actionPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 14px',
  borderRadius: 999,
  background: 'var(--hc-lime)',
  color: '#0e1212',
  fontSize: 12,
  fontWeight: 900,
};

const retryPillStyle: CSSProperties = {
  ...actionPillStyle,
  background: 'rgba(255,122,102,0.14)',
  color: '#ff9a88',
};

const readyShellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px minmax(0, 1fr) 36px',
  alignItems: 'center',
  gap: 14,
  width: '100%',
};

const fileInfoStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
};

const fileNameStyle: CSSProperties = {
  color: 'var(--hc-text)',
  fontSize: 15,
  fontWeight: 850,
  lineHeight: 1.35,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  margin: 0,
};

const removeButtonStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 36,
  height: 36,
  borderRadius: 999,
  border: '1px solid rgba(255,122,102,0.24)',
  background: 'rgba(255,122,102,0.1)',
  color: '#ff9a88',
  cursor: 'pointer',
};

const spinnerStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  border: '3px solid rgba(208,255,90,0.18)',
  borderTopColor: 'var(--hc-lime)',
  animation: 'spin 0.8s linear infinite',
};
