'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMembershipStore } from '@/store/membershipStore';
import {
  DEFAULT_STEM_EDITOR_FEATURE_SETTINGS,
  normalizeStemEditorFeatureSettings,
  resolveEditorAccessTier,
  type StemEditorFeatureSettings,
  type StemSeparationMode,
} from '@/config/stemEditorFeatures';
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
  separationMode?: StemSeparationMode | null;
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
  authExpired: '\u767b\u5f55\u5df2\u8fc7\u671f\uff0c\u6b63\u5728\u8df3\u8f6c\u767b\u5f55\u9875\u3002',
  chooseMode: '\u9009\u62e9\u6b4c\u66f2\u7f16\u8f91\u6a21\u5f0f',
  basicEditor: '\u57fa\u7840\u7f16\u8f91',
  proEditor: '\u4e13\u4e1a\u7f16\u8f91',
  basicEditorDesc: '2 \u8f68\uff1a\u4eba\u58f0 + \u4f34\u594f\uff0c\u652f\u6301\u5b8c\u6574\u7247\u6bb5\u7f16\u8f91\uff0c\u5bfc\u51fa MP3\u3002',
  proEditorDesc: '12 \u7c7b\u4e13\u4e1a\u5206\u8f68\u7ed3\u679c\uff0c\u89e3\u9501 WAV \u548c\u9ad8\u7ea7\u5236\u4f5c\u529f\u80fd\u3002',
  startBasic: '\u5f00\u59cb\u57fa\u7840\u7f16\u8f91',
  startPro: '\u5f00\u59cb\u4e13\u4e1a\u7f16\u8f91',
  proLocked: '\u5347\u7ea7 Pro \u89e3\u9501',
  freeLocked: '\u8bf7\u5347\u7ea7\u4f1a\u5458\u540e\u4f7f\u7528\u6b4c\u66f2\u7f16\u8f91',
};

function isAuthRequiredResponse(status: number, data: any) {
  const message = String(data?.error || data?.errorMessage || '').toLowerCase();
  return status === 401 || message.includes('sign in first') || message.includes('please sign in');
}

