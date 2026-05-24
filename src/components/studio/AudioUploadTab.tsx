'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import AudioUploader from './AudioUploader';
import WaveformVisualizer from './WaveformVisualizer';
import ArrangementParamsEditor from './ArrangementParamsEditor';
import { buildArrangementPrompt } from '@/lib/audio/buildArrangementPrompt';
import { validateLyricsStructure } from '@/lib/audio/validateLyricsStructure';
import { terminateWorker } from '@/lib/audio/fileToBase64';
import { CREDITS_COST } from '@/config/creditsCost';
import { useCreditStore } from '@/store/creditStore';
import type {
  ArrangementParams,
  UploadStatus,
  PreprocessStatus,
  GenerationStatus,
  ArrangementGenerationResult,
} from '@/types/arrangement';

/** Default arrangement params */
const DEFAULT_PARAMS: ArrangementParams = {
  duration: 60,
  bpm: 120,
  musicalKey: 'C',
  scale: 'major',
  instruments: [],
  prompt: '',
  lyrics: '',
  isInstrumental: false,
  outputFormat: 'mp3',
};

/**
 * AudioUploadTab - Tab container component for the audio upload arrangement workflow.
 *
 * Implements:
 * - Task 8.1: Left/right split layout, state machine, preprocess + generate logic
 * - Task 8.2: Generation result player, regenerate, error display
 * - Task 8.3: Error recovery, retry mechanism, network detection
 *
 * Requirements: 3.x, 5.x, 6.x, 7.x, 9.3, 11.x, 12.x
 */
