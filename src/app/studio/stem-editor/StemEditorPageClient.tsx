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

const TEXT = {
  emptyResult: '\u5206\u8f68\u7ed3\u679c\u4e3a\u7a7a\uff0c\u8bf7\u91cd\u65b0\u8bf7\u6c42 API \u5206\u6790\u3002',
  loadStemFailed: '\u52a0\u8f7d\u5206\u8f68\u5931\u8d25',
  missingTaskId: '\u7f3a\u5c11\u6b4c\u66f2\u4efb\u52a1 ID\uff0c\u65e0\u6cd5\u52a0\u8f7d\u7f16\u8f91\u9879\u76ee\u3002',
  createJobFailed: '\u521b\u5efa\u5206\u8f68\u4efb\u52a1\u5931\u8d25',
  loadEditorFailed: '\u52a0\u8f7d\u7f16\u8f91\u9879\u76ee\u5931\u8d25',
  refreshFailed: '\u5237\u65b0\u5206\u8f68\u5931\u8d25',
  backToStudio: '\u8fd4\u56de\u521b\u4f5c\u4e2d\u5fc3',
  songEditor: '\u6b4c\u66f2\u7f16\u8f91',
  stemSaved: '\u5206\u8f68\u5df2\u4fdd\u5b58',
  stemCached: '\u5206\u8f68\u5df2\u7f13\u5b58',
  editSaved: '\u7f16\u8f91\u72b6\u6001\u5df2\u4fdd\u5b58',
  loaded: '\u5df2\u52a0\u8f7d',
  tracksFrom: '\u6761\u5206\u8f68\uff0c\u6765\u6e90\uff1a',
  rereadCache: '\u91cd\u65b0\u8bfb\u53d6\u7f13\u5b58',
  retryApi: '\u91cd\u65b0\u8bf7\u6c42 API \u5206\u6790',
  editorProject: '\u7f16\u8f91\u9879\u76ee',
  noCache: '\u6ca1\u6709\u53ef\u7528\u7684\u5206\u8f68\u7f13\u5b58\u3002\u786e\u8ba4 KIE \u4f59\u989d\u5145\u8db3\u540e\uff0c\u53ef\u4ee5\u624b\u52a8\u91cd\u65b0\u8bf7\u6c42 API \u5206\u6790\u3002',
  checkingCache: '\u68c0\u67e5\u7f13\u5b58',
  readingStemFiles: '\u8bfb\u53d6\u5206\u8f68\u6587\u4ef6',
  startingApi: '\u542f\u52a8 API \u5206\u6790',
  waitingApi: '\u7b49\u5f85 API \u8fd4\u56de',
  writingCache: '\u5199\u5165\u7f13\u5b58',
  stemLoaded: '\u5206\u8f68\u5df2\u52a0\u8f7d',
  stemNotStarted: '\u5206\u8f68\u6ca1\u6709\u6210\u529f\u542f\u52a8',
  checkingCacheNow: '\u6b63\u5728\u68c0\u67e5\u7f13\u5b58',
  readingCacheNow: '\u6b63\u5728\u8bfb\u53d6\u7f13\u5b58',
  startingApiNow: '\u6b63\u5728\u542f\u52a8 API \u5206\u6790',
  apiAnalyzing: 'API \u5206\u6790\u4e2d',
  writingCacheNow: '\u6b63\u5728\u5199\u5165\u7f13\u5b58',
  preparingEditor: '\u51c6\u5907\u6b4c\u66f2\u7f16\u8f91',
  findingSavedStems: '\u6b63\u5728\u67e5\u627e\u5df2\u4fdd\u5b58\u7684\u5206\u8f68',
  readingCachedStems: '\u6b63\u5728\u8bfb\u53d6\u7f13\u5b58\u5206\u8f68',
  submittingKie: '\u6b63\u5728\u63d0\u4ea4 KIE \u5206\u8f68\u8bf7\u6c42',
  kieAnalyzing: 'KIE \u6b63\u5728\u5206\u6790\u97f3\u9891',
  savingAnalysis: '\u6b63\u5728\u4fdd\u5b58\u5206\u6790\u7ed3\u679c',
  cacheHit: '\u7f13\u5b58\u5df2\u547d\u4e2d',
  loadFailed: '\u5206\u8f68\u52a0\u8f7d\u5931\u8d25',
  checkingCacheDesc: '\u4f18\u5148\u8bfb\u53d6 Supabase \u4e2d\u5df2\u4fdd\u5b58\u7684\u5206\u8f68\u7ed3\u679c\uff0c\u4e0d\u4f1a\u5148\u6d88\u8017 API \u989d\u5ea6\u3002',
  readingCacheDesc: '\u6b63\u5728\u4ece\u5df2\u4fdd\u5b58\u8bb0\u5f55\u8bfb\u53d6\u5206\u8f68\u6587\u4ef6\uff1b\u5982\u679c\u7f13\u5b58\u7f3a\u5931\uff0c\u4f1a\u5c1d\u8bd5\u7528 KIE \u4efb\u52a1\u53f7\u8865\u8bfb\u4e00\u6b21\u3002',
  startingApiDesc: '\u6ca1\u6709\u53ef\u7528\u7f13\u5b58\u6216\u4f60\u624b\u52a8\u9009\u62e9\u91cd\u8bd5\uff0c\u6b63\u5728\u8bf7\u6c42 KIE \u91cd\u65b0\u5206\u6790\u3002',
  apiProcessingDesc: 'API \u5df2\u63a5\u6536\u4efb\u52a1\uff0c\u6b63\u5728\u7b49\u5f85\u5206\u8f68\u5b8c\u6210\uff1b\u5b8c\u6210\u540e\u4f1a\u81ea\u52a8\u5199\u5165\u7f13\u5b58\u3002',
  hydratingCacheDesc: '\u5df2\u62ff\u5230\u5206\u8f68\u7ed3\u679c\uff0c\u6b63\u5728\u6574\u7406\u5e76\u8fdb\u5165\u6ce2\u5f62\u7f16\u8f91\u5668\u3002',
  cacheReadyDesc: '\u5df2\u4ece\u7f13\u5b58\u8bfb\u53d6\u5206\u8f68\uff0c\u4e0d\u4f1a\u4ea7\u751f\u65b0\u7684 KIE \u6d88\u8017\u3002',
  failedDesc: '\u5206\u8f68\u6ca1\u6709\u6210\u529f\u542f\u52a8\uff0c\u8bf7\u67e5\u770b\u9519\u8bef\u63d0\u793a\u540e\u91cd\u8bd5\u3002',
  cache: '\u7f13\u5b58',
  apiHydratedCache: 'API \u8865\u8bfb\u540e\u7f13\u5b58',
  apiRefilled: 'API \u56de\u586b',
  apiStateless: 'API \u4e34\u65f6\u7ed3\u679c',
  savedResult: '\u5df2\u4fdd\u5b58\u7ed3\u679c',
};

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
      setError(null);
      setPhase(data.analysisSource === 'cache' ? 'cache-ready' : 'hydrating-cache');
      return;
    }

    if (data.status === 'completed' && stems.length === 0) {
      setError(data.errorMessage || TEXT.emptyResult);
      setPhase('failed');
      return;
    }

    if (data.status === 'queued' || data.status === 'processing') {
      setError(null);
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
      throw new Error(data.error || TEXT.loadStemFailed);
    }

    applyJobData(data);
  }, [applyJobData]);

  const createJob = useCallback(async (force = false) => {
    if (!generationTaskId) {
      setError(TEXT.missingTaskId);
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
        setError(data.error || data.errorMessage || TEXT.createJobFailed);
        return;
      }
      throw new Error(data.error || TEXT.createJobFailed);
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
        setError(err instanceof Error ? err.message : TEXT.loadEditorFailed);
        setPhase('failed');
      }
    })();
  }, [createJob, initialJobId, refreshJob]);

  useEffect(() => {
    if (!job?.jobId || (job.status !== 'queued' && job.status !== 'processing')) return;

    const timer = window.setInterval(() => {
      void refreshJob(job.jobId).catch((err) => {
        setError(err instanceof Error ? err.message : TEXT.refreshFailed);
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
        <Link href="/studio" style={backLinkStyle}>{TEXT.backToStudio}</Link>
        <div>
          <div style={eyebrowStyle}>HookCraft</div>
          <h1 style={headingStyle}>{TEXT.songEditor}</h1>
        </div>
      </header>

      <section style={stageStyle}>
        <div style={statusHeaderStyle}>
          <div>
            <div style={statusTitleRowStyle}>
              <span style={statusTitleStyle}>{formatEditorStatus(job?.status, phase)}</span>
              {hasLoadedStems && (
                <span style={cacheBadgeStyle}>
                  {job.analysisSource === 'cache' ? TEXT.stemSaved : TEXT.stemCached}
                </span>
              )}
              {job?.editState && (
                <span style={editBadgeStyle}>{TEXT.editSaved}</span>
              )}
            </div>
            <div style={statusTextStyle}>
              {hasLoadedStems
                ? `${TEXT.loaded} ${job.stems.length} ${TEXT.tracksFrom}${formatAnalysisSource(job.analysisSource)}`
                : formatPhaseDescription(phase)}
            </div>
          </div>
          <div style={actionGroupStyle}>
            {job?.jobId && job.status === 'completed' && (
              <button type="button" onClick={() => void refreshJob(job.jobId)} style={refreshButtonStyle}>
                {TEXT.rereadCache}
              </button>
            )}
            {(job?.status === 'failed' || error) && generationTaskId && (
              <button type="button" onClick={() => void createJob(true)} style={refreshButtonStyle}>
                {TEXT.retryApi}
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
            versionLabel={TEXT.editorProject}
            jobId={job.jobId}
            initialEditState={job.editState || null}
          />
        ) : job?.status === 'failed' || error ? (
          <div style={emptyStateStyle}>
            {TEXT.noCache}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function AnalysisLoadingPanel({ phase }: { phase: LoadingPhase }) {
  const steps = [
    { id: 'checking-cache', label: TEXT.checkingCache },
    { id: 'reading-cache', label: TEXT.readingStemFiles },
    { id: 'starting-api', label: TEXT.startingApi },
    { id: 'api-processing', label: TEXT.waitingApi },
    { id: 'hydrating-cache', label: TEXT.writingCache },
  ];
  const activeIndex = steps.findIndex((step) => step.id === phase);

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
              style={stepPillStyle(activeIndex > -1 && index < activeIndex, index === activeIndex)}
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
  if (status === 'completed') return TEXT.stemLoaded;
  if (status === 'failed') return TEXT.stemNotStarted;
  if (phase === 'checking-cache') return TEXT.checkingCacheNow;
  if (phase === 'reading-cache') return TEXT.readingCacheNow;
  if (phase === 'starting-api') return TEXT.startingApiNow;
  if (phase === 'api-processing') return TEXT.apiAnalyzing;
  if (phase === 'hydrating-cache') return TEXT.writingCacheNow;
  return TEXT.preparingEditor;
}

function formatPhaseTitle(phase: LoadingPhase) {
  if (phase === 'checking-cache') return TEXT.findingSavedStems;
  if (phase === 'reading-cache') return TEXT.readingCachedStems;
  if (phase === 'starting-api') return TEXT.submittingKie;
  if (phase === 'api-processing') return TEXT.kieAnalyzing;
  if (phase === 'hydrating-cache') return TEXT.savingAnalysis;
  if (phase === 'cache-ready') return TEXT.cacheHit;
  return TEXT.loadFailed;
}

function formatPhaseDescription(phase: LoadingPhase) {
  if (phase === 'checking-cache') return TEXT.checkingCacheDesc;
  if (phase === 'reading-cache') return TEXT.readingCacheDesc;
  if (phase === 'starting-api') return TEXT.startingApiDesc;
  if (phase === 'api-processing') return TEXT.apiProcessingDesc;
  if (phase === 'hydrating-cache') return TEXT.hydratingCacheDesc;
  if (phase === 'cache-ready') return TEXT.cacheReadyDesc;
  return TEXT.failedDesc;
}

function formatAnalysisSource(source?: string | null) {
  if (source === 'cache') return TEXT.cache;
  if (source === 'api-hydrated-cache') return TEXT.apiHydratedCache;
  if (source === 'api-refreshed') return TEXT.apiRefilled;
  if (source === 'api-stateless') return TEXT.apiStateless;
  return TEXT.savedResult;
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