export default function StemEditorPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const membership = useMembershipStore((s) => s.membership);
  const fetchMembership = useMembershipStore((s) => s.fetchMembership);
  const generationTaskId = searchParams.get('generationTaskId')?.trim() || '';
  const initialJobId = searchParams.get('jobId')?.trim() || '';
  const initialSeparationMode = normalizeSeparationMode(searchParams.get('separationMode'));
  const requestedRef = useRef(false);
  const [job, setJob] = useState<StemEditorJob | null>(null);
  const [phase, setPhase] = useState<LoadingPhase>('checking-cache');
  const [error, setError] = useState<string | null>(null);
  const [featureSettings, setFeatureSettings] = useState<StemEditorFeatureSettings>(DEFAULT_STEM_EDITOR_FEATURE_SETTINGS);
  const [selectedSeparationMode, setSelectedSeparationMode] = useState<StemSeparationMode | null>(
    initialSeparationMode,
  );

  const accessTier = resolveEditorAccessTier(membership?.tier || 'free');
  const activeFeatureSettings = accessTier === 'pro'
    ? featureSettings.pro
    : featureSettings.plus;
  const canForceRefresh = activeFeatureSettings.modes.allowForceRefresh;

  const redirectToLogin = useCallback(() => {
    setError(TEXT.authExpired);
    setPhase('failed');

    const currentPath = typeof window === 'undefined'
      ? '/studio/stem-editor'
      : `${window.location.pathname}${window.location.search}`;
    router.replace(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
  }, [router]);

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
      separationMode: normalizeSeparationMode(data.separationMode),
    });
    const nextMode = normalizeSeparationMode(data.separationMode);
    if (nextMode) setSelectedSeparationMode(nextMode);

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
      if (isAuthRequiredResponse(res.status, data)) {
        redirectToLogin();
        return;
      }
      throw new Error(data.error || TEXT.loadStemFailed);
    }

    applyJobData(data);
  }, [applyJobData, redirectToLogin]);

  const createJob = useCallback(async (force = false) => {
    if (!generationTaskId) {
      setError(TEXT.missingTaskId);
      setPhase('failed');
      return;
    }
    if (!selectedSeparationMode) {
      setPhase('checking-cache');
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
      body: JSON.stringify({ generationTaskId, force, separationMode: selectedSeparationMode }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (isAuthRequiredResponse(res.status, data)) {
        redirectToLogin();
        return;
      }
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
  }, [applyJobData, generationTaskId, redirectToLogin, refreshJob, selectedSeparationMode]);

  useEffect(() => {
    void fetchMembership();
    void fetch('/api/studio/settings', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setFeatureSettings(normalizeStemEditorFeatureSettings(data?.stemEditorFeatures));
      })
      .catch(() => {
        setFeatureSettings(DEFAULT_STEM_EDITOR_FEATURE_SETTINGS);
      });
  }, [fetchMembership]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    void (async () => {
      try {
        if (initialJobId) {
          await refreshJob(initialJobId);
          return;
        }
        if (!selectedSeparationMode) return;
        await createJob();
      } catch (err) {
        setError(err instanceof Error ? err.message : TEXT.loadEditorFailed);
        setPhase('failed');
      }
    })();
  }, [createJob, initialJobId, refreshJob, selectedSeparationMode]);

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
    <main className="stem-editor-page" style={pageStyle(hasLoadedStems)}>
      <style>{`
        @keyframes stem-analyze-wave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.45; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes stem-analyze-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(220%); }
        }
        .stem-editor-page {
          background-image:
            linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.024) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .stem-editor-header,
        .stem-editor-rail,
        .stem-editor-inspector,
        .stem-editor-status,
        .stem-editor-loading,
        .stem-editor-transport {
          backdrop-filter: blur(18px);
        }
        @media (max-width: 860px) {
          .stem-editor-header {
            position: static !important;
            min-height: auto !important;
            align-items: flex-start !important;
            flex-direction: column !important;
            padding: 12px 14px !important;
          }
          .stem-editor-header-primary {
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
          .stem-editor-brand,
          .stem-editor-header-primary a {
            min-width: 128px !important;
            padding-right: 12px !important;
          }
          .stem-editor-facts {
            width: 100% !important;
            flex-wrap: wrap !important;
            overflow: visible !important;
          }
          .stem-editor-rail,
          .stem-editor-page aside {
            display: none !important;
          }
          .stem-editor-stage {
            min-height: auto !important;
            padding: 16px 14px 88px !important;
          }
          .stem-editor-workspace {
            grid-template-columns: 1fr !important;
          }
          .stem-editor-inspector,
          .stem-editor-workspace aside {
            min-height: auto !important;
          }
          .stem-editor-loading {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
          .stem-editor-transport {
            grid-template-columns: 34px 42px 86px minmax(0, 1fr) !important;
          }
          .stem-editor-transport div:first-child {
            display: none !important;
          }
        }
        @media (max-width: 520px) {
          .stem-editor-stage {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
          .stem-editor-transport {
            grid-template-columns: 38px 72px minmax(0, 1fr) !important;
            gap: 7px !important;
            padding: 8px 10px !important;
          }
          .stem-editor-transport div:nth-child(2) {
            display: none !important;
          }
        }
      `}</style>
      {!hasLoadedStems && (
        <header className="stem-editor-header" style={headerStyle}>
          <div className="stem-editor-header-primary" style={headerPrimaryStyle}>
            <Link href="/" aria-label="返回 HookCraft 首页" style={brandStyle}>
              <Image src="/logo-nav.svg" alt="HookCraft" width={140} height={36} priority />
            </Link>
            <div style={projectTitleStyle}>
              <span style={headingStyle}>{TEXT.songEditor}</span>
            </div>
            <div className="stem-editor-facts" style={headerFactsStyle}>
              <span style={headerFactStyle('project')}>{TEXT.editorProject}</span>
              <span style={headerFactStyle(phase === 'failed' ? 'danger' : 'loading')}>{formatEditorStatus(job?.status, phase)}</span>
              {job?.jobId && <span style={headerFactStyle('neutral')}>任务 {job.jobId.slice(0, 8)}</span>}
              <span style={headerFactStyle('neutral')}>{formatAnalysisSource(job?.analysisSource)}</span>
            </div>
          </div>
          <div style={headerActionStyle}>
            <span style={timeBadgeStyle}>{phase === 'failed' ? '需要处理' : '准备中'}</span>
            <Link href="/studio" style={backLinkStyle}>{TEXT.backToStudio}</Link>
          </div>
        </header>
      )}
      {false && !hasLoadedStems && (
        <aside style={sideRailStyle} aria-label="编辑器模块">
          <span style={sideRailButtonStyle(true)}>轨道</span>
          <span style={sideRailButtonStyle(false)}>混音</span>
          <span style={sideRailButtonStyle(false)}>自动化</span>
          <span style={sideRailButtonStyle(false)}>导出</span>
        </aside>
      )}

      <section className="stem-editor-stage" style={stageStyle(hasLoadedStems)}>
        {!hasLoadedStems && (
          <div className="stem-editor-workspace" style={fallbackWorkspaceStyle}>
            <div style={fallbackTimelineColumnStyle}>
              {!selectedSeparationMode && !initialJobId && (
                <ModeSelectionPanel
                  accessTier={accessTier}
                  featureSettings={featureSettings}
                  onSelect={(mode) => {
                    setSelectedSeparationMode(mode);
                    requestedRef.current = false;
                  }}
                />
              )}
              {selectedSeparationMode && (
              <>
              <div className="stem-editor-status" style={statusHeaderStyle}>
                <div>
                  <div style={statusTitleRowStyle}>
                    <span style={statusTitleStyle}>{formatEditorStatus(job?.status, phase)}</span>
                    {job?.editState && (
                      <span style={editBadgeStyle}>{TEXT.editSaved}</span>
                    )}
                  </div>
                  <div style={statusTextStyle}>{formatPhaseDescription(phase)}</div>
                </div>
                <div style={actionGroupStyle}>
                  {job?.jobId && job.status === 'completed' && (
                    <button type="button" onClick={() => void refreshJob(job.jobId)} style={refreshButtonStyle}>
                      {TEXT.rereadCache}
                    </button>
                  )}
                  {(job?.status === 'failed' || error) && generationTaskId && canForceRefresh && (
                    <button type="button" onClick={() => void createJob(true)} style={refreshButtonStyle}>
                      {TEXT.retryApi}
                    </button>
                  )}
                </div>
              </div>

              <AnalysisLoadingPanel phase={phase} />

              {error && <div style={errorStyle}>{error}</div>}
              {job?.errorMessage && <div style={errorStyle}>{job.errorMessage}</div>}

              {(job?.status === 'failed' || error) && (
                <div style={emptyStateStyle}>{TEXT.noCache}</div>
              )}
              </>
              )}
            </div>

            <aside style={fallbackInspectorStyle} aria-label="分轨加载状态">
              <div style={inspectorHeadingStyle}>
                <div>
                  <div style={inspectorEyebrowStyle}>Inspector</div>
                  <div style={inspectorTitleStyle}>分轨准备</div>
                </div>
                <span style={headerFactStyle(phase === 'failed' ? 'danger' : 'loading')}>
                  {phase === 'failed' ? '异常' : '处理中'}
                </span>
              </div>
              <div style={inspectorSegmentStyle}>
                <span style={inspectorSegmentActiveStyle}>轨道</span>
                <span>混音</span>
                <span>导出</span>
              </div>
              <div style={inspectorDetailGridStyle}>
                <span>任务</span>
                <strong>{job?.jobId ? job.jobId.slice(0, 8) : generationTaskId ? generationTaskId.slice(0, 8) : '待创建'}</strong>
                <span>来源</span>
                <strong>{formatAnalysisSource(job?.analysisSource)}</strong>
                <span>状态</span>
                <strong>{formatEditorStatus(job?.status, phase)}</strong>
              </div>
              <div style={inspectorActionGridStyle}>
                <button type="button" style={refreshButtonStyle} onClick={() => generationTaskId && void createJob(false)}>
                  启动分析
                </button>
                <button type="button" style={refreshButtonStyle} onClick={() => job?.jobId && void refreshJob(job.jobId)}>
                  读取结果
                </button>
              </div>
            </aside>
          </div>
        )}

        {!hasLoadedStems && <div className="stem-editor-transport" style={fallbackTransportStyle} aria-hidden="true">
          <div style={transportButtonGhostStyle} />
          <div style={transportButtonGhostStyle} />
          <div style={transportPlayGhostStyle} />
          <div style={transportTimeGhostStyle}>0:00.00</div>
          <div style={transportProgressGhostStyle}><span /></div>
        </div>}

        {hasLoadedStems ? (
          <StemMixerEditor
            stems={job.stems}
            versionLabel={TEXT.editorProject}
            jobId={job.jobId}
            initialEditState={job.editState || null}
            separationMode={job.separationMode || selectedSeparationMode}
            featureSettings={activeFeatureSettings}
          />
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
    <div className="stem-editor-loading" style={loadingPanelStyle}>
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

function pageStyle(loaded: boolean): CSSProperties {
  return {
    minHeight: '100vh',
    background: loaded
      ? '#070a11'
      : 'linear-gradient(180deg, #050914 0%, #070b13 100%)',
    color: '#f4f4fb',
    padding: 0,
    boxSizing: 'border-box',
    overflowX: 'hidden',
  };
}

const headerStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  minHeight: 72,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '9px 18px 9px 22px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'linear-gradient(180deg, rgba(17, 18, 23, 0.96), rgba(7, 9, 14, 0.94))',
  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.34)',
  boxSizing: 'border-box',
};

const headerPrimaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  minWidth: 0,
};

const brandStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 172,
  paddingRight: 20,
  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  textDecoration: 'none',
  flex: '0 0 auto',
};

const projectTitleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
  color: '#f4f4fb',
  whiteSpace: 'nowrap',
};

const headerFactsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
  overflow: 'hidden',
};

function headerFactStyle(tone: 'project' | 'neutral' | 'loading' | 'danger'): CSSProperties {
  const palette = {
    project: { border: 'rgba(206, 255, 53, 0.34)', background: 'rgba(206, 255, 53, 0.1)', color: '#eaff9d' },
    neutral: { border: 'rgba(48, 52, 76, 0.78)', background: 'rgba(15, 18, 32, 0.68)', color: '#aeb2c9' },
    loading: { border: 'rgba(96, 165, 250, 0.38)', background: 'rgba(37, 99, 235, 0.12)', color: '#bfdbfe' },
    danger: { border: 'rgba(248, 113, 113, 0.36)', background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5' },
  }[tone];
  return {
    maxWidth: tone === 'project' ? 170 : 190,
    border: `1px solid ${palette.border}`,
    borderRadius: 999,
    background: palette.background,
    color: palette.color,
    padding: '4px 9px',
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
}

const headerActionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flex: '0 0 auto',
};

const timeBadgeStyle: CSSProperties = {
  color: '#aeb2c9',
  fontSize: 12,
  fontWeight: 800,
};

const backLinkStyle: CSSProperties = {
  color: 'var(--hc-text)',
  textDecoration: 'none',
  border: '1px solid rgba(206, 255, 53, 0.36)',
  borderRadius: 10,
  background: 'rgba(206, 255, 53, 0.1)',
  padding: '9px 13px',
  fontSize: 13,
  fontWeight: 900,
};

const headingStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
};

const sideRailStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 72,
  bottom: 0,
  zIndex: 18,
  width: 0,
  display: 'none',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 8,
  padding: 0,
  boxSizing: 'border-box',
  borderRight: 'none',
  background: 'transparent',
};

function sideRailButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: 54,
    borderRadius: 8,
    border: active ? '1px solid rgba(206, 255, 53, 0.5)' : '1px solid transparent',
    background: active ? 'linear-gradient(180deg, rgba(206, 255, 53, 0.18), rgba(82, 214, 198, 0.1))' : 'transparent',
    color: active ? 'var(--hc-text)' : '#7e849b',
    fontSize: 11,
    fontWeight: 900,
    writingMode: 'vertical-rl',
    letterSpacing: 0,
    display: 'grid',
    placeItems: 'center',
    boxShadow: active ? 'inset 2px 0 0 var(--hc-lime)' : 'none',
  };
}

function stageStyle(loaded: boolean): CSSProperties {
  return {
    width: '100%',
    maxWidth: 'none',
    margin: 0,
    minHeight: loaded ? '100vh' : 'calc(100vh - 72px)',
    paddingTop: loaded ? 0 : 90,
    paddingLeft: loaded ? 0 : 24,
    paddingRight: loaded ? 0 : 24,
    paddingBottom: loaded ? 0 : 40,
    borderRadius: 0,
    border: 'none',
    background: loaded
      ? '#050912'
      : `
        radial-gradient(circle at 50% 18%, rgba(206, 255, 53, 0.12), transparent 26%),
        radial-gradient(circle at 24% 35%, rgba(82, 214, 198, 0.08), transparent 28%),
        linear-gradient(180deg, rgba(10, 14, 28, 0.94), rgba(7, 10, 18, 0.98))
      `,
    boxSizing: 'border-box',
    overflowX: 'hidden',
    display: loaded ? 'block' : 'grid',
    placeItems: loaded ? undefined : 'center',
  };
}