export default function AudioUploadTab() {
  // --- State ---
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [preprocessStatus, setPreprocessStatus] = useState<PreprocessStatus>('idle');
  const [coverFeatureId, setCoverFeatureId] = useState<string | null>(null);
  const [extractedLyrics, setExtractedLyrics] = useState<string | null>(null);
  const [structureResult, setStructureResult] = useState<string | null>(null);
  const [preprocessError, setPreprocessError] = useState<string | null>(null);
  const [preprocessRetryCount, setPreprocessRetryCount] = useState(0);

  const [params, setParams] = useState<ArrangementParams>(DEFAULT_PARAMS);

  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [generationResult, setGenerationResult] = useState<ArrangementGenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Sensitivity rewrite state
  const [rewrittenPrompt, setRewrittenPrompt] = useState<string | null>(null);
  const [showRewriteConfirm, setShowRewriteConfirm] = useState(false);

  // Network state
  const [isOnline, setIsOnline] = useState(true);

  // Cover mode state
  const [coverMode, setCoverMode] = useState<'one-step' | 'two-step'>('one-step');

  // Credits store - 生成成功后通过 getState() 刷新

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- Web Worker lifecycle cleanup (Task 12.1: Requirements 13.3, 13.5) ---
  useEffect(() => {
    return () => {
      terminateWorker();
    };
  }, []);

  // --- Network detection (Task 8.3) ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Check for pending tasks on mount (Task 8.3: Requirement 12.2) ---
  // --- Check for pending tasks on mount (Task 8.3: Requirement 12.2) ---
  // Note: Disabled until GET endpoint is implemented
  // useEffect(() => { ... }, []);

  // --- File selection handler ---
  const handleFileSelected = useCallback((file: File, base64: string, duration: number) => {
    setAudioFile(file);
    setAudioBase64(base64);
    setAudioDuration(duration);
    setUploadStatus('ready');
    setUploadError(null);
    // Reset downstream states
    setPreprocessStatus('idle');
    setCoverFeatureId(null);
    setExtractedLyrics(null);
    setStructureResult(null);
    setPreprocessError(null);
    setPreprocessRetryCount(0);
    setGenerationStatus('idle');
    setGenerationResult(null);
    setGenerationError(null);
  }, []);

  const handleFileError = useCallback((error: string) => {
    setUploadStatus('error');
    setUploadError(error);
  }, []);

  const handleFileRemove = useCallback(() => {
    setAudioFile(null);
    setAudioBase64(null);
    setAudioDuration(null);
    setUploadStatus('idle');
    setUploadError(null);
    setPreprocessStatus('idle');
    setCoverFeatureId(null);
    setExtractedLyrics(null);
    setStructureResult(null);
    setPreprocessError(null);
    setPreprocessRetryCount(0);
    setGenerationStatus('idle');
    setGenerationResult(null);
    setGenerationError(null);
  }, []);

  // --- Preprocess handler (Task 8.1: Requirement 3.1-3.6) ---
  const handlePreprocess = useCallback(async () => {
    if (!audioFile || preprocessStatus === 'processing') return;

    setPreprocessStatus('processing');
    setPreprocessError(null);

    try {
      // Step 1: 上传音频到 Supabase Storage 获取公开 URL
      const formData = new FormData();
      formData.append('file', audioFile);

      const uploadRes = await fetch('/api/minimax/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const uploadError = await uploadRes.json().catch(() => ({ error: '音频上传失败' }));
        throw new Error(uploadError.error || '音频上传失败');
      }

      const { audioUrl } = await uploadRes.json();

      // Step 2: 调用预处理 API（传 URL 而不是 Base64，避免 payload 过大）
      const res = await fetch('/api/minimax/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: '音频分析失败，请重试' }));
        throw new Error(errorData.error || '音频分析失败，请重试');
      }

      const data = await res.json();
      setCoverFeatureId(data.coverFeatureId);
      setExtractedLyrics(data.formattedLyrics || data.lyrics || null);
      setStructureResult(data.structureResult || null);
      setPreprocessStatus('completed');
      setPreprocessRetryCount(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '音频分析失败，请重试';
      setPreprocessError(message);
      setPreprocessStatus('error');
      setUploadStatus('ready');
    }
  }, [audioFile, preprocessStatus]);

  // --- Polling for task status with timeout protection ---
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartRef = useRef<number>(0);

  // Max polling duration: 5 minutes
  const MAX_POLLING_MS = 5 * 60 * 1000;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const pollTaskStatus = useCallback((taskId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingStartRef.current = Date.now();

    const poll = async () => {
      // 超时保护：超过 5 分钟停止轮询
      if (Date.now() - pollingStartRef.current > MAX_POLLING_MS) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setGenerationError('生成超时，请重试');
        setGenerationStatus('error');
        return;
      }

      try {
        const res = await fetch(`/api/minimax/generate/status?taskId=${taskId}`);
        if (!res.ok) {
          console.warn('[pollTaskStatus] 查询失败, 继续轮询...');
          return;
        }

        const data = await res.json();

        if (data.status === 'completed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setGenerationResult({
            success: true,
            audioUrl: data.audioUrl,
            taskId,
          });
          setGenerationStatus('completed');
          useCreditStore.getState().fetchCredits({ force: true });
        } else if (data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setGenerationError(data.error || '生成失败，请重试');
          setGenerationStatus('error');
        }
        // 'pending' or 'generating' → keep polling
      } catch (err) {
        console.warn('[pollTaskStatus] 网络错误, 继续轮询...');
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, []);

  // --- Generate handler (sync mode) ---
  const handleGenerate = useCallback(async () => {
    if (generationStatus === 'generating') return;

    // 一步模式需要 audioFile，两步模式需要 coverFeatureId
    if (coverMode === 'two-step' && !coverFeatureId) return;
    if (coverMode === 'one-step' && !audioFile) return;

    // 风格描述必填，music-cover 要求 10-300 字符
    const promptLength = params.prompt.trim().length;
    if (!params.prompt || promptLength < 10) {
      setGenerationError('风格描述必填，至少 10 个字符');
      return;
    }
    if (coverMode === 'one-step' && promptLength > 300) {
      setGenerationError('一步模式风格描述不能超过 300 个字符');
      return;
    }

    // Check network
    if (!isOnline) {
      setGenerationError('网络连接中断，请检查网络后重试');
      return;
    }

    setGenerationStatus('generating');
    setGenerationError(null);
    setRewrittenPrompt(null);
    setShowRewriteConfirm(false);

    try {
      let requestBody: Record<string, unknown>;

      if (coverMode === 'one-step') {
        // 一步模式：上传音频获取 URL，直接传 audio_url 给 generation API
        // audio_url 和 cover_feature_id 互斥
        const formData = new FormData();
        formData.append('file', audioFile!);
        const uploadRes = await fetch('/api/minimax/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({ error: '音频上传失败' }));
          throw new Error(err.error || '音频上传失败');
        }
        const { audioUrl } = await uploadRes.json();

        requestBody = {
          audioUrl, // 一步模式：传 audio_url（与 cover_feature_id 互斥）
          lyrics: params.lyrics.trim() || undefined, // 可选，不填则自动从参考音频提取
          prompt: params.prompt.trim(),
          isInstrumental: params.isInstrumental,
          audioSetting: { sampleRate: 44100, bitrate: 256000, format: params.outputFormat },
        };
      } else {
        // 两步模式：传 coverFeatureId + lyrics
        requestBody = {
          coverFeatureId,
          lyrics: params.lyrics.trim(),
          prompt: params.prompt.trim(),
          isInstrumental: false,
          audioSetting: { sampleRate: 44100, bitrate: 256000, format: params.outputFormat },
        };
      }

      const res = await fetch('/api/minimax/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        // 非流式错误响应（参数校验等）
        const data = await res.json().catch(() => ({ error: '生成失败，请重试' }));
        const errorCode = data.code || '';
        const errorMessage = data.error || '生成失败，请重试';

        if (errorCode === 'INSUFFICIENT_CREDITS') {
          setGenerationError('Credits 余额不足');
          setGenerationStatus('error');
          return;
        }

        throw new Error(errorMessage);
      }

      // 流式响应：读取 SSE 事件
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            console.log('[generate] SSE event:', event.type, event);

            if (event.type === 'completed' && event.audioUrl) {
              setGenerationResult({
                success: true,
                audioUrl: event.audioUrl,
                taskId: event.taskId,
              });
              setGenerationStatus('completed');
              useCreditStore.getState().fetchCredits({ force: true });
              completed = true;
              return;
            } else if (event.type === 'error') {
              throw new Error(event.error || '生成失败，请重试');
            }
            // heartbeat 和 started 事件忽略，继续读取
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message.includes('生成')) {
              throw parseErr;
            }
            // JSON 解析失败的行忽略
          }
        }
      }

      // 流结束后处理 buffer 中剩余数据
      if (!completed && buffer.trim()) {
        const remainingLine = buffer.trim();
        if (remainingLine.startsWith('data: ')) {
          const jsonStr = remainingLine.slice(6).trim();
          if (jsonStr) {
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'completed' && event.audioUrl) {
                setGenerationResult({
                  success: true,
                  audioUrl: event.audioUrl,
                  taskId: event.taskId,
                });
                setGenerationStatus('completed');
                useCreditStore.getState().fetchCredits({ force: true });
                completed = true;
              } else if (event.type === 'error') {
                throw new Error(event.error || '生成失败，请重试');
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message.includes('生成')) {
                throw parseErr;
              }
            }
          }
        }
      }

      // 流结束但没收到 completed 事件
      if (!completed) {
        throw new Error('生成超时，请重试');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成失败，请重试';
      if (!navigator.onLine) {
        setGenerationError('网络连接中断');
      } else {
        setGenerationError(message);
      }
      setGenerationStatus('error');
    }
  }, [coverMode, coverFeatureId, audioFile, generationStatus, params, isOnline]);

  // --- Regenerate handler (Task 8.2: Requirement 11.3) ---
  const handleRegenerate = useCallback(() => {
    setGenerationStatus('idle');
    setGenerationResult(null);
    setGenerationError(null);
    // Keep params and coverFeatureId - no need to re-upload or re-preprocess
  }, []);

  // --- Accept rewritten prompt and retry ---
  const handleAcceptRewrite = useCallback(() => {
    if (rewrittenPrompt) {
      setParams((prev) => ({ ...prev, prompt: rewrittenPrompt }));
    }
    setShowRewriteConfirm(false);
    setRewrittenPrompt(null);
    setGenerationStatus('idle');
    setGenerationError(null);
  }, [rewrittenPrompt]);

  const handleRejectRewrite = useCallback(() => {
    setShowRewriteConfirm(false);
    setRewrittenPrompt(null);
    setGenerationStatus('idle');
    setGenerationError(null);
  }, []);

  // --- Derived state ---
  const isPreprocessing = preprocessStatus === 'processing';
  const isPreprocessed = preprocessStatus === 'completed';
  const isGenerating = generationStatus === 'generating';
  const isCompleted = generationStatus === 'completed';
  const canPreprocess = uploadStatus === 'ready' && !isPreprocessing && preprocessStatus !== 'completed';
  const canRetryPreprocess = preprocessStatus === 'error' && preprocessRetryCount < 3;
  // 一步模式：上传音频后即可编辑参数和生成
  // 两步模式：需要预处理完成后才能编辑参数和生成
  const paramsDisabled = coverMode === 'one-step'
    ? (uploadStatus !== 'ready') || isGenerating
    : (!isPreprocessed) || isGenerating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Network offline banner */}
      {!isOnline && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>&#9888;</span>
          <span style={{
            fontSize: 13,
            color: '#f59e0b',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}>
            网络连接中断，部分功能暂时不可用
          </span>
        </div>
      )}

      {/* Main two-column layout (Requirement 9.3) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 32,
        alignItems: 'start',
      }}>
        {/* Left Column: Audio Upload + Waveform + Analyze Button */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: 20,
          padding: 24,
          border: '1px solid #2a2a40',
          boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minWidth: 0,
        }}>
          <h2 style={{
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: '#e8e8f0',
            margin: 0,
          }}>
            上传参考音频
          </h2>

          {/* AudioUploader */}
          <AudioUploader
            onFileSelected={handleFileSelected}
            onError={handleFileError}
            onRemove={handleFileRemove}
            audioFile={audioFile}
            status={uploadStatus}
            error={uploadError}
          />

          {/* WaveformVisualizer */}
          {uploadStatus === 'ready' && audioFile && (
            <WaveformVisualizer file={audioFile} />
          )}

          {/* Preprocess button / status */}
          {/* 预处理区域 - 仅两步模式（自定义创作）显示 */}
          {uploadStatus === 'ready' && coverMode === 'two-step' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Preprocess error message (Task 8.3) */}
              {preprocessStatus === 'error' && preprocessError && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#ef4444',
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                }}>
                  {preprocessError}
                </div>
              )}

              {/* Analyze / Retry button */}
              {(canPreprocess || canRetryPreprocess) && (
                <button
                  onClick={() => {
                    if (canRetryPreprocess) {
                      setPreprocessRetryCount((c) => c + 1);
                    }
                    handlePreprocess();
                  }}
                  disabled={isPreprocessing || (!canPreprocess && !canRetryPreprocess)}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: isPreprocessing
                      ? '#2a2a40'
                      : 'linear-gradient(135deg, #7536d5 0%, #9b59b6 100%)',
                    color: isPreprocessing ? '#666' : '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: isPreprocessing ? 'not-allowed' : 'pointer',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                    boxShadow: isPreprocessing ? 'none' : '0 4px 16px rgba(117, 54, 213, 0.3)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isPreprocessing
                    ? '正在分析...'
                    : canRetryPreprocess
                      ? `重新分析 (${preprocessRetryCount}/3)`
                      : '分析音频'}
                </button>
              )}

              {/* Max retries reached */}
              {preprocessStatus === 'error' && preprocessRetryCount >= 3 && (
                <p style={{
                  fontSize: 12,
                  color: '#ef4444',
                  margin: 0,
                  textAlign: 'center',
                  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                }}>
                  已达最大重试次数，请重新上传文件或稍后再试
                </p>
              )}

              {/* Processing indicator */}
              {isPreprocessing && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '8px 0',
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    border: '2px solid #7536d5',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'audioTabSpin 0.8s linear infinite',
                  }} />
                  <span style={{
                    fontSize: 13,
                    color: '#9ca3af',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  }}>
                    正在提取音频特征和歌词...
                  </span>
                </div>
              )}

              {/* Preprocess completed indicator */}
              {isPreprocessed && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 16 }}>&#10003;</span>
                  <span style={{
                    fontSize: 13,
                    color: '#22c55e',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  }}>
                    音频分析完成，可以编辑参数并生成编曲
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 歌词结构标签 - 左侧面板内 */}
          <div style={{
            background: '#12121e',
            borderRadius: 12,
            padding: 16,
            border: '1px solid #2a2a40',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0', margin: '0 0 10px 0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
              歌词结构标签
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['[Intro]', '[Verse]', '[Pre Chorus]', '[Chorus]', '[Bridge]', '[Outro]', '[Interlude]', '[Hook]', '[Inst]'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setParams(prev => ({ ...prev, lyrics: prev.lyrics + (prev.lyrics.endsWith('\n') || prev.lyrics === '' ? '' : '\n') + tag + '\n' }))}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2a2a40', background: '#1a1a2e', color: '#e8e8f0', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '8px 0 0 0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
              点击标签可快速插入到歌词中
            </p>
          </div>

          {/* 使用提示 - 左侧面板内 */}
          <div style={{
            background: '#12121e',
            borderRadius: 12,
            padding: 16,
            border: '1px solid #2a2a40',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', margin: '0 0 8px 0', fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
              💡 使用提示
            </p>
            <ul style={{ fontSize: 11, color: '#9ca3af', margin: 0, paddingLeft: 16, lineHeight: 1.8, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}>
              <li>使用结构标签如 [Verse]、[Chorus] 优化歌词结构</li>
              <li>风格描述越详细，生成效果越好（最多 300 字符）</li>
              <li>生成时间约 30-60 秒，请耐心等待</li>
              <li>一步模式歌词可选，不填则自动从参考音频提取</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Params Editor */}
        <div style={{
          background: '#1a1a2e',
          borderRadius: 20,
          padding: 24,
          border: '1px solid #2a2a40',
          boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
          minWidth: 0,
        }}>
          <h2 style={{
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: '#e8e8f0',
            margin: '0 0 20px 0',
          }}>
            编曲参数
          </h2>

          <ArrangementParamsEditor
            params={params}
            onChange={setParams}
            extractedLyrics={extractedLyrics}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            disabled={paramsDisabled}
            coverMode={coverMode}
            onCoverModeChange={setCoverMode}
          />

          {/* Generation error below params */}
          {generationError && !showRewriteConfirm && (
            <div style={{
              marginTop: 16,
              padding: '14px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <span style={{
                fontSize: 13,
                color: '#ef4444',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                lineHeight: 1.5,
              }}>
                {generationError}
              </span>
              {/* Credits insufficient - show recharge link */}
              {generationError.includes('Credits 余额不足') && (
                <a
                  href="/account"
                  style={{
                    fontSize: 13,
                    color: '#7536d5',
                    textDecoration: 'underline',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  }}
                >
                  前往充值 &rarr;
                </a>
              )}
            </div>
          )}

          {/* Sensitivity rewrite confirmation (Requirement 7.4) */}
          {showRewriteConfirm && rewrittenPrompt && (
            <div style={{
              marginTop: 16,
              padding: '16px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <p style={{
                fontSize: 13,
                color: '#f59e0b',
                margin: 0,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}>
                检测到敏感内容，已为您改写风格描述：
              </p>
              <p style={{
                fontSize: 13,
                color: '#e8e8f0',
                margin: 0,
                padding: '8px 12px',
                background: '#12121e',
                borderRadius: 6,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                lineHeight: 1.5,
              }}>
                {rewrittenPrompt}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAcceptRewrite}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#7536d5',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  }}
                >
                  接受改写
                </button>
                <button
                  onClick={handleRejectRewrite}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #2a2a40',
                    background: 'transparent',
                    color: '#9ca3af',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                  }}
                >
                  手动修改
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generation Progress (Task 8.1) */}
      {isGenerating && (
        <div style={{
          background: '#1a1a2e',
          borderRadius: 20,
          padding: '32px 24px',
          border: '1px solid #2a2a40',
          boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 40,
            height: 40,
            margin: '0 auto 16px',
            border: '3px solid #2a2a40',
            borderTopColor: '#7536d5',
            borderRadius: '50%',
            animation: 'audioTabSpin 1s linear infinite',
          }} />
          <p style={{
            fontSize: 14,
            color: '#e8e8f0',
            margin: 0,
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}>
            正在生成编曲，请稍候...
          </p>
          <p style={{
            fontSize: 12,
            color: '#9ca3af',
            margin: '8px 0 0 0',
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
          }}>
            生成可能需要 30 秒到 2 分钟，页面会自动刷新结果
          </p>
        </div>
      )}

      {/* Generation Result (Task 8.2: Requirements 11.1-11.4) */}
      {isCompleted && generationResult?.audioUrl && (
        <div style={{
          background: '#1a1a2e',
          borderRadius: 20,
          padding: 24,
          border: '1px solid #2a2a40',
          boxShadow: '0 4px 20px rgba(117, 54, 213, 0.06)',
        }}>
          <h3 style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#e8e8f0',
            marginBottom: 20,
            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
            textAlign: 'center',
          }}>
            &#127925; 生成完成
          </h3>

          {/* Audio Player (Requirement 11.1) */}
          <div style={{
            padding: 16,
            background: '#12121e',
            borderRadius: 14,
            border: '1px solid #2a2a40',
            marginBottom: 16,
          }}>
            <audio
              ref={audioRef}
              controls
              src={generationResult.audioUrl}
              style={{ width: '100%', height: 40 }}
            />
          </div>

          {/* Lyrics display for non-instrumental (Requirement 11.2) */}
          {!params.isInstrumental && params.lyrics && (
            <div style={{
              padding: 16,
              background: '#12121e',
              borderRadius: 14,
              border: '1px solid #2a2a40',
              marginBottom: 16,
              maxHeight: 200,
              overflowY: 'auto',
            }}>
              <h4 style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#c0a7fc',
                marginBottom: 8,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}>
                歌词
              </h4>
              <pre style={{
                fontSize: 13,
                color: '#e8e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                lineHeight: 1.6,
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
              }}>
                {params.lyrics}
              </pre>
            </div>
          )}

          {/* Regenerate button (Requirement 11.3) */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleRegenerate}
              style={{
                padding: '12px 32px',
                borderRadius: 24,
                border: '1px solid #7536d5',
                background: 'transparent',
                color: '#7536d5',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                transition: 'all 0.2s ease',
              }}
            >
              重新生成
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes audioTabSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
