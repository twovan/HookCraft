'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { StyleDNA, TrackAnalysis } from '@/types/style-dna';

type GenerationInfo = {
  taskId?: string;
  localTaskId?: string;
  batchId?: string;
  statusUrl?: string;
  creationUrl?: string;
};

type PromptPackage = {
  id: string;
  styleDnaId: string;
  title: string;
  stylePromptShort: string;
  stylePromptMedium: string;
  stylePromptLong: string;
  stylePrompt: string;
  lyricPrompt: string;
  instrumentalPrompt: string;
  structurePrompt: string;
  negativePrompt: string;
  customMode: boolean;
  instrumental: boolean;
  providerPayload: unknown;
  promptVersion: number;
  changeSummary?: string;
  createdAt: string;
};

type StyleTemplate = {
  id: string;
  userId: string;
  styleDnaId: string;
  name: string;
  description: string;
  styleDnaSnapshot: StyleDNA;
  promptPackageSnapshot?: PromptPackage | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type FeedbackState = {
  tooElectronic: boolean;
  tooRock: boolean;
  tooGeneric: boolean;
  drumsTooHeavy: boolean;
  chorusNotBigEnough: boolean;
  vocalNotForward: boolean;
  notMandarinPopEnough: boolean;
  harmonyTooSimple: boolean;
  arrangementTooFlat: boolean;
  emotionNotProgressive: boolean;
  feedbackText: string;
};

const EMPTY_FEEDBACK: FeedbackState = {
  tooElectronic: false,
  tooRock: false,
  tooGeneric: false,
  drumsTooHeavy: false,
  chorusNotBigEnough: false,
  vocalNotForward: false,
  notMandarinPopEnough: false,
  harmonyTooSimple: false,
  arrangementTooFlat: false,
  emotionNotProgressive: false,
  feedbackText: '',
};

function splitCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function joinCsv(values?: string[]) {
  return (values || []).join(', ');
}

function updateDnaField<K extends keyof StyleDNA>(dna: StyleDNA | null, key: K, value: StyleDNA[K]) {
  if (!dna) return null;
  return { ...dna, [key]: value };
}

export default function StyleDnaWorkbench({ variant = 'studio' }: { variant?: 'studio' | 'admin' }) {
  const [name, setName] = useState('风格 DNA 会话');
  const [instrumental, setInstrumental] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<TrackAnalysis[]>([]);
  const [styleDna, setStyleDna] = useState<StyleDNA | null>(null);
  const [promptPackage, setPromptPackage] = useState<PromptPackage | null>(null);
  const [promptHistory, setPromptHistory] = useState<PromptPackage[]>([]);
  const [generationInfo, setGenerationInfo] = useState<GenerationInfo | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);
  const [busy, setBusy] = useState<'analyzing' | 'saving' | 'composing' | 'generating' | 'refining' | 'templating' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<StyleTemplate[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const canAnalyze = files.length > 0 && !busy;
  const canGenerate = Boolean(jobId && promptPackage && !busy);
  const confidenceLabel = styleDna ? `${Math.round(styleDna.confidence * 100)}%` : '待分析';

  const feedbackOptions = useMemo(() => [
    ['tooElectronic', '电子感过强'],
    ['tooRock', '摇滚感过强'],
    ['tooGeneric', '风格太泛'],
    ['drumsTooHeavy', '鼓组太重'],
    ['chorusNotBigEnough', '副歌不够大'],
    ['vocalNotForward', '人声不够靠前'],
    ['notMandarinPopEnough', '华语流行感不足'],
    ['harmonyTooSimple', '和声太简单'],
    ['arrangementTooFlat', '编曲层次太平'],
    ['emotionNotProgressive', '情绪推进不足'],
  ] as const, []);

  useEffect(() => {
    void fetchSavedTemplates();
  }, []);

  async function fetchSavedTemplates() {
    try {
      const res = await fetch('/api/style-dna/templates', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setSavedTemplates((data.templates || []).map(mapTemplateRow).filter(Boolean));
    } catch {
      // Saved templates are helpful but not required for the main analysis flow.
    }
  }

  function applySavedTemplate(template: StyleTemplate) {
    setStyleDna(template.styleDnaSnapshot);
    if (template.promptPackageSnapshot) {
      setPromptPackage(template.promptPackageSnapshot);
      setPromptHistory((current) => [template.promptPackageSnapshot!, ...current.filter((item) => item.id !== template.promptPackageSnapshot?.id)]);
    }
    setName(template.name);
    setTemplateMessage(`Loaded template: ${template.name}`);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files || []));
    setError(null);
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setBusy('analyzing');
    setError(null);
    setTemplateMessage(null);
    setGenerationInfo(null);

    try {
      const formData = new FormData();
      formData.append('name', name || '风格 DNA');
      formData.append('instrumental', String(instrumental));
      for (const file of files) formData.append('files', file);

      const res = await fetch('/api/style-dna/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '风格 DNA 分析失败');

      setJobId(data.jobId);
      setStyleDna(data.styleDna);
      setPromptPackage(data.promptPackage);
      setPromptHistory([data.promptPackage]);
      setAnalyses(data.analyses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '风格 DNA 分析失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveAndCompose() {
    if (!jobId || !styleDna || busy) return;
    setBusy('saving');
    setError(null);
    setTemplateMessage(null);

    try {
      const saveRes = await fetch(`/api/style-dna/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(styleDna),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) throw new Error(saveData.error || '保存风格 DNA 失败');

      setBusy('composing');
      const composeRes = await fetch(`/api/style-dna/${jobId}/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name, instrumental }),
      });
      const composeData = await composeRes.json();
      if (!composeRes.ok) throw new Error(composeData.error || '生成提示词包失败');
      setPromptPackage(composeData.promptPackage);
      setPromptHistory((current) => [composeData.promptPackage, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存风格 DNA 失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate() {
    if (!canGenerate || !jobId) return;
    setBusy('generating');
    setError(null);
    setTemplateMessage(null);

    try {
      const res = await fetch(`/api/style-dna/${jobId}/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交生成失败');
      setGenerationInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交生成失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleRefine() {
    if (!jobId || !promptPackage || busy) return;
    setBusy('refining');
    setError(null);
    setTemplateMessage(null);

    try {
      const res = await fetch(`/api/style-dna/${jobId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '优化提示词失败');
      setPromptPackage(data.promptPackage);
      setPromptHistory((current) => [data.promptPackage, ...current]);
      setFeedback(EMPTY_FEEDBACK);
    } catch (err) {
      setError(err instanceof Error ? err.message : '优化提示词失败');
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveTemplate() {
    if (!jobId || !styleDna || busy) return;
    setBusy('templating');
    setError(null);
    setTemplateMessage(null);

    try {
      const saveRes = await fetch(`/api/style-dna/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(styleDna),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save Style DNA before templating');

      const res = await fetch(`/api/style-dna/${jobId}/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: styleDna.name || name,
          description: styleDna.summary,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save style template');
      setTemplateMessage(`Saved template: ${data.template?.name || styleDna.name || name}`);
      await fetchSavedTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save style template');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className={`style-dna-workbench ${variant === 'admin' ? 'admin-surface' : ''}`}>
      <header className="style-dna-header">
        <div>
          <h1>风格 DNA 工作台</h1>
          <p>上传参考音乐，提取可编辑的风格档案，再生成适合当前生成引擎的安全提示词包。</p>
        </div>
        <div className="style-dna-status">
          <span>置信度</span>
          <strong>{confidenceLabel}</strong>
        </div>
      </header>

      {error && <div className="style-dna-error">{error}</div>}
      {templateMessage && <div className="style-dna-success">{templateMessage}</div>}

      <div className="style-dna-grid">
        <section className="style-dna-panel">
          <div className="panel-head">
            <h2>参考音乐</h2>
            <span>{files.length}/5</span>
          </div>

          <label className="field">
            <span>会话名称</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="toggle-row">
            <input type="checkbox" checked={instrumental} onChange={(event) => setInstrumental(event.target.checked)} />
            <span>生成纯音乐版本</span>
          </label>

          <label className="upload-zone">
            <input type="file" multiple accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav" onChange={handleFileChange} />
            <strong>选择参考音乐</strong>
            <span>支持 MP3/WAV，最多 5 首</span>
          </label>

          <button className="style-dna-button" disabled={!canAnalyze} onClick={handleAnalyze}>
            {busy === 'analyzing' ? '正在分析...' : '分析风格 DNA'}
          </button>

          <div className="track-list">
            {files.map((file) => (
              <div className="track-row" key={`${file.name}-${file.size}`}>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
            {analyses.map((analysis) => (
              <div className="analysis-row" key={analysis.id}>
                <strong>{analysis.title}</strong>
                <span>{analysis.bpmRange} / {analysis.keyEstimate}</span>
                <p>{analysis.genreCandidates.join(', ') || '风格未知'}</p>
              </div>
            ))}
          </div>

          {savedTemplates.length > 0 && (
            <div className="template-list">
              <h3>已保存风格模板</h3>
              {savedTemplates.map((template) => (
                <button type="button" key={template.id} onClick={() => applySavedTemplate(template)}>
                  <strong>{template.name}</strong>
                  <span>{template.tags.slice(0, 4).join(', ') || 'Style DNA'}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="style-dna-panel">
          <div className="panel-head">
            <h2>可编辑风格档案</h2>
            <span>v{styleDna?.version || 1}</span>
          </div>

          {!styleDna ? (
            <div className="empty-state">上传参考音乐后，这里会生成可编辑的风格 DNA 档案。</div>
          ) : (
            <div className="editor-grid">
              <label className="field wide">
                <span>整体摘要</span>
                <textarea value={styleDna.summary} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'summary', event.target.value))} />
              </label>
              <label className="field">
                <span>风格类型</span>
                <input value={joinCsv(styleDna.genre)} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'genre', splitCsv(event.target.value)))} />
              </label>
              <label className="field">
                <span>BPM 范围</span>
                <input value={styleDna.tempoRange} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'tempoRange', event.target.value))} />
              </label>
              <label className="field">
                <span>情绪 / 调性</span>
                <input value={styleDna.keyMood} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'keyMood', event.target.value))} />
              </label>
              <label className="field">
                <span>主要乐器</span>
                <input value={joinCsv(styleDna.primaryInstruments)} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'primaryInstruments', splitCsv(event.target.value)))} />
              </label>
              <label className="field">
                <span>鼓组</span>
                <input value={styleDna.drumPattern} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'drumPattern', event.target.value))} />
              </label>
              <label className="field">
                <span>贝斯</span>
                <input value={styleDna.bassPattern} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'bassPattern', event.target.value))} />
              </label>
              <label className="field">
                <span>和声语言</span>
                <input value={styleDna.harmonyLanguage} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'harmonyLanguage', event.target.value))} />
              </label>
              <label className="field">
                <span>制作质感</span>
                <input value={styleDna.productionTexture} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'productionTexture', event.target.value))} />
              </label>
              <label className="field wide">
                <span>避免元素</span>
                <input value={joinCsv(styleDna.avoidTags)} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'avoidTags', splitCsv(event.target.value)))} />
              </label>
              <label className="field wide">
                <span>情绪推进</span>
                <textarea value={styleDna.emotionalArc} onChange={(event) => setStyleDna(updateDnaField(styleDna, 'emotionalArc', event.target.value))} />
              </label>
              <button className="style-dna-button wide" disabled={Boolean(busy)} onClick={handleSaveAndCompose}>
                {busy === 'saving' || busy === 'composing' ? '正在保存...' : '保存并生成提示词'}
              </button>
              <button className="style-dna-button secondary wide" disabled={Boolean(busy)} onClick={handleSaveTemplate}>
                {busy === 'templating' ? 'Saving template...' : 'Save as style template'}
              </button>
            </div>
          )}
        </section>

        <aside className="style-dna-panel">
          <div className="panel-head">
            <h2>生成提示词包</h2>
            <span>v{promptPackage?.promptVersion || '-'}</span>
          </div>

          {!promptPackage ? (
            <div className="empty-state">分析完成后，这里会显示可复制、可优化的提示词包。</div>
          ) : (
            <div className="prompt-stack">
              <PromptBlock title="短风格提示" value={promptPackage.stylePromptShort} onCopy={copyText} copied={copied} />
              <PromptBlock title="中等风格提示" value={promptPackage.stylePromptMedium} onCopy={copyText} copied={copied} />
              <PromptBlock title="结构提示" value={promptPackage.structurePrompt} onCopy={copyText} copied={copied} />
              <PromptBlock title="反向提示" value={promptPackage.negativePrompt} onCopy={copyText} copied={copied} />
              <button className="style-dna-button" disabled={!canGenerate} onClick={handleGenerate}>
                {busy === 'generating' ? '正在提交...' : '提交到当前生成引擎'}
              </button>
              {generationInfo && (
                <div className="generation-box">
                  <strong>生成任务已排队</strong>
                  <span>{generationInfo.taskId}</span>
                  {generationInfo.creationUrl && <a href={generationInfo.creationUrl}>打开生成历史</a>}
                </div>
              )}
            </div>
          )}

          <div className="feedback-box">
            <h3>优化提示词 V2</h3>
            <div className="feedback-grid">
              {feedbackOptions.map(([key, label]) => (
                <label key={key} className="feedback-chip">
                  <input
                    type="checkbox"
                    checked={Boolean(feedback[key])}
                    onChange={(event) => setFeedback((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <textarea
              value={feedback.feedbackText}
              onChange={(event) => setFeedback((current) => ({ ...current, feedbackText: event.target.value }))}
              placeholder="补充你想调整的方向..."
            />
            <button className="style-dna-button" disabled={!promptPackage || Boolean(busy)} onClick={handleRefine}>
              {busy === 'refining' ? '正在优化...' : '生成 V2 提示词'}
            </button>
          </div>

          {promptHistory.length > 0 && (
            <div className="history-list">
              <h3>版本历史</h3>
              {promptHistory.map((item) => (
                <button key={item.id} onClick={() => setPromptPackage(item)} className={item.id === promptPackage?.id ? 'active' : ''}>
                  v{item.promptVersion} {item.changeSummary || '初始提示词'}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      <style>{`
        .style-dna-workbench {
          min-height: 100vh;
          background:
            radial-gradient(circle at 12% 0%, rgba(206, 255, 53, 0.08), transparent 28%),
            radial-gradient(circle at 90% 6%, rgba(82, 214, 198, 0.08), transparent 30%),
            var(--hc-bg);
          color: var(--hc-text);
          padding: 28px;
          font-family: var(--hc-font);
        }
        .style-dna-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: flex-end;
          margin-bottom: 22px;
        }
        .style-dna-header h1 {
          margin: 0 0 8px;
          font-size: clamp(30px, 4vw, 52px);
          line-height: 1;
          letter-spacing: 0;
        }
        .style-dna-header p {
          margin: 0;
          max-width: 760px;
          color: var(--hc-text-muted);
          line-height: 1.6;
        }
        .style-dna-status {
          border: 1px solid var(--hc-border);
          border-radius: 8px;
          padding: 12px 14px;
          min-width: 132px;
          background: linear-gradient(180deg, rgba(22, 26, 32, 0.96), rgba(15, 18, 23, 0.96));
          box-shadow: 0 18px 48px rgba(0,0,0,0.22);
        }
        .style-dna-status span,
        .panel-head span {
          display: block;
          color: var(--hc-text-muted);
          font-size: 12px;
        }
        .style-dna-status strong {
          display: block;
          margin-top: 4px;
          color: var(--hc-lime);
          font-size: 22px;
        }
        .style-dna-error,
        .style-dna-success {
          border: 1px solid rgba(255, 90, 61, 0.36);
          background: rgba(255, 90, 61, 0.1);
          color: #ff9b87;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-weight: 800;
        }
        .style-dna-success {
          border-color: rgba(206, 255, 53, 0.34);
          background: rgba(206, 255, 53, 0.10);
          color: var(--hc-lime);
        }
        .style-dna-grid {
          display: grid;
          grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) minmax(300px, 380px);
          gap: 18px;
          align-items: start;
        }
        .style-dna-panel {
          border: 1px solid var(--hc-border);
          background: linear-gradient(180deg, rgba(22, 26, 32, 0.96), rgba(15, 18, 23, 0.94));
          box-shadow: 0 14px 34px rgba(0,0,0,0.18);
          border-radius: 8px;
          padding: 16px;
          min-width: 0;
        }
        .panel-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 14px;
        }
        .panel-head h2,
        .feedback-box h3,
        .history-list h3,
        .template-list h3 {
          margin: 0;
          font-size: 16px;
          letter-spacing: 0;
        }
        .field,
        .toggle-row {
          display: grid;
          gap: 7px;
          margin-bottom: 12px;
        }
        .field span,
        .toggle-row span {
          color: var(--hc-text-muted);
          font-size: 12px;
          font-weight: 850;
        }
        .field input,
        .field textarea,
        .feedback-box textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--hc-border);
          border-radius: 8px;
          background: rgba(8, 10, 13, 0.92);
          color: var(--hc-text);
          padding: 11px 12px;
          font-size: 13px;
          line-height: 1.55;
          outline: none;
          letter-spacing: 0;
        }
        .field textarea,
        .feedback-box textarea {
          min-height: 84px;
          resize: vertical;
        }
        .toggle-row {
          grid-template-columns: auto 1fr;
          align-items: center;
        }
        .upload-zone {
          min-height: 112px;
          border: 1px dashed rgba(206, 255, 53, 0.36);
          border-radius: 8px;
          display: grid;
          place-items: center;
          gap: 6px;
          text-align: center;
          cursor: pointer;
          background: rgba(206, 255, 53, 0.045);
          margin-bottom: 12px;
          padding: 14px;
        }
        .upload-zone input {
          display: none;
        }
        .upload-zone strong {
          color: var(--hc-text);
        }
        .upload-zone span,
        .track-row span,
        .analysis-row span,
        .analysis-row p {
          color: var(--hc-text-muted);
          font-size: 12px;
          margin: 0;
        }
        .style-dna-button {
          min-height: 44px;
          border-radius: 999px;
          border: 0;
          background: linear-gradient(135deg, var(--hc-lime), var(--hc-cyan));
          color: #08090c;
          font-weight: 900;
          cursor: pointer;
          width: 100%;
          padding: 0 18px;
        }
        .style-dna-button:disabled {
          opacity: 0.48;
          cursor: not-allowed;
        }
        .style-dna-button.secondary {
          border: 1px solid rgba(206, 255, 53, 0.28);
          background: rgba(206, 255, 53, 0.08);
          color: var(--hc-lime);
        }
        .track-list,
        .prompt-stack,
        .history-list,
        .feedback-box,
        .template-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .track-row,
        .analysis-row,
        .generation-box {
          border: 1px solid var(--hc-border);
          border-radius: 8px;
          padding: 10px;
          background: rgba(255,255,255,0.035);
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .track-row strong,
        .analysis-row strong,
        .generation-box span {
          overflow-wrap: anywhere;
        }
        .editor-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .wide {
          grid-column: 1 / -1;
        }
        .empty-state {
          border: 1px dashed var(--hc-border);
          border-radius: 8px;
          padding: 24px;
          color: var(--hc-text-muted);
          line-height: 1.6;
        }
        .prompt-block {
          border: 1px solid var(--hc-border);
          border-radius: 8px;
          padding: 10px;
          background: rgba(8, 10, 13, 0.92);
        }
        .prompt-block-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .prompt-block-head strong {
          font-size: 13px;
        }
        .prompt-block-head button,
        .history-list button,
        .template-list button {
          min-height: 34px;
          border: 1px solid var(--hc-border);
          border-radius: 999px;
          background: transparent;
          color: var(--hc-text);
          cursor: pointer;
          padding: 0 12px;
        }
        .prompt-block pre {
          margin: 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          color: var(--hc-text-muted);
          font-family: inherit;
          font-size: 12px;
          line-height: 1.55;
        }
        .generation-box a {
          color: var(--hc-lime);
          font-size: 13px;
        }
        .feedback-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .feedback-chip {
          display: flex;
          gap: 7px;
          align-items: center;
          min-height: 36px;
          border: 1px solid var(--hc-border);
          border-radius: 8px;
          padding: 0 9px;
          color: var(--hc-text-muted);
          font-size: 12px;
        }
        .history-list button {
          border-radius: 8px;
          text-align: left;
        }
        .template-list button {
          border-radius: 8px;
          display: grid;
          gap: 4px;
          padding: 10px;
          text-align: left;
        }
        .template-list button span {
          color: var(--hc-text-muted);
          font-size: 12px;
        }
        .history-list button.active {
          border-color: rgba(206,255,53,.45);
          color: var(--hc-lime);
        }
        @media (max-width: 920px) {
          .style-dna-workbench {
            padding: 16px;
          }
          .style-dna-header {
            align-items: stretch;
            flex-direction: column;
          }
          .style-dna-grid,
          .editor-grid {
            grid-template-columns: 1fr;
          }
          .wide {
            grid-column: auto;
          }
          .feedback-grid {
            grid-template-columns: 1fr;
          }
        }
        .style-dna-workbench.admin-surface {
          min-height: auto;
          padding: 0;
          background: transparent;
          color: #1f2937;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        }
        .admin-surface .style-dna-header {
          margin-bottom: 20px;
        }
        .admin-surface .style-dna-header h1 {
          margin-bottom: 6px;
          color: #1f2937;
          font-size: 24px;
          font-weight: 700;
        }
        .admin-surface .style-dna-header p {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.7;
        }
        .admin-surface .style-dna-status,
        .admin-surface .style-dna-panel {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.04);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .admin-surface .style-dna-status {
          min-width: 118px;
          padding: 14px 16px;
        }
        .admin-surface .style-dna-status span,
        .admin-surface .panel-head span,
        .admin-surface .field span,
        .admin-surface .toggle-row span,
        .admin-surface .upload-zone span,
        .admin-surface .track-row span,
        .admin-surface .analysis-row span,
        .admin-surface .analysis-row p,
        .admin-surface .prompt-block pre,
        .admin-surface .template-list button span {
          color: #6b7280;
        }
        .admin-surface .style-dna-status strong {
          color: #D4A574;
          font-size: 24px;
          font-weight: 700;
        }
        .admin-surface .panel-head h2,
        .admin-surface .feedback-box h3,
        .admin-surface .history-list h3,
        .admin-surface .template-list h3,
        .admin-surface .prompt-block-head strong,
        .admin-surface .track-row strong,
        .admin-surface .analysis-row strong {
          color: #1f2937;
        }
        .admin-surface .field input,
        .admin-surface .field textarea,
        .admin-surface .feedback-box textarea {
          border-color: #e5e7eb;
          background: #fff;
          color: #374151;
          box-shadow: inset 0 0 0 1px transparent;
        }
        .admin-surface .field input:focus,
        .admin-surface .field textarea:focus,
        .admin-surface .feedback-box textarea:focus {
          border-color: #D4A574;
          box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.16);
        }
        .admin-surface .upload-zone {
          border-color: #e5e7eb;
          background: #fafafa;
        }
        .admin-surface .upload-zone strong {
          color: #374151;
        }
        .admin-surface .style-dna-button {
          border-radius: 8px;
          background: #D4A574;
          color: #fff;
          font-weight: 600;
          box-shadow: none;
        }
        .admin-surface .style-dna-button.secondary {
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #374151;
        }
        .admin-surface .track-row,
        .admin-surface .analysis-row,
        .admin-surface .generation-box,
        .admin-surface .prompt-block {
          border-color: #f3f4f6;
          background: #fafafa;
        }
        .admin-surface .empty-state {
          border-color: #e5e7eb;
          background: #fafafa;
          color: #9ca3af;
        }
        .admin-surface .feedback-chip,
        .admin-surface .prompt-block-head button,
        .admin-surface .history-list button,
        .admin-surface .template-list button {
          border-color: #e5e7eb;
          background: #fff;
          color: #374151;
        }
        .admin-surface .history-list button.active {
          border-color: #D4A574;
          background: rgba(212, 165, 116, 0.10);
          color: #8a5d2f;
        }
        .admin-surface .generation-box a {
          color: #8a5d2f;
        }
        .admin-surface .style-dna-success {
          border-color: rgba(34, 197, 94, 0.28);
          background: rgba(34, 197, 94, 0.08);
          color: #15803d;
        }
        .admin-surface .style-dna-error {
          border-color: rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.08);
          color: #b91c1c;
        }
      `}</style>
    </main>
  );
}

function PromptBlock({
  title,
  value,
  copied,
  onCopy,
}: {
  title: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <div className="prompt-block">
      <div className="prompt-block-head">
        <strong>{title}</strong>
        <button type="button" onClick={() => onCopy(title, value)}>{copied === title ? '已复制' : '复制'}</button>
      </div>
      <pre>{value}</pre>
    </div>
  );
}

function mapTemplateRow(row: any): StyleTemplate | null {
  if (!row?.id || !row?.style_dna_snapshot) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id || ''),
    styleDnaId: String(row.style_dna_id || ''),
    name: String(row.name || 'Style DNA Template'),
    description: String(row.description || ''),
    styleDnaSnapshot: row.style_dna_snapshot as StyleDNA,
    promptPackageSnapshot: row.prompt_package_snapshot as PromptPackage | null,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}