function normalizeSeparationMode(value: unknown): StemSeparationMode | null {
  return value === 'separate_vocal' || value === 'split_stem'
    ? value
    : null;
}

function ModeSelectionPanel({
  accessTier,
  featureSettings,
  onSelect,
}: {
  accessTier: 'free' | 'plus' | 'pro';
  featureSettings: StemEditorFeatureSettings;
  onSelect: (mode: StemSeparationMode) => void;
}) {
  const activeSettings = accessTier === 'pro' ? featureSettings.pro : featureSettings.plus;
  const canUseBasic = accessTier !== 'free'
    && activeSettings.modes.basicEditor
    && activeSettings.stems.separateVocal;
  const canUsePro = accessTier === 'pro'
    && activeSettings.modes.proEditor
    && activeSettings.stems.splitStem;
  const showUpgradePrompt = activeSettings.modes.allowUpgradeFromBasic;
  const showCreditConfirm = activeSettings.modes.showCreditConfirm;
  const tierLabel = accessTier === 'pro' ? 'Pro 完整版' : accessTier === 'plus' ? 'Plus 简版' : '未开通会员';

  return (
    <div style={modePanelStyle}>
      <div style={modeHeaderStyle}>
        <div>
          <div style={modeEyebrowStyle}>选择工作流</div>
          <div style={modeTitleStyle}>{TEXT.chooseMode}</div>
          <p style={modeIntroStyle}>根据当前会员权限进入对应编辑器，系统会优先读取已保存分轨，避免重复分析。</p>
        </div>
        <div style={modeTierBadgeStyle(accessTier)}>
          <span style={modeTierDotStyle(accessTier)} />
          {tierLabel}
        </div>
      </div>
      <div style={modeGridStyle}>
        <button
          type="button"
          disabled={!canUseBasic}
          onClick={() => onSelect('separate_vocal')}
          style={modeCardStyle(!canUseBasic, 'basic')}
        >
          <div style={modeCardTopStyle}>
            <span style={modePlanPillStyle('basic')}>Plus</span>
            <span style={modeTrackCountStyle}>2 轨</span>
          </div>
          <strong style={modeCardTitleStyle}>{TEXT.basicEditor}</strong>
          <span style={modeCardDescriptionStyle}>{TEXT.basicEditorDesc}</span>
          <div style={modeFeatureListStyle}>
            <span>人声 + 伴奏</span>
            <span>片段剪辑</span>
            <span>MP3 导出</span>
          </div>
          {showCreditConfirm && canUseBasic && <small style={modeHintStyle}>开始前会确认积分消耗</small>}
          <em style={modeActionStyle(!canUseBasic)}>{canUseBasic ? TEXT.startBasic : TEXT.freeLocked}</em>
        </button>
        <button
          type="button"
          disabled={!canUsePro}
          onClick={() => onSelect('split_stem')}
          style={modeCardStyle(!canUsePro, 'pro')}
        >
          <div style={modeCardTopStyle}>
            <span style={modePlanPillStyle('pro')}>Pro</span>
            <span style={modeTrackCountStyle}>分析结果分轨</span>
          </div>
          <strong style={modeCardTitleStyle}>{TEXT.proEditor}</strong>
          <span style={modeCardDescriptionStyle}>{TEXT.proEditorDesc}</span>
          <div style={modeFeatureListStyle}>
            <span>多分轨结果</span>
            <span>高级制作</span>
            <span>WAV / 批量导出</span>
          </div>
          {showCreditConfirm && canUsePro && <small style={modeHintStyle}>开始前会确认积分消耗</small>}
          <em style={modeActionStyle(!canUsePro)}>{canUsePro ? TEXT.startPro : showUpgradePrompt ? TEXT.proLocked : '当前未开放'}</em>
        </button>
      </div>
    </div>
  );
}

const fallbackWorkspaceStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 14,
  alignItems: 'start',
  width: '100%',
  maxWidth: 820,
  minWidth: 0,
  margin: '0 auto',
};

const fallbackTimelineColumnStyle: CSSProperties = {
  minWidth: 0,
};

const fallbackInspectorStyle: CSSProperties = {
  display: 'none',
  minHeight: 520,
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))',
  padding: 12,
  boxSizing: 'border-box',
  boxShadow: 'var(--hc-shadow-soft)',
};

const inspectorHeadingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};

const inspectorEyebrowStyle: CSSProperties = {
  color: '#737a93',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
};

const inspectorTitleStyle: CSSProperties = {
  marginTop: 3,
  color: '#f4f4fb',
  fontSize: 15,
  fontWeight: 900,
};

const inspectorSegmentStyle: CSSProperties = {
  marginTop: 12,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 4,
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.78)',
  background: 'rgba(7, 9, 18, 0.72)',
  padding: 4,
  color: '#8f95aa',
  fontSize: 12,
  fontWeight: 850,
  textAlign: 'center',
};

const inspectorSegmentActiveStyle: CSSProperties = {
  borderRadius: 6,
  border: '1px solid rgba(206, 255, 53, 0.42)',
  background: 'rgba(206, 255, 53, 0.12)',
  color: 'var(--hc-lime)',
  padding: '7px 6px',
};

const inspectorDetailGridStyle: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gridTemplateColumns: '70px minmax(0, 1fr)',
  gap: '10px 12px',
  color: '#81889d',
  fontSize: 12,
  lineHeight: 1.35,
};

const inspectorActionGridStyle: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const statusHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  minWidth: 0,
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  padding: 0,
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
  minWidth: 0,
};

const refreshButtonStyle: CSSProperties = {
  minHeight: 36,
  border: '1px solid rgba(206, 255, 53, 0.38)',
  borderRadius: 10,
  background: 'rgba(206, 255, 53, 0.12)',
  color: 'var(--hc-lime)',
  padding: '8px 13px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  marginTop: 12,
  border: '1px solid rgba(248, 113, 113, 0.32)',
  borderRadius: 12,
  background: 'rgba(127, 29, 29, 0.24)',
  color: '#fca5a5',
  padding: '11px 13px',
  fontSize: 13,
};

