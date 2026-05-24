'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import StemMixerEditor, {
  type EditableStem,
  type StemEditState,
} from '@/components/studio/StemMixerEditor';

type StemEditorStatus = 'creating' | 'queued' | 'processing' | 'completed' | 'failed';
type LoadingPhase =
  | 'checking-cache'
  | 'reading-cache'
  | 'cache-ready'
  | 'starting-api'
  | 'api-processing'
  | 'hydrating-cache'
  | 'failed';

interface StemEditorJob {
  jobId: string;
  status: StemEditorStatus;
  stems: EditableStem[];
  errorMessage?: string | null;
  analysisSource?: string | null;
  reused?: boolean;
  editState?: StemEditState | null;
}

export default function StemEditorPageClient() {
  const searchParams = useSearchParams();
  const generationTaskId = searchParams.get('generationTaskId')?.trim() || '';
  const initialJobId = searchParams.get('jobId')?.trim() || '';
  const requestedRef = useRef(false);
  const [job, setJob] = useState<StemEditorJob | null>(null);
  const [phase, setPhase] = useState<LoadingPhase>('checking-cache');
  const [error, setError] = useState<string | null>(null);

  const applyJobData = useCallback((data: any) => {
    const stems = Array.isArray(data.stems) ? data.stems : [];
    setJob({
      jobId: data.jobId,
      status: data.status,
      stems,
      errorMessage: data.errorMessage || null,
      analysisSource: data.analysisSource || null,
      reused: data.reused === true,
      editState: data.editState || null,
    });

    if (data.status === 'completed' && stems.length > 0) {
      setPhase(data.analysisSource === 'cache' ? 'cache-ready' : 'hydrating-cache');
      return;
    }

    if (data.status === 'queued' || data.status === 'processing') {
      setPhase(data.analysisSource === 'cache' || data.analysisSource === 'existing-job'
        ? 'reading-cache'
        : 'api-processing');
      return;
    }

    if (data.status === 'failed') {
      setPhase('failed');
    }
  }, []);

  const refreshJob = useCallback(async (jobId: string) => {
    setPhase((current) => current === 'api-processing' ? 'api-processing' : 'reading-cache');
    const res = await fetch(`/api/stems/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '加载分轨失败');
    }

    applyJobData(data);
  }, [applyJobData]);

  const createJob = useCallback(async (force = false) => {
    if (!generationTaskId) {
      setError('缺少歌曲任务 ID，无法加载编辑项目。');
      setPhase('failed');
      return;
    }

    setError(null);
    setPhase(force ? 'starting-api' : 'checking-cache');
    setJob({
      jobId: '',
      status: 'creating',
      stems: [],
    });

    const res = await fetch('/api/stems/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generationTaskId, force }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.jobId) {
        applyJobData({
          ...data,
          status: data.status || 'failed',
          stems: [],
          errorMessage: data.errorMessage || data.error || null,
        });
        setError(data.error || data.errorMessage || '创建分轨任务失败');
        return;
      }
      throw new Error(data.error || '创建分轨任务失败');
    }

    applyJobData({
      ...data,
      stems: [],
    });

    if (data.status !== 'failed') {
      await refreshJob(data.jobId);
    }
  }, [applyJobData, generationTaskId, refreshJob]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    void (async () => {
      try {
        if (initialJobId) {
          await refreshJob(initialJobId);
          return;
        }
        await createJob();
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载编辑项目失败');
        setPhase('failed');
      }
    })();
  }, [createJob, initialJobId, refreshJob]);

  useEffect(() => {
    if (!job?.jobId || (job.status !== 'queued' && job.status !== 'processing')) return;

    const timer = window.setInterval(() => {
      void refreshJob(job.jobId).catch((err) => {
        setError(err instanceof Error ? err.message : '刷新分轨失败');
        setPhase('failed');
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [job, refreshJob]);

  const hasLoadedStems = job?.status === 'completed' && job.stems.length > 0;

  return (
    <main style={pageStyle}>
      <style>{`
        @keyframes stem-analyze-wave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.45; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes stem-analyze-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
      <header style={headerStyle}>
        <Link href="/studio" style={backLinkStyle}>返回创作中心</Link>
        <div>
          <div style={eyebrowStyle}>HookCraft</div>
          <h1 style={headingStyle}>歌曲编辑</h1>
        </div>
      </header>

      <section style={stageStyle}>
        <div style={statusHeaderStyle}>
          <div>
            <div style={statusTitleRowStyle}>
              <span style={statusTitleStyle}>{formatEditorStatus(job?.status, phase)}</span>
              {hasLoadedStems && (
                <span style={cacheBadgeStyle}>
                  {job.analysisSource === 'cache' ? '分轨已保存' : '分轨已缓存'}
                </span>
              )}
              {job?.editState && (
                <span style={editBadgeStyle}>编辑状态已保存</span>
              )}
            </div>
            <div style={statusTextStyle}>
              {hasLoadedStems
                ? `已加载 ${job.stems.length} 条分轨，来源：${formatAnalysisSource(job.analysisSource)}`
                : formatPhaseDescription(phase)}
            </div>
          </div>
          <div style={actionGroupStyle}>
            {job?.jobId && job.status === 'completed' && (
              <button type="button" onClick={() => void refreshJob(job.jobId)} style={refreshButtonStyle}>
                重新读取缓存
              </button>
            )}
            {(job?.status === 'failed' || error) && generationTaskId && (
              <button type="button" onClick={() => void createJob(true)} style={refreshButtonStyle}>
                重新请求 API 分析
              </button>
            )}
          </div>
        </div>

        {!hasLoadedStems && <AnalysisLoadingPanel phase={phase} />}

        {error && <div style={errorStyle}>{error}</div>}
        {job?.errorMessage && <div style={errorStyle}>{job.errorMessage}</div>}

        {hasLoadedStems ? (
          <StemMixerEditor
            stems={job.stems}
            versionLabel="编辑项目"
            jobId={job.jobId}
            initialEditState={job.editState || null}
          />
        ) : job?.status === 'failed' || error ? (
          <div style={emptyStateStyle}>
            没有可用的分轨缓存。确认 KIE 余额充足后，可以手动重新请求 API 分析。
          </div>
        ) : null}
      </section>
    </main>
  );
}

function AnalysisLoadingPanel({ phase }: { phase: LoadingPhase }) {
  const steps = [
    { id: 'checking-cache', label: '检查缓存' },
    { id: 'reading-cache', label: '读取分轨文件' },
    { id: 'starting-api', label: '启动 API 分析' },
    { id: 'api-processing', label: '等待 API 返回' },
    { id: 'hydrating-cache', label: '写入缓存' },
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === phase));

  return (
    <div style={loadingPanelStyle}>
      <div style={waveLoaderStyle}>
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} style={waveBarStyle(index)} />
        ))}
        <span style={waveSweepStyle} />
      </div>
      <div style={loadingContentStyle}>
        <div style={loadingTitleStyle}>{formatPhaseTitle(phase)}</div>
        <div style={loadingTextStyle}>{formatPhaseDescription(phase)}</div>
        <div style={stepListStyle}>
          {steps.map((step, index) => (
            <div
              key={step.id}
              style={stepPillStyle(index < activeIndex, index === activeIndex)}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatEditorStatus(status?: StemEditorStatus, phase?: LoadingPhase) {
  if (status === 'completed') return '分轨已加载';
  if (status === 'failed') return '分轨没有成功启动';
  if (phase === 'checking-cache') return '正在检查缓存';
  if (phase === 'reading-cache') return '正在读取缓存';
  if (phase === 'starting-api') return '正在启动 API 分析';
  if (phase === 'api-processing') return 'API 分析中';
  if (phase === 'hydrating-cache') return '正在写入缓存';
  return '准备歌曲编辑';
}

function formatPhaseTitle(phase: LoadingPhase) {
  if (phase === 'checking-cache') return '正在查找已保存的分轨';
  if (phase === 'reading-cache') return '正在读取缓存分轨';
  if (phase === 'starting-api') return '正在提交 KIE 分轨请求';
  if (phase === 'api-processing') return 'KIE 正在分析音频';
  if (phase === 'hydrating-cache') return '正在保存分析结果';
  if (phase === 'cache-ready') return '缓存已命中';
  return '分轨加载失败';
}

function formatPhaseDescription(phase: LoadingPhase) {
  if (phase === 'checking-cache') return '优先读取 Supabase 中已保存的分轨结果，不会先消耗 API 额度。';
  if (phase === 'reading-cache') return '正在从已保存记录读取分轨文件；如果缓存缺失，会尝试用 KIE 任务号补读一次。';
  if (phase === 'starting-api') return '没有可用缓存或你手动选择重试，正在请求 KIE 重新分析。';
  if (phase === 'api-processing') return 'API 已接收任务，正在等待分轨完成；完成后会自动写入缓存。';
  if (phase === 'hydrating-cache') return '已拿到分轨结果，正在整理并进入波形编辑器。';
  if (phase === 'cache-ready') return '已从缓存读取分轨，不会产生新的 KIE 消耗。';
  return '分轨没有成功启动，请查看错误提示后重试。';
}

function formatAnalysisSource(source?: string | null) {
  if (source === 'cache') return '缓存';
  if (source === 'api-hydrated-cache') return 'API 补读后缓存';
  if (source === 'api-refreshed') return 'API 回填';
  if (source === 'api-stateless') return 'API 临时结果';
  return '已保存结果';
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#090a14',
  color: '#f4f4fb',
  padding: '36px clamp(16px, 4vw, 56px)',
};

const headerStyle: CSSProperties = {
  maxWidth: 1240,
  margin: '0 auto 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
};

const backLinkStyle: CSSProperties = {
  width: 'fit-content',
  color: '#c0a7fc',
  textDecoration: 'none',
  border: '1px solid rgba(117, 54, 213, 0.32)',
  borderRadius: 8,
  background: 'rgba(117, 54, 213, 0.12)',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
};

const eyebrowStyle: CSSProperties = {
  color: '#8389a5',
  fontSize: 12,
  fontWeight: 800,
};

const headingStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 32,
  fontWeight: 900,
};

const stageStyle: CSSProperties = {
  maxWidth: 1240,
  margin: '0 auto',
  borderRadius: 16,
  border: '1px solid rgba(117, 54, 213, 0.24)',
  background: 'linear-gradient(180deg, rgba(26, 28, 48, 0.98), rgba(15, 17, 31, 0.98))',
  padding: 'clamp(16px, 2.4vw, 28px)',
};

const statusHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
};

const statusTitleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

const statusTitleStyle: CSSProperties = {
  color: '#f0f1fb',
  fontSize: 18,
  fontWeight: 900,
};

const cacheBadgeStyle: CSSProperties = {
  border: '1px solid rgba(34, 197, 94, 0.36)',
  borderRadius: 999,
  background: 'rgba(34, 197, 94, 0.12)',
  color: '#86efac',
  padding: '4px 9px',
  fontSize: 12,
  fontWeight: 900,
};

const editBadgeStyle: CSSProperties = {
  border: '1px solid rgba(59, 130, 246, 0.36)',
  borderRadius: 999,
  background: 'rgba(59, 130, 246, 0.12)',
  color: '#93c5fd',
  padding: '4px 9px',
  fontSize: 12,
  fontWeight: 900,
};

const statusTextStyle: CSSProperties = {
  color: '#9ca3af',
  fontSize: 13,
  marginTop: 6,
};

const actionGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

const refreshButtonStyle: CSSProperties = {
  minHeight: 36,
  border: '1px solid rgba(117, 54, 213, 0.42)',
  borderRadius: 8,
  background: 'rgba(117, 54, 213, 0.16)',
  color: '#e0d0ff',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  marginTop: 14,
  border: '1px solid rgba(248, 113, 113, 0.32)',
  borderRadius: 10,
  background: 'rgba(239, 68, 68, 0.1)',
  color: '#fca5a5',
  padding: '10px 12px',
  fontSize: 13,
};

const loadingPanelStyle: CSSProperties = {
  marginTop: 20,
  minHeight: 230,
  borderRadius: 14,
  border: '1px solid rgba(48, 52, 76, 0.9)',
  background: '#101321',
  display: 'grid',
  gridTemplateColumns: '96px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 20,
  padding: 22,
  overflow: 'hidden',
};

const waveLoaderStyle: CSSProperties = {
  position: 'relative',
  width: 86,
  height: 76,
  borderRadius: 12,
  border: '1px solid rgba(48, 52, 76, 0.9)',
  background: 'rgba(11, 14, 28, 0.86)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  overflow: 'hidden',
};

function waveBarStyle(index: number): CSSProperties {
  return {
    width: 5,
    height: 46,
    borderRadius: 999,
    background: index % 2 === 0 ? '#8b5cf6' : '#38bdf8',
    transformOrigin: 'center',
    animation: `stem-analyze-wave ${0.86 + index * 0.05}s ease-in-out ${index * 0.06}s infinite`,
  };
}

const waveSweepStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: 34,
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)',
  animation: 'stem-analyze-sweep 1.6s ease-in-out infinite',
};

const loadingContentStyle: CSSProperties = {
  minWidth: 0,
};

const loadingTitleStyle: CSSProperties = {
  color: '#f4f4fb',
  fontSize: 18,
  fontWeight: 900,
};

const loadingTextStyle: CSSProperties = {
  color: '#aeb4c8',
  fontSize: 13,
  lineHeight: 1.7,
  marginTop: 8,
};

const stepListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 16,
};

function stepPillStyle(done: boolean, active: boolean): CSSProperties {
  return {
    borderRadius: 999,
    border: active ? '1px solid rgba(192, 167, 252, 0.7)' : '1px solid rgba(48, 52, 76, 0.9)',
    background: done
      ? 'rgba(34, 197, 94, 0.14)'
      : active
        ? 'rgba(117, 54, 213, 0.22)'
        : 'rgba(20, 23, 39, 0.9)',
    color: done ? '#86efac' : active ? '#e0d0ff' : '#858ca5',
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 800,
  };
}

const emptyStateStyle: CSSProperties = {
  marginTop: 20,
  minHeight: 180,
  borderRadius: 12,
  border: '1px dashed #30344c',
  background: '#101321',
  color: '#aeb4c8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  textAlign: 'center',
};
