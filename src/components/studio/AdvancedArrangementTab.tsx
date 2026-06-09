'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AudioUploader from './AudioUploader';
import WaveformVisualizer from './WaveformVisualizer';
import type { Template } from '@/types/template';
import { createAdvancedArrangementTask, fetchAdvancedArrangementStatus, uploadAdvancedArrangementAudio } from '@/lib/studio/advancedArrangementClient';
import { getTemplateAdvancedAnalysis, getTemplateAdvancedPrompt } from '@/lib/template/advancedTemplateFields';

type UploadStatus = 'idle' | 'validating' | 'ready' | 'error';
type GenerateStatus = 'idle' | 'uploading' | 'queued' | 'generating' | 'completed' | 'error';
type UploadPhase = 'idle' | 'signing' | 'uploading' | 'uploaded' | 'creating';

const FIXED_MODEL = 'V5_5';
const LYRIC_STRUCTURE_TAGS = ['[Intro]', '[Verse]', '[Pre Chorus]', '[Chorus]', '[Bridge]', '[Outro]', '[Interlude]', '[Hook]', '[Inst]'];

const STATUS_TEXT: Record<string, string> = {
  PENDING: '任务排队中',
  TEXT_SUCCESS: '文本生成完成',
  FIRST_SUCCESS: '首个版本生成完成',
  SUCCESS: '生成完成',
  CREATE_TASK_FAILED: '任务创建失败',
  GENERATE_AUDIO_FAILED: '音频生成失败',
  CALLBACK_EXCEPTION: '回调异常',
  SENSITIVE_WORD_ERROR: '内容安全检查未通过',
};

interface StatusResponse {
  status: string;
  done: boolean;
  failed: boolean;
  audioUrl?: string | null;
  lyrics?: string | null;
  title?: string | null;
  tags?: string | null;
  duration?: number | null;
  tracks?: GeneratedTrack[];
  errorMessage?: string | null;
}

interface GeneratedTrack {
  id?: string;
  audioUrl?: string;
  streamAudioUrl?: string;
  imageUrl?: string;
  prompt?: string;
  modelName?: string;
  title?: string;
  tags?: string;
  createTime?: string;
  duration?: number;
}

interface AdvancedArrangementTabProps {
  variant?: 'advanced' | 'template' | 'templateInstrumental';
  selectedTemplate?: Template | null;
  templatePicker?: ReactNode;
}