const loadingPanelStyle: CSSProperties = {
  position: 'relative',
  marginTop: 22,
  minHeight: 270,
  borderRadius: 0,
  border: 'none',
  background: `
    linear-gradient(90deg, rgba(206, 255, 53, 0.2) 1px, transparent 1px),
    linear-gradient(180deg, rgba(82, 214, 198, 0.12) 1px, transparent 1px),
    radial-gradient(circle at 20% 50%, rgba(206, 255, 53, 0.12), transparent 30%),
    radial-gradient(circle at 82% 35%, rgba(82, 214, 198, 0.1), transparent 30%)
  `,
  backgroundSize: '68px 100%, 100% 54px, auto, auto',
  display: 'grid',
  gridTemplateColumns: '112px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 26,
  padding: '28px 6px',
  overflow: 'hidden',
  boxShadow: 'none',
};

const waveLoaderStyle: CSSProperties = {
  position: 'relative',
  width: 104,
  height: 92,
  borderRadius: 18,
  border: '1px solid rgba(206, 255, 53, 0.22)',
  background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.8), rgba(7, 10, 18, 0.72))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  overflow: 'hidden',
  boxShadow: '0 18px 50px rgba(82, 214, 198, 0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
};

function waveBarStyle(index: number): CSSProperties {
  return {
    width: 5,
    height: 46,
    borderRadius: 999,
    background: index % 2 === 0 ? 'var(--hc-lime)' : 'var(--hc-cyan)',
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
  fontSize: 22,
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
    border: active ? '1px solid rgba(206, 255, 53, 0.58)' : '1px solid rgba(48, 52, 76, 0.9)',
    background: done
      ? 'rgba(34, 197, 94, 0.14)'
      : active
        ? 'rgba(206, 255, 53, 0.12)'
        : 'rgba(20, 23, 39, 0.9)',
    color: done ? '#86efac' : active ? 'var(--hc-lime)' : '#858ca5',
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 800,
  };
}

const emptyStateStyle: CSSProperties = {
  marginTop: 10,
  minHeight: 116,
  borderRadius: 8,
  border: '1px dashed rgba(48, 52, 76, 0.9)',
  background: 'rgba(10, 14, 28, 0.58)',
  color: '#aeb4c8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  textAlign: 'center',
};

const modePanelStyle: CSSProperties = {
  position: 'relative',
  width: 'min(1040px, calc(100vw - 48px))',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 18,
  background: 'linear-gradient(135deg, rgba(12, 18, 34, 0.96), rgba(7, 9, 18, 0.92))',
  padding: 28,
  boxSizing: 'border-box',
  boxShadow: '0 28px 90px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255,255,255,0.06)',
  overflow: 'hidden',
};

const modeHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 18,
  marginBottom: 22,
};

const modeEyebrowStyle: CSSProperties = {
  color: 'var(--hc-lime)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0,
  marginBottom: 8,
};

const modeTitleStyle: CSSProperties = {
  color: '#f7f8ff',
  fontSize: 26,
  lineHeight: 1.15,
  fontWeight: 950,
};

const modeIntroStyle: CSSProperties = {
  maxWidth: 560,
  margin: '10px 0 0',
  color: '#9ca8c4',
  fontSize: 14,
  lineHeight: 1.7,
};

function modeTierBadgeStyle(accessTier: 'free' | 'plus' | 'pro'): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    borderRadius: 999,
    border: accessTier === 'pro'
      ? '1px solid rgba(245, 158, 11, 0.45)'
      : accessTier === 'plus'
        ? '1px solid rgba(96, 165, 250, 0.45)'
        : '1px solid rgba(148, 163, 184, 0.32)',
    background: accessTier === 'pro'
      ? 'rgba(245, 158, 11, 0.12)'
      : accessTier === 'plus'
        ? 'rgba(37, 99, 235, 0.16)'
        : 'rgba(15, 23, 42, 0.72)',
    color: accessTier === 'free' ? '#aeb7ce' : '#f8fafc',
    padding: '9px 13px',
    fontSize: 12,
    fontWeight: 900,
  };
}

function modeTierDotStyle(accessTier: 'free' | 'plus' | 'pro'): CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: accessTier === 'pro' ? '#f59e0b' : accessTier === 'plus' ? '#60a5fa' : '#64748b',
    boxShadow: accessTier === 'free' ? 'none' : '0 0 16px currentColor',
  };
};

const modeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 16,
};

function modeCardStyle(disabled: boolean, variant: 'basic' | 'pro'): CSSProperties {
  return {
    position: 'relative',
    minHeight: 248,
    display: 'grid',
    gridTemplateRows: 'auto auto auto 1fr auto auto',
    alignContent: 'stretch',
    gap: 12,
    borderRadius: 14,
    border: disabled
      ? '1px solid rgba(75, 85, 99, 0.58)'
      : variant === 'pro'
        ? '1px solid rgba(245, 158, 11, 0.45)'
        : '1px solid rgba(140, 199, 255, 0.42)',
    background: disabled
      ? 'linear-gradient(180deg, rgba(17, 24, 39, 0.68), rgba(9, 12, 23, 0.74))'
      : variant === 'pro'
        ? 'linear-gradient(160deg, rgba(69, 40, 9, 0.42), rgba(13, 16, 31, 0.92) 58%)'
        : 'linear-gradient(160deg, rgba(15, 50, 88, 0.44), rgba(13, 16, 31, 0.92) 58%)',
    color: disabled ? '#858da1' : '#f7f8ff',
    padding: 20,
    textAlign: 'left',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--hc-font)',
    opacity: disabled ? 0.78 : 1,
    boxShadow: disabled ? 'none' : variant === 'pro' ? '0 18px 46px rgba(245, 158, 11, 0.12)' : '0 18px 46px rgba(96, 165, 250, 0.12)',
    overflow: 'hidden',
    outline: 'none',
  };
}

const modeCardTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};

function modePlanPillStyle(variant: 'basic' | 'pro'): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '6px 10px',
    background: variant === 'pro' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(96, 165, 250, 0.16)',
    border: variant === 'pro' ? '1px solid rgba(245, 158, 11, 0.38)' : '1px solid rgba(96, 165, 250, 0.36)',
    color: variant === 'pro' ? '#fcd38a' : '#b9ddff',
    fontSize: 12,
    fontWeight: 950,
  };
}

const modeTrackCountStyle: CSSProperties = {
  color: '#dbe5ff',
  fontSize: 12,
  fontWeight: 900,
};

const modeCardTitleStyle: CSSProperties = {
  color: 'inherit',
  fontSize: 22,
  lineHeight: 1.2,
  fontWeight: 950,
};

const modeCardDescriptionStyle: CSSProperties = {
  color: '#a7b2cc',
  fontSize: 14,
  lineHeight: 1.65,
};

const modeFeatureListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignContent: 'start',
  gap: 8,
  color: '#dbe5ff',
  fontSize: 12,
  fontWeight: 800,
};

const modeHintStyle: CSSProperties = {
  color: '#d9f99d',
  fontSize: 12,
  fontWeight: 800,
  fontStyle: 'normal',
};

function modeActionStyle(disabled: boolean): CSSProperties {
  return {
    alignSelf: 'end',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: 10,
    background: disabled ? 'rgba(71, 85, 105, 0.24)' : 'var(--hc-lime)',
    color: disabled ? '#9aa4b8' : '#111827',
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 950,
    fontStyle: 'normal',
  };
}

const fallbackTransportStyle: CSSProperties = {
  display: 'none',
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 19,
  minHeight: 54,
  gridTemplateColumns: '36px 36px 46px 104px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 9,
  padding: '8px 18px',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'rgba(7, 8, 11, 0.96)',
  boxSizing: 'border-box',
};

const transportButtonGhostStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.9)',
  background: '#111827',
};

const transportPlayGhostStyle: CSSProperties = {
  width: 42,
  height: 34,
  borderRadius: 999,
  background: 'var(--hc-lime)',
};

const transportTimeGhostStyle: CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.9)',
  background: '#111827',
  color: '#f4f4fb',
  display: 'grid',
  placeItems: 'center',
  fontSize: 12,
  fontWeight: 900,
};

const transportProgressGhostStyle: CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.82)',
  overflow: 'hidden',
};