export default function AdvancedArrangementTab({
  variant = 'advanced',
  selectedTemplate = null,
  templatePicker,
}: AdvancedArrangementTabProps) {
  const router = useRouter();
  const isTemplateVariant = variant === 'template';
  const isTemplateInstrumentalVariant = variant === 'templateInstrumental';
  const usesSelectedTemplate = isTemplateVariant || isTemplateInstrumentalVariant;
  const templateStyle = getTemplateStyle(selectedTemplate);
  const templateAdvancedTags = getTemplateAdvancedTags(selectedTemplate);
  const lockedStyle = isTemplateVariant ? templateStyle : null;
  const templateTitle = selectedTemplate?.name?.trim() || '';

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [customMode, setCustomMode] = useState(true);
  const [instrumental, setInstrumental] = useState(false);
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativeTags, setNegativeTags] = useState('');
  const [vocalGender, setVocalGender] = useState<'auto' | 'm' | 'f'>('auto');
  const [styleWeight, setStyleWeight] = useState(0.65);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.5);
  const [audioWeight, setAudioWeight] = useState(0.65);

  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [localTaskId, setLocalTaskId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [creationUrl, setCreationUrl] = useState<string | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const effectiveCustomMode = usesSelectedTemplate ? true : customMode;
  const effectiveStyle = lockedStyle ?? style;
  const effectiveTags = templateAdvancedTags;
  const showTemplateInstrumentalTagsField = false;

  useEffect(() => {
    if (!usesSelectedTemplate) return;
    setCustomMode(true);
    setStyle(lockedStyle || '');
    setTitle((current) => current.trim() || templateTitle);
  }, [usesSelectedTemplate, lockedStyle, templateTitle]);

  const promptLabel = effectiveCustomMode ? (instrumental ? '创作描述（可选）' : '歌词') : '生成描述 *';
  const promptPlaceholder = effectiveCustomMode
    ? instrumental
      ? '例如：延续参考音频的钢琴动机，改编成更空灵、更适合夜间聆听的纯音乐版本'
      : '[Verse]\n城市灯火慢慢亮起\n我把心事写进风里\n\n[Chorus]\n让旋律带我穿过人海...'
    : '把上传音频改编成适合华语短视频传播的流行摇滚副歌';
  const hidePromptField = isTemplateInstrumentalVariant || (isTemplateVariant && instrumental);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef(0);
  const trackAudioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    const busy = generateStatus === 'uploading' || generateStatus === 'queued' || generateStatus === 'generating';
    if (!busy) return;
    const timer = setInterval(() => {
      if (pollStartedAtRef.current > 0) {
        setElapsedSeconds(Math.floor((Date.now() - pollStartedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [generateStatus]);

  const handleFileSelected = useCallback((file: File, _base64: string, duration: number) => {
    setAudioFile(file);
    setAudioDuration(duration);
    setUploadStatus('ready');
    setUploadError(null);
    setGenerateStatus('idle');
    setTaskId(null);
    setLocalTaskId(null);
    setBatchId(null);
    setCreationUrl(null);
    setRemoteStatus(null);
    setResult(null);
    setError(null);
    setPollCount(0);
    setElapsedSeconds(0);
    setCopiedLyrics(false);
    setUploadPhase('idle');
    setUploadProgress(0);
  }, []);

  const handleFileError = useCallback((message: string) => {
    setUploadStatus('error');
    setUploadError(message);
  }, []);

  const handleFileRemove = useCallback(() => {
    stopPolling();
    setAudioFile(null);
    setAudioDuration(null);
    setUploadStatus('idle');
    setUploadError(null);
    setGenerateStatus('idle');
    setTaskId(null);
    setLocalTaskId(null);
    setBatchId(null);
    setCreationUrl(null);
    setRemoteStatus(null);
    setResult(null);
    setError(null);
    setPollCount(0);
    setElapsedSeconds(0);
    setCopiedLyrics(false);
    setUploadPhase('idle');
    setUploadProgress(0);
  }, [stopPolling]);

  const insertLyricTag = useCallback((tag: string) => {
    setPrompt(prev => `${prev}${prev.endsWith('\n') || prev === '' ? '' : '\n'}${tag}\n`);
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!audioFile) return '请先上传参考音频';
    if (usesSelectedTemplate && !selectedTemplate) return '请先选择一个模板';
    if (isTemplateInstrumentalVariant) {
      if (!effectiveTags.trim()) return '当前模板缺少风格标签，请先在后台完成模板分析';
      if (!(title.trim() || templateTitle)) return '请填写作品标题';
      if (effectiveTags.length > 1000) return '风格标签不能超过 1000 个字符';
      if (title.length > 100) return '标题不能超过 100 个字符';
      if (negativeTags.length > 500) return '排除标签不能超过 500 个字符';
      return null;
    }
    if (isTemplateVariant && !effectiveStyle.trim()) return '当前模板缺少可用风格，请换一个模板';
    if (effectiveCustomMode) {
      if (!effectiveStyle.trim()) return '请填写风格描述';
      if (!((isTemplateVariant ? title.trim() || templateTitle : title.trim()))) return '请填写作品标题';
      if (!instrumental && !prompt.trim()) return '非纯音乐模式下请填写歌词';
      if (!hidePromptField && prompt.length > 5000) return `${instrumental ? '创作描述' : '歌词'}不能超过 5000 个字符`;
    } else {
      if (!prompt.trim()) return '快捷模式下请填写生成描述';
      if (prompt.length > 500) return '快捷模式描述不能超过 500 个字符';
    }
    if (effectiveStyle.length > 1000) return '风格描述不能超过 1000 个字符';
    if (title.length > 100) return '标题不能超过 100 个字符';
    if (negativeTags.length > 500) return '排除标签不能超过 500 个字符';
    return null;
  }, [audioFile, effectiveCustomMode, effectiveStyle, effectiveTags, hidePromptField, instrumental, isTemplateInstrumentalVariant, isTemplateVariant, negativeTags.length, prompt, selectedTemplate, templateTitle, title, usesSelectedTemplate]);

  const pollTask = useCallback((id: string, localId?: string | null) => {
    stopPolling();
    pollStartedAtRef.current = Date.now();
    setPollCount(0);
    setElapsedSeconds(0);

    const poll = async () => {
      setPollCount((count) => count + 1);
      setElapsedSeconds(Math.floor((Date.now() - pollStartedAtRef.current) / 1000));

      if (Date.now() - pollStartedAtRef.current > 10 * 60 * 1000) {
        stopPolling();
        setGenerateStatus('error');
        setError('生成等待超时，请稍后到任务记录中确认结果，或重新提交');
        return;
      }

      try {
        const params = new URLSearchParams({ taskId: id });
        if (localId) params.set('localTaskId', localId);
        const res = await fetchAdvancedArrangementStatus(params);
        const data = await res.json().catch(() => ({ error: '服务响应异常，请稍后重试' }));

        if (!res.ok) {
          throw new Error(data.error || '查询任务状态失败');
        }

        setRemoteStatus(data.status);

        if (data.done) {
          stopPolling();
          setResult(data);
          setGenerateStatus('completed');
          setCopiedLyrics(false);
          return;
        }

        if (data.failed) {
          stopPolling();
          setGenerateStatus('error');
          setError(formatAdvancedArrangementError(data.errorMessage || STATUS_TEXT[data.status] || '生成失败，请调整参数后重试'));
          return;
        }

        setGenerateStatus('generating');
      } catch (err) {
        setError(formatAdvancedArrangementError(err instanceof Error ? err.message : '查询任务状态失败'));
      }
    };

    poll();
    pollRef.current = setInterval(poll, 8000);
  }, [stopPolling]);

  const handleGenerate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setGenerateStatus('error');
      return;
    }

    stopPolling();
    setGenerateStatus('uploading');
    setError(null);
    setResult(null);
    setTaskId(null);
    setLocalTaskId(null);
    setBatchId(null);
    setCreationUrl(null);
    setRemoteStatus(null);
    setPollCount(0);
    setElapsedSeconds(0);
    setCopiedLyrics(false);
    setUploadPhase('signing');
    setUploadProgress(0);

    try {
      const uploadedAudio = await uploadAdvancedArrangementAudio(audioFile!, ({ phase, percent }) => {
        setUploadPhase(phase);
        setUploadProgress(percent);
      });
      setUploadPhase('creating');
      setUploadProgress(100);
      const formData = new FormData();
      formData.append('uploadedBucket', uploadedAudio.bucket);
      formData.append('uploadedPath', uploadedAudio.path);
      formData.append('fileName', uploadedAudio.fileName);
      formData.append('fileSize', String(uploadedAudio.size));
      formData.append('contentType', uploadedAudio.contentType);
      formData.append('model', FIXED_MODEL);
      formData.append('title', (title.trim() || templateTitle).trim());
      formData.append('negativeTags', negativeTags.trim());
      formData.append('styleWeight', String(styleWeight));
      formData.append('weirdnessConstraint', String(weirdnessConstraint));
      formData.append('audioWeight', String(audioWeight));

      if (selectedTemplate?.id) {
        formData.append('templateId', selectedTemplate.id);
      }

      if (isTemplateInstrumentalVariant) {
        formData.append('tags', effectiveTags.trim());
      } else {
        formData.append('customMode', String(effectiveCustomMode));
        formData.append('instrumental', String(instrumental));
        formData.append('style', effectiveStyle.trim());
        formData.append('prompt', hidePromptField ? '' : prompt.trim());
      }

      if (!isTemplateInstrumentalVariant && vocalGender !== 'auto') {
        formData.append('vocalGender', vocalGender);
      }

      const res = await createAdvancedArrangementTask(formData, isTemplateInstrumentalVariant);
      const data = await res.json().catch(() => ({ error: '服务响应异常，请稍后重试' }));

      if (!res.ok) {
        throw new Error(data.error || '高级编曲任务创建失败');
      }

      setTaskId(data.taskId);
      setLocalTaskId(data.localTaskId || null);
      setBatchId(data.batchId || null);
      setCreationUrl(data.creationUrl || null);
      setGenerateStatus('queued');
      setUploadPhase('idle');
      pollTask(data.taskId, data.localTaskId);
    } catch (err) {
      setGenerateStatus('error');
      setUploadPhase('idle');
      setError(formatAdvancedArrangementError(err instanceof Error ? err.message : '高级编曲任务创建失败'));
    }
  }, [
    audioFile,
    audioWeight,
    effectiveCustomMode,
    effectiveStyle,
    effectiveTags,
    hidePromptField,
    instrumental,
    isTemplateInstrumentalVariant,
    negativeTags,
    pollTask,
    prompt,
    selectedTemplate,
    stopPolling,
    styleWeight,
    templateTitle,
    title,
    validateForm,
    vocalGender,
    weirdnessConstraint,
  ]);

  const isBusy = generateStatus === 'uploading' || generateStatus === 'queued' || generateStatus === 'generating';
  const showProgressOverlay = isBusy || generateStatus === 'completed';

  useEffect(() => {
    if (!showProgressOverlay) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
    };
  }, [showProgressOverlay]);

  const canGenerate = uploadStatus === 'ready' && !isBusy && (
    !usesSelectedTemplate ||
    Boolean(selectedTemplate && (isTemplateInstrumentalVariant || effectiveStyle.trim()))
  );
  const resultTracks = Array.isArray(result?.tracks) ? result.tracks : [];
  const playableTracks = resultTracks.some(hasTrackAudio)
    ? resultTracks.filter(hasTrackAudio)
    : result?.audioUrl
      ? [{
        audioUrl: result.audioUrl,
        prompt: result.lyrics || undefined,
        title: result.title || undefined,
        tags: result.tags || undefined,
        duration: result.duration || undefined,
      }]
      : [];
  const allLyricsText = collectLyricsText(result?.lyrics || null, playableTracks);
  const isInstrumentalResult = isInstrumentalLyricsBlock(allLyricsText);
  useEffect(() => {
    trackAudioRefs.current = trackAudioRefs.current.slice(0, playableTracks.length);
  }, [playableTracks.length]);

  useEffect(() => {
    if (generateStatus !== 'completed') return;
    const targetId = batchId || localTaskId || taskId;
    const timer = window.setTimeout(() => {
      router.push(targetId ? `/account/creations?expand=${encodeURIComponent(targetId)}` : '/account/creations');
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [batchId, generateStatus, localTaskId, router, taskId]);

  const handleTrackAudioPlay = useCallback((activeIndex: number) => {
    trackAudioRefs.current.forEach((audio, index) => {
      if (index !== activeIndex && audio && !audio.paused) {
        audio.pause();
      }
    });
  }, []);

  const handleCopyLyrics = useCallback(async () => {
    if (!allLyricsText.trim()) return;

    try {
      await navigator.clipboard.writeText(allLyricsText);
      setCopiedLyrics(true);
      window.setTimeout(() => setCopiedLyrics(false), 2400);
    } catch {
      setError('歌词复制失败，请手动选择后复制');
    }
  }, [allLyricsText]);

  const progressPercent = generateStatus === 'completed'
    ? 100
    : generateStatus === 'uploading'
      ? Math.max(uploadPhase === 'signing' ? 3 : 5, Math.min(100, uploadProgress))
      : Math.min(92, Math.max(
        generateStatus === 'queued' ? 24 : 38,
        Math.round((elapsedSeconds / 360) * 92)
      ));
  const progressStage =
    generateStatus === 'completed'
      ? '生成完成，正在跳转到我的作品'
      : generateStatus === 'uploading'
        ? uploadPhase === 'signing'
          ? '正在准备上传地址'
          : uploadPhase === 'creating'
            ? '音频已上传，正在创建生成任务'
            : uploadPhase === 'uploaded'
              ? '音频上传完成'
              : '正在上传参考音频'
      : remoteStatus === 'TEXT_SUCCESS'
        ? '歌词与编曲方案已生成'
        : remoteStatus === 'FIRST_SUCCESS'
          ? '首个音频版本已完成'
          : generateStatus === 'queued'
            ? '任务已提交，等待引擎接单'
            : '正在生成音频，可稍后查看';
  const progressHint =
    generateStatus === 'uploading'
      ? uploadPhase === 'uploading'
        ? '大文件上传时间取决于本地网络，上载完成后会自动创建生成任务。'
        : uploadPhase === 'creating'
          ? '上传已完成，正在把任务提交给生成引擎。'
          : '正在建立安全上传通道，请稍候。'
      : elapsedSeconds < 45
        ? taskId
          ? '任务已提交，可以离开页面；完成后可在我的作品查看。'
          : '通常需要几十秒到数分钟，页面会自动刷新结果。'
        : elapsedSeconds < 180
          ? '任务仍在处理，复杂音频会等待更久一些；你也可以先去我的作品查看。'
          : '仍在排队或生成中，我会持续自动查询；你可以离开页面稍后查看。';
  const progressText = remoteStatus
    ? STATUS_TEXT[remoteStatus] || remoteStatus
    : generateStatus === 'uploading'
      ? uploadPhase === 'creating'
        ? '正在创建任务'
        : `正在上传 ${progressPercent}%`
      : generateStatus === 'queued'
        ? '任务已提交'
        : '正在生成';

  const progressDialogText = generateStatus === 'completed' ? '生成已完成' : progressText;
  const progressDetailText = generateStatus === 'uploading'
    ? uploadPhase === 'creating'
      ? '上传已完成，正在创建生成任务'
      : uploadPhase === 'signing'
        ? '正在准备上传地址'
        : `正在上传参考音频 · ${progressPercent}%`
    : generateStatus === 'completed'
      ? '作品已保存，即将进入我的作品'
      : `${progressDialogText} · 已等待 ${elapsedSeconds}s · 第 ${pollCount} 次查询`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: usesSelectedTemplate ? 'minmax(0, 1fr) minmax(360px, 420px)' : 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
        gap: usesSelectedTemplate ? 18 : 32,
        alignItems: 'start',
      }}>
        <section style={panelStyle}>
          {templatePicker && (
            <div style={{ marginBottom: 26 }}>
              {templatePicker}
            </div>
          )}

          <div style={sectionHeaderStyle}>
            <h2 style={titleStyle}>{usesSelectedTemplate ? '参考音频（可选）' : '参考音频'}</h2>
          </div>

          {usesSelectedTemplate && selectedTemplate && !templatePicker && (
            <div style={selectedTemplateStripStyle}>
              <div style={templateCoverThumbStyle(selectedTemplate.coverUrl)} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#e8e8f0', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTemplate.name}
                </div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTemplate.genre || '模板风格'}
                </div>
              </div>
            </div>
          )}

          <AudioUploader
            onFileSelected={handleFileSelected}
            onError={handleFileError}
            onRemove={handleFileRemove}
            audioFile={audioFile}
            status={uploadStatus}
            error={uploadError}
            maxSizeMB={100}
            maxDurationSeconds={480}
            requirementText="仅支持 MP3/WAV 格式，最大 100MB，时长 6秒-8分钟"
            compact={usesSelectedTemplate}
          />

          {audioFile && uploadStatus === 'ready' && (
            <WaveformVisualizer file={audioFile} />
          )}

          {effectiveCustomMode && !instrumental && !isTemplateInstrumentalVariant && (
            <div style={lyricTagPanelStyle}>
              <div style={lyricTagHeaderStyle}>
                <span style={{ ...labelStyle, color: '#e8e8f0' }}>歌词结构标签</span>
                <span style={lyricTagHintStyle}>点击插入右侧歌词</span>
              </div>
              <div style={lyricTagGridStyle}>
                {LYRIC_STRUCTURE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={isBusy}
                    onClick={() => insertLyricTag(tag)}
                    style={{
                      ...lyricTagButtonStyle,
                      opacity: isBusy ? 0.55 : 1,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={hintBoxStyle}>
            <div style={{ color: '#e8e8f0', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {isTemplateInstrumentalVariant ? '模板伴奏说明' : isTemplateVariant ? '模板编曲说明' : '上传与参考说明'}
            </div>
            <p style={hintTextStyle}>上传参考音频后，系统会先完成音频处理，再创建高级编曲任务。</p>
            <p style={hintTextStyle}>{isTemplateInstrumentalVariant ? '模板风格会随任务自动传递，参考音频作为需要加伴奏的音频。' : isTemplateVariant ? '模板会锁定风格方向，参考音频影响旋律、情绪和声线，歌词控制最终表达。' : '参考音频仅支持 MP3/WAV，建议 6 秒到 8 分钟内；自定义模式下，非纯音乐请填写歌词，纯音乐可以补充创作描述。'}</p>
            {!usesSelectedTemplate && <p style={hintTextStyle}>参考音频会影响旋律、情绪和声线方向；右侧的风格、权重和歌词会控制最终改编强度。</p>}
            {audioDuration !== null && (
              <p style={hintTextStyle}>当前音频时长：{Math.round(audioDuration)} 秒</p>
            )}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={titleStyle}>{isTemplateInstrumentalVariant ? '模板伴奏参数' : isTemplateVariant ? '模板编曲参数' : '高级编曲参数'}</h2>
          </div>

          {!usesSelectedTemplate && (
            <div style={modeRowStyle}>
              <ModeButton active={customMode} disabled={isBusy} onClick={() => setCustomMode(true)}>自定义模式</ModeButton>
              <ModeButton active={!customMode} disabled={isBusy} onClick={() => setCustomMode(false)}>快捷模式</ModeButton>
            </div>
          )}

          {usesSelectedTemplate && (
            <div style={templateModeNoticeStyle}>
              <span style={{ color: 'var(--hc-lime)', fontSize: 12, fontWeight: 800 }}>自定义模式</span>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{isTemplateInstrumentalVariant ? '风格标签已由模板自动填充' : '风格已由模板自动填充'}</span>
            </div>
          )}

          {!isTemplateInstrumentalVariant && <div style={instrumentalSettingStyle}>
            <div>
              <div style={{ color: '#e8e8f0', fontSize: 13, fontWeight: 700 }}>纯音乐</div>
              <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
                开启后不要求填写歌词，生成无主唱版本
              </div>
            </div>
            <InstrumentalSwitch
              checked={instrumental}
              disabled={isBusy}
              onChange={() => setInstrumental((value) => !value)}
            />
          </div>}

          {effectiveCustomMode && (
            <>
              <div style={formGridStyle}>
                <label style={fieldStyle}>
                  <span style={requiredLabelStyle}>歌曲名称</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isBusy}
                    placeholder={templateTitle || '例如：夜色电台'}
                    style={inputStyle}
                  />
                </label>

                {!isTemplateInstrumentalVariant && <label style={fieldStyle}>
                  <span style={labelStyle}>人声倾向</span>
                  <select
                    value={vocalGender}
                    onChange={(e) => setVocalGender(e.target.value as 'auto' | 'm' | 'f')}
                    disabled={isBusy || instrumental}
                    style={selectStyle}
                  >
                    <option value="auto">自动</option>
                    <option value="f">女声</option>
                    <option value="m">男声</option>
                  </select>
                </label>}
              </div>

              {!usesSelectedTemplate && (
                <label style={fieldStyle}>
                  <span style={fieldHeaderStyle}>
                    <span style={requiredLabelStyle}>风格</span>
                    <span style={countTextStyle}>{style.length}/1000</span>
                  </span>
                  <textarea
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    disabled={isBusy}
                    placeholder="Mandarin pop, emotional ballad, warm piano, cinematic strings"
                    style={{ ...textareaStyle, minHeight: 72 }}
                  />
                </label>
              )}

              {showTemplateInstrumentalTagsField && isTemplateInstrumentalVariant && (
                <label style={fieldStyle}>
                  <span style={fieldHeaderStyle}>
                    <span style={requiredLabelStyle}>风格标签</span>
                    <span style={countTextStyle}>{effectiveTags.length}/1000</span>
                  </span>
                  <textarea
                    value={effectiveTags || '请选择带风格分析的模板'}
                    readOnly
                    disabled
                    style={{ ...textareaStyle, minHeight: 118, color: effectiveTags ? '#e8e8f0' : '#6b7280' }}
                  />
                </label>
              )}
            </>
          )}

          {!hidePromptField && (
            <label style={fieldStyle}>
              <span style={fieldHeaderStyle}>
                <span style={!instrumental ? requiredLabelStyle : labelStyle}>{promptLabel}</span>
                <span style={countTextStyle}>{prompt.length}/{effectiveCustomMode ? 5000 : 500}</span>
              </span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isBusy}
                placeholder={promptPlaceholder}
                style={{ ...textareaStyle, minHeight: 160 }}
              />
            </label>
          )}

          {effectiveCustomMode && (
            <>
              <label style={fieldStyle}>
                <span style={labelStyle}>{isTemplateInstrumentalVariant ? '排除标签（留空将自动补默认值）' : '排除标签'}</span>
                <input
                  value={negativeTags}
                  onChange={(e) => setNegativeTags(e.target.value)}
                  disabled={isBusy}
                  placeholder={isTemplateInstrumentalVariant ? '例如：low quality, distorted, harsh noise' : '例如：no rap, no EDM drop'}
                  style={inputStyle}
                />
              </label>

              <div style={sliderGridStyle}>
                <SliderField label="风格权重" value={styleWeight} disabled={isBusy} onChange={setStyleWeight} />
                <SliderField label="创意变化" value={weirdnessConstraint} disabled={isBusy} onChange={setWeirdnessConstraint} />
                <SliderField label="音频参考权重" value={audioWeight} disabled={isBusy} onChange={setAudioWeight} />
              </div>
            </>
          )}

          {error && (
            <div style={errorStyle}>{error}</div>
          )}

          {usesSelectedTemplate && (
            <div style={estimateCardStyle}>
              <div style={estimateTitleStyle}>生成预估</div>
              <div style={estimateGridStyle}>
                <div>
                  <span style={estimateLabelStyle}>预计时长</span>
                  <strong style={estimateValueStyle}>约 1分30秒</strong>
                </div>
                <div>
                  <span style={estimateLabelStyle}>音频质量</span>
                  <strong style={estimateValueStyle}>高品质 320kbps</strong>
                </div>
                <div>
                  <span style={estimateLabelStyle}>生成次数</span>
                  <strong style={estimateValueStyle}>1 次</strong>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            onMouseEnter={(e) => { if (canGenerate) e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            style={{
              width: '100%',
              marginTop: 18,
              padding: usesSelectedTemplate ? '24px 24px' : '14px 24px',
              minHeight: usesSelectedTemplate ? 76 : undefined,
              borderRadius: usesSelectedTemplate ? 18 : 24,
              border: 'none',
              background: canGenerate ? 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))' : 'linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.07))',
              color: canGenerate ? '#08090c' : '#6b7280',
              fontSize: usesSelectedTemplate ? 18 : 15,
              fontWeight: 800,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--hc-font)',
              boxShadow: canGenerate ? '0 4px 20px rgba(206, 255, 53, 0.22)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <span>{isBusy ? progressText : isTemplateInstrumentalVariant ? '开始生成伴奏' : isTemplateVariant ? '开始 AI 创作' : '开始高级编曲'}</span>
            {usesSelectedTemplate && (
              <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>
                {!selectedTemplate
                  ? '请先选择模板'
                  : uploadStatus !== 'ready'
                    ? '请先上传参考音频'
                    : isTemplateInstrumentalVariant ? 'V5.5 add-instrumental' : '模板编曲'}
              </span>
            )}
          </button>
        </section>
      </div>

      {showProgressOverlay && (
        <div style={statusPanelStyle}>
          <div style={spinnerStyle} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ color: '#e8e8f0', fontSize: 14, fontWeight: 700 }}>{progressStage}</div>
              <div style={{ color: 'var(--hc-lime)', fontSize: 12, fontWeight: 700 }}>{progressPercent}%</div>
            </div>
            <div style={progressBarTrackStyle}>
              <div style={{ ...progressBarFillStyle, width: `${progressPercent}%` }} />
            </div>
            <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
              {progressDetailText}
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4, lineHeight: 1.6 }}>
              {taskId ? `任务 ID：${taskId}` : '正在准备任务，请保持页面打开'} · {progressHint}
            </div>
          </div>
          {taskId && generateStatus !== 'completed' && (
            <button
              type="button"
              onClick={() => router.push(creationUrl || '/account/creations')}
              style={{
                border: '1px solid rgba(206,255,53,0.32)',
                background: 'rgba(206,255,53,0.1)',
                color: 'var(--hc-lime)',
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              去我的作品
            </button>
          )}
          <div style={{ display: 'none' }}>
            <div style={{ color: '#e8e8f0', fontSize: 14, fontWeight: 600 }}>{progressDialogText}</div>
            <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 6 }}>
              {taskId ? `任务 ID：${taskId}` : '正在准备任务，请保持页面打开'}
            </div>
          </div>
        </div>
      )}

      {generateStatus === 'completed' && result?.audioUrl && (
        <section style={panelStyle}>
          <h3 style={{ ...titleStyle, textAlign: 'center', marginBottom: 18 }}>高级编曲完成</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <ResultMeta label="标题" value={result.title || title || '未命名'} />
            <ResultMeta label="风格" value={result.tags || style || '-'} />
            <ResultMeta label="时长" value={result.duration ? `${Math.round(result.duration)} 秒` : '-'} />
          </div>
          {playableTracks.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {playableTracks.map((track, index) => {
                const generationTaskId = getResultGenerationTaskId(localTaskId, index);

                return (
                  <div key={track.id || index} style={trackRowStyle}>
                    <div style={trackAudioRowStyle}>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{'\u7248\u672c '}{index + 1}</span>
                      <audio
                        ref={(node) => {
                          trackAudioRefs.current[index] = node;
                        }}
                        src={track.audioUrl || track.streamAudioUrl}
                        controls
                        onPlay={() => handleTrackAudioPlay(index)}
                        style={{ flex: 1, height: 34 }}
                      />
                    </div>
                    {isTemplateVariant && generationTaskId && (
                      <div style={stemActionRowStyle}>
                        <a
                          href={`/studio/stem-editor?generationTaskId=${encodeURIComponent(generationTaskId)}`}
                          style={stemEditLinkStyle}
                        >
                          编辑歌曲
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {allLyricsText && (
            <div style={lyricsBoxStyle}>
              <div style={lyricsHeaderStyle}>
                <div style={{ color: '#e8e8f0', fontSize: 13, fontWeight: 700 }}>{isInstrumentalResult ? '内容类型' : '歌词'}</div>
                {!isInstrumentalResult && (
                  <button type="button" onClick={handleCopyLyrics} style={copyLyricsButtonStyle}>
                    {copiedLyrics ? '已复制' : '复制全部歌词'}
                  </button>
                )}
              </div>
              {copiedLyrics && (
                <div style={copyToastStyle}>歌词已复制到剪贴板，可以直接粘贴使用</div>
              )}
              <div style={lyricsScrollStyle}>
                <HighlightedLyrics lyrics={allLyricsText} />
              </div>
            </div>
          )}
          {batchId && (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <a href={`/account/creations?expand=${encodeURIComponent(batchId)}`} style={creationLinkStyle}>
                查看我的创作
              </a>
            </div>
          )}
        </section>
      )}

      <style>{`
        @keyframes advancedArrangementSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function collectLyricsText(primaryLyrics: string | null, tracks: GeneratedTrack[]) {
  const trackLyrics = tracks
    .map((track, index) => {
      const lyrics = formatTrackLyrics(track.prompt);
      if (!lyrics) return null;
      return `版本 ${index + 1}\n${lyrics}`;
    })
    .filter(Boolean);

  if (trackLyrics.length > 0) {
    return trackLyrics.join('\n\n');
  }

  return formatTrackLyrics(primaryLyrics);
}

function hasTrackAudio(track: GeneratedTrack) {
  return Boolean(track.audioUrl || track.streamAudioUrl);
}

function getResultGenerationTaskId(baseTaskId: string | null, index: number) {
  if (!baseTaskId) return null;
  return index === 0 ? baseTaskId : `${baseTaskId}-v${index + 1}`;
}

function getTemplateStyle(template?: Template | null) {
  if (!template) return '';
  return (
    getTemplateAdvancedPrompt(template) ||
    template.lyriaPrompt?.trim() ||
    template.genre?.trim() ||
    template.description?.trim() ||
    template.analysisResult?.trim() ||
    ''
  );
}

function getTemplateAdvancedTags(template?: Template | null) {
  if (!template) return '';
  return (
    getTemplateAdvancedPrompt(template) ||
    getTemplateAdvancedAnalysis(template) ||
    template.genre?.trim() ||
    template.description?.trim() ||
    ''
  );
}

function formatTrackLyrics(lyrics?: string | null) {
  const normalized = lyrics?.trim() || '';
  if (!normalized) return '';
  return isInstrumentalText(normalized) ? '纯音乐' : normalized;
}

function isInstrumentalText(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized === '[instrumental]' || normalized === 'instrumental' || normalized === '纯音乐';
}

function isInstrumentalLyricsBlock(text: string) {
  const meaningfulLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return meaningfulLines.length > 0 && meaningfulLines.every((line) => /^版本\s+\d+$/.test(line) || line === '纯音乐');
}

function formatAdvancedArrangementError(message: string) {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return '生成失败，请调整参数后重试';
  if (lower.includes('uploaded audio matches existing work of art')) {
    return '上传的参考音频疑似匹配已有版权作品，无法继续生成。请更换为你拥有授权或原创的音频后重试。';
  }
  if (lower.includes('uploaded audio contains copyrighted lyrics')) {
    return '上传的参考音频包含疑似版权歌词，无法继续生成。请更换音频或使用原创/已授权歌词后重试。';
  }
  if (lower.includes('copyright')) {
    return '内容疑似涉及版权限制，无法继续生成。请更换为原创或已授权素材后重试。';
  }
  if (lower.includes('sensitive')) {
    return '内容安全检测未通过，请调整歌词、描述或参考音频后重试。';
  }
  if (lower.includes('callbackurl')) {
    return '回调地址配置异常，请稍后重试或联系管理员。';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return '网络请求失败，请检查连接后重试。';
  }
  if (lower.includes('timeout')) {
    return '生成等待超时，请稍后到“我的创作”中查看结果，或重新提交。';
  }

  return normalized;
}

function HighlightedLyrics({ lyrics, compact = false }: { lyrics: string; compact?: boolean }) {
  const lines = lyrics.split(/\r?\n/);

  return (
    <div style={{ ...lyricsTextStyle, fontSize: compact ? 12 : 13 }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const isSection = /^\[[^\]]+\]$/.test(trimmed) || /^版本\s+\d+/.test(trimmed);
        const isBlank = trimmed.length === 0;

        if (isBlank) {
          return <div key={index} style={{ height: compact ? 8 : 12 }} />;
        }

        return (
          <div
            key={`${index}-${line}`}
            style={{
              ...lyricLineStyle,
              ...(isSection ? lyricSectionStyle : lyricContentStyle),
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '9px 12px',
        borderRadius: 10,
        border: active ? '1px solid rgba(206, 255, 53, 0.48)' : '1px solid #2a2a40',
        background: active ? 'rgba(206, 255, 53, 0.1)' : '#12121e',
        color: active ? 'var(--hc-lime)' : '#9ca3af',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      }}
    >
      {children}
    </button>
  );
}

function InstrumentalSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      flexShrink: 0,
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 38,
          height: 20,
          borderRadius: 999,
          background: checked ? 'linear-gradient(135deg, var(--hc-lime), var(--hc-cyan))' : '#2a2a40',
          transition: 'background 0.2s ease',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        }} />
      </span>
    </label>
  );
}

function SliderField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label} <strong style={{ color: 'var(--hc-lime)' }}>{value.toFixed(2)}</strong></span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--hc-lime)' }}
      />
    </label>
  );
}

function ResultMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#12121e',
      border: '1px solid #2a2a40',
      borderRadius: 10,
      padding: 12,
      minWidth: 0,
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#e8e8f0', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(24, 26, 34, 0.96), rgba(17, 18, 23, 0.96))',
  borderRadius: 20,
  padding: 24,
  border: '1px solid var(--hc-border)',
  boxShadow: 'var(--hc-shadow)',
  minWidth: 0,
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 18,
};

const titleStyle: CSSProperties = {
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  fontSize: 18,
  fontWeight: 700,
  color: '#e8e8f0',
  margin: 0,
};

const pillStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--hc-lime)',
  background: 'rgba(206, 255, 53, 0.08)',
  border: '1px solid rgba(206, 255, 53, 0.24)',
  borderRadius: 999,
  padding: '5px 9px',
  whiteSpace: 'nowrap',
};

const modelBadgeStyle: CSSProperties = {
  fontSize: 12,
  color: '#e8e8f0',
  background: '#12121e',
  border: '1px solid #2a2a40',
  borderRadius: 10,
  padding: '9px 12px',
  whiteSpace: 'nowrap',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const modeRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginBottom: 12,
};

const instrumentalSettingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  marginBottom: 18,
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid #2a2a40',
  background: '#12121e',
};

const templateModeNoticeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 14,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(206, 255, 53, 0.24)',
  background: 'rgba(206, 255, 53, 0.08)',
};

const selectedTemplateStripStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 16,
  padding: 12,
  borderRadius: 12,
  border: '1px solid rgba(206, 255, 53, 0.22)',
  background: 'rgba(206, 255, 53, 0.08)',
};

function templateCoverThumbStyle(coverUrl?: string): CSSProperties {
  return {
    width: 42,
    height: 42,
    borderRadius: 8,
    flexShrink: 0,
    border: '1px solid #2a2a40',
    background: coverUrl
      ? `url(${coverUrl}) center/cover`
      : 'linear-gradient(135deg, rgba(206, 255, 53, 0.42), rgba(82, 214, 198, 0.28))',
  };
}

const hintBoxStyle: CSSProperties = {
  marginTop: 16,
  background: '#12121e',
  border: '1px solid #2a2a40',
  borderRadius: 12,
  padding: 16,
};

const hintTextStyle: CSSProperties = {
  color: '#9ca3af',
  fontSize: 12,
  lineHeight: 1.7,
  margin: '6px 0 0 0',
};

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 160px',
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 14,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: '#9ca3af',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const requiredLabelStyle: CSSProperties = {
  ...labelStyle,
  color: '#f87171',
};

const fieldHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const countTextStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  whiteSpace: 'nowrap',
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 10,
  border: '1px solid #2a2a40',
  background: '#12121e',
  color: '#e8e8f0',
  padding: '10px 12px',
  outline: 'none',
  fontSize: 13,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.6,
};

const lockedStyleCardStyle: CSSProperties = {
  marginBottom: 14,
  borderRadius: 12,
  border: '1px solid #2a2a40',
  background: '#12121e',
  padding: 12,
};

const lockedStyleTextStyle: CSSProperties = {
  maxHeight: 96,
  overflowY: 'auto',
  color: '#d8d9e6',
  fontSize: 12,
  lineHeight: 1.65,
  wordBreak: 'break-word',
  paddingRight: 4,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const lyricTagPanelStyle: CSSProperties = {
  margin: '16px 0',
  background: 'rgba(18, 18, 30, 0.82)',
  border: '1px solid rgba(206, 255, 53, 0.18)',
  borderRadius: 12,
  padding: 14,
};

const lyricTagHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
};

const lyricTagHintStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: 11,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const lyricTagGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const lyricTagButtonStyle: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 7,
  border: '1px solid rgba(206, 255, 53, 0.24)',
  background: 'rgba(206, 255, 53, 0.08)',
  color: '#e8e8f0',
  fontSize: 12,
  fontFamily: 'monospace',
  transition: 'all 0.15s ease',
};

const sliderGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};

const estimateCardStyle: CSSProperties = {
  marginTop: 4,
  marginBottom: 4,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.11)',
  background: 'rgba(7, 9, 13, 0.64)',
  padding: 16,
};

const estimateTitleStyle: CSSProperties = {
  color: '#e8e8f0',
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 14,
};

const estimateGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
};

const estimateLabelStyle: CSSProperties = {
  display: 'block',
  color: '#8f96a3',
  fontSize: 11,
  marginBottom: 7,
};

const estimateValueStyle: CSSProperties = {
  display: 'block',
  color: '#dfe5ea',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.35,
};

const errorStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  background: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.22)',
  color: '#ef4444',
  fontSize: 13,
  lineHeight: 1.5,
};

const lyricsBoxStyle: CSSProperties = {
  marginTop: 16,
  background: '#12121e',
  border: '1px solid #2a2a40',
  borderRadius: 12,
  padding: 14,
};

const lyricsHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
};

const copyLyricsButtonStyle: CSSProperties = {
  border: '1px solid rgba(206, 255, 53, 0.34)',
  background: 'rgba(206, 255, 53, 0.1)',
  color: 'var(--hc-lime)',
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const copyToastStyle: CSSProperties = {
  marginBottom: 10,
  borderRadius: 10,
  background: 'rgba(34, 197, 94, 0.1)',
  border: '1px solid rgba(34, 197, 94, 0.25)',
  color: '#86efac',
  fontSize: 12,
  padding: '8px 10px',
  lineHeight: 1.5,
};

const lyricsScrollStyle: CSSProperties = {
  maxHeight: 360,
  overflowY: 'auto',
  paddingRight: 4,
};

const lyricsTextStyle: CSSProperties = {
  margin: 0,
  color: '#cfd0dc',
  fontSize: 13,
  lineHeight: 1.8,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const lyricLineStyle: CSSProperties = {
  borderRadius: 8,
  padding: '4px 8px',
  marginTop: 3,
  wordBreak: 'break-word',
};

const lyricSectionStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  color: '#f4eaff',
  background: 'rgba(206, 255, 53, 0.14)',
  border: '1px solid rgba(206, 255, 53, 0.28)',
  fontWeight: 800,
};

const lyricContentStyle: CSSProperties = {
  color: '#d8d9e6',
  background: 'rgba(192, 167, 252, 0.055)',
  borderLeft: '2px solid rgba(206, 255, 53, 0.48)',
};

const creationLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '9px 16px',
  borderRadius: 999,
  border: '1px solid rgba(206, 255, 53, 0.42)',
  color: 'var(--hc-lime)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const progressBarTrackStyle: CSSProperties = {
  width: '100%',
  height: 8,
  marginTop: 10,
  borderRadius: 999,
  background: '#2a2a40',
  overflow: 'hidden',
};

const progressBarFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--hc-lime), var(--hc-cyan))',
  transition: 'width 0.8s ease',
  boxShadow: '0 0 14px rgba(206, 255, 53, 0.3)',
};

const statusPanelStyle: CSSProperties = {
  ...panelStyle,
  position: 'fixed',
  left: '50%',
  top: '50%',
  zIndex: 10020,
  width: 'min(560px, calc(100vw - 40px))',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: 24,
  borderColor: 'rgba(206, 255, 53, 0.24)',
  background: 'linear-gradient(180deg, rgba(20, 24, 31, 0.98), rgba(9, 11, 16, 0.98))',
  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72), 0 28px 90px rgba(0, 0, 0, 0.62), 0 0 42px rgba(206, 255, 53, 0.08)',
};

const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid #2a2a40',
  borderTopColor: 'var(--hc-lime)',
  borderRadius: '50%',
  animation: 'advancedArrangementSpin 0.9s linear infinite',
  flexShrink: 0,
};

const trackRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 12,
  background: '#12121e',
  border: '1px solid #2a2a40',
  borderRadius: 10,
  padding: 12,
};

const trackAudioRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const stemActionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
};

const stemActionButtonStyle: CSSProperties = {
  minHeight: 32,
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid rgba(206, 255, 53, 0.34)',
  background: 'rgba(206, 255, 53, 0.1)',
  color: 'var(--hc-lime)',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const stemEditLinkStyle: CSSProperties = {
  ...stemActionButtonStyle,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
  textDecoration: 'none',
};
