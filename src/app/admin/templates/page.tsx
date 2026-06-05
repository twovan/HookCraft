'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import FormModal from '@/components/admin/FormModal';

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  genre: string;
  genre_tags: string[];
  producer_id: string | null;
  price: number;
  sales_count: number;
  status: string;
  created_at: string;
  cover_url?: string;
  preview_url?: string;
  analysis_status?: string;
  analysis_result?: string;
  lyria_prompt?: string;
  suno_analysis_status?: string;
  suno_analysis_result?: string;
  suno_prompt?: string;
}

interface ProducerOption {
  id: string;
  name: string;
  email: string;
}

const MAX_TEMPLATE_ANALYSIS_CHARS = 1000;
type AnalysisType = 'lyria3' | 'suno';
type AnalysisChoice = AnalysisType | 'both';

const statusColorMap: Record<string, 'green' | 'blue' | 'orange' | 'red' | 'gray'> = {
  published: 'green',
  pending: 'orange',
  unpublished: 'gray',
  rejected: 'red',
};

const statusLabelMap: Record<string, string> = {
  published: '已发布',
  pending: '待审核',
  unpublished: '已下架',
  rejected: '已拒绝',
};

// Helper: convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: call Gemini API directly from browser
async function callGeminiFromBrowser(
  apiKey: string,
  audioFiles: Array<{ base64: string; mimeType: string }>,
  analysisType: AnalysisType = 'lyria3'
): Promise<{ analysisResult: string; lyriaPrompt: string }> {
  const prompt = buildBrowserAnalysisPrompt(analysisType, audioFiles.length);
  const legacyPrompt = audioFiles.length > 1
    ? `我提供了${audioFiles.length}首参考音乐，请综合分析这些音乐的共同风格特征，用于生成一个 Lyria 3 音乐模板。请用中文输出分析结果，同时在最后附上一段详细的英文 Lyria 3 Prompt。\n\n请综合所有参考音乐，提取它们的共同特征：\n1. 🎵 共同的流派与子流派\n2. ⏱️ BPM 范围\n3. 🎹 常用调性与音阶\n4. 🎸 共同使用的乐器\n5. 🌙 整体情绪与氛围\n6. 📐 典型的歌曲结构\n7. 🔧 共同的制作技巧\n8. ⚡ 整体能量水平\n9. 🎤 人声特征\n\n最后，请用英文输出一段详细的 Lyria 3 音乐生成 prompt（200-400词），格式如下：\n[PROMPT]\nA [detailed genre] track at [BPM] BPM in [key].\nInstrumentation: [details].\nMood: [adjectives].\nStructure:\n[0:00 - 0:XX] Intro: [description]\n...\nVocal style: [description].\nProduction: [details].\n[/PROMPT]`
    : `请详细分析这段音乐，用于生成一个 Lyria 3 音乐模板。请用中文输出分析结果，同时在最后附上一段详细的英文 Lyria 3 Prompt。\n\n请包含以下内容：\n1. 🎵 流派与子流派\n2. ⏱️ BPM\n3. 🎹 调性与音阶\n4. 🎸 主要乐器\n5. 🌙 情绪与氛围\n6. 📐 歌曲结构\n7. 🔧 制作技巧\n8. ⚡ 能量水平\n9. 🎤 人声特征\n\n最后，请用英文输出一段详细的 Lyria 3 音乐生成 prompt（200-400词），格式如下：\n[PROMPT]\nA [detailed genre] track at [BPM] BPM in [key].\nInstrumentation: [details].\nMood: [adjectives].\nStructure:\n[0:00 - 0:XX] Intro: [description]\n...\nVocal style: [description].\nProduction: [details].\n[/PROMPT]`;

  // Build request parts - use File API for large payloads
  const parts: any[] = [];
  const totalSize = audioFiles.reduce((sum, f) => sum + f.base64.length, 0);
  const totalMB = totalSize / 1024 / 1024;

  if (totalMB > 15 || audioFiles.length > 2) {
    const filesToUpload = audioFiles.slice(0, 5);
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const binaryData = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
      const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': file.mimeType, 'X-Goog-Upload-Protocol': 'raw', 'X-Goog-Upload-Command': 'upload, finalize' },
        body: binaryData,
      });
      if (!startRes.ok) throw new Error(`文件 ${i + 1} 上传失败`);
      const fileInfo = await startRes.json();
      const fileUri = fileInfo?.file?.uri;
      if (!fileUri) throw new Error(`文件 ${i + 1} 未返回 URI`);
      if (i < filesToUpload.length - 1) await new Promise(resolve => setTimeout(resolve, 1500));
      parts.push({ file_data: { mime_type: file.mimeType, file_uri: fileUri } });
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  } else {
    for (const file of audioFiles) {
      parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } });
    }
  }
  parts.push({ text: analysisType === 'suno' ? prompt : legacyPrompt });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API 错误 (${res.status})`);
  }
  const data = await res.json();
  const responseParts = data?.candidates?.[0]?.content?.parts;
  let fullText = '';
  if (responseParts) { for (const part of responseParts) { if (part.text) fullText += part.text; } }
  if (!fullText) throw new Error('Gemini 未返回分析结果');
  const promptMatch = fullText.match(/\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/);
  if (promptMatch) {
    const analysisResult = fullText.replace(/\[PROMPT\][\s\S]*?\[\/PROMPT\]/, '').trim();
    const generationPrompt = promptMatch[1].trim();
    return {
      analysisResult: analysisType === 'suno' ? normalizeTemplateAnalysisText(analysisResult) : analysisResult,
      lyriaPrompt: analysisType === 'suno' ? truncateTemplateAnalysis(generationPrompt) : generationPrompt,
    };
  }
  const fallback = analysisType === 'suno' ? normalizeTemplateAnalysisText(fullText) : fullText;
  return {
    analysisResult: fallback,
    lyriaPrompt: analysisType === 'suno' ? truncateTemplateAnalysis(fullText) : fallback,
  };
}

function buildBrowserAnalysisPrompt(analysisType: AnalysisType, audioCount: number) {
  if (analysisType === 'suno') {
    return `Analyze ${audioCount > 1 ? `these ${audioCount} reference tracks` : 'this reference track'} and create a SUNO-ready music generation description.
Requirements:
1. Only analyze arrangement and production. Do not analyze vocals, singer, voice, lyrics, lyric meaning, or singing style.
2. Focus on genre/subgenre, tempo or BPM range, key/scale if detectable, core instruments, drum groove, bassline, chord or riff motifs, section structure, sound design, mix texture, mood, and energy changes.
3. First output one complete Chinese arrangement analysis for human review, 500-900 Chinese characters. Keep musical details complete and readable.
4. Then output one direct English SUNO style description inside [PROMPT]...[/PROMPT], 650-950 characters. This is passed to SUNO style, not lyrics.
5. The SUNO style description must only describe music and arrangement. Do not include vocal, singer, voice, lyrics, lyric meaning, male/female vocal, rap, spoken word, or topline requests.
6. Preserve musical accuracy by prioritizing, in order: genre/subgenre, BPM/tempo, key/scale, drums, bass, core instruments, harmonic/melodic motifs, section structure, sound design, mix texture, mood, and energy arc.
7. Keep the English style description dense and concrete. Prefer complete short fields: Genre, Tempo, Key, Instruments, Groove, Bass, Structure, Production, Mood, Energy.
8. Never end with an unfinished field label such as "Tempo:", "Key:", "Drums:", or "Structure:". If space is tight, omit the lower-priority field entirely and end on a complete phrase.
Format:
中文编曲分析：...
[PROMPT] concise English SUNO style description here [/PROMPT]`;
  }

  return audioCount > 1
    ? `Analyze these ${audioCount} reference tracks and extract their shared style for a Lyria 3 music template. Return a Chinese analysis and put the final English Lyria 3 prompt inside [PROMPT]...[/PROMPT].`
    : `Analyze this reference track for a Lyria 3 music template. Return a Chinese analysis and put the final English Lyria 3 prompt inside [PROMPT]...[/PROMPT].`;
}

function truncateTemplateAnalysis(text: string) {
  const normalized = normalizeTemplateAnalysisText(text);
  const chars = Array.from(normalized);
  if (chars.length <= MAX_TEMPLATE_ANALYSIS_CHARS) return normalized;
  return trimAtMusicalBoundary(normalized, MAX_TEMPLATE_ANALYSIS_CHARS);
}

function normalizeTemplateAnalysisText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function trimAtMusicalBoundary(text: string, maxChars: number) {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  const limited = chars.slice(0, maxChars).join('');
  const withoutDanglingLabel = stripIncompleteMusicalField(limited);
  if (Array.from(withoutDanglingLabel).length >= Math.floor(maxChars * 0.78)) {
    return withoutDanglingLabel;
  }
  const boundary = Math.max(
    limited.lastIndexOf('. '),
    limited.lastIndexOf('; '),
    limited.lastIndexOf(', '),
    limited.lastIndexOf('| '),
    limited.lastIndexOf('，'),
    limited.lastIndexOf('。'),
  );
  if (boundary >= Math.floor(maxChars * 0.82)) {
    return stripIncompleteMusicalField(limited.slice(0, boundary + 1));
  }
  return stripIncompleteMusicalField(limited);
}

function stripIncompleteMusicalField(text: string) {
  const musicalFieldLabels = [
    'Genre',
    'Subgenre',
    'Tempo',
    'BPM',
    'Key',
    'Scale',
    'Instrumentation',
    'Instruments',
    'Drums',
    'Drum groove',
    'Bass',
    'Bassline',
    'Chords',
    'Harmony',
    'Motifs',
    'Structure',
    'Sound design',
    'Mix',
    'Texture',
    'Mood',
    'Energy',
    'Production',
    'Arrangement',
  ].join('|');

  return text
    .replace(new RegExp(`(?:^|[\\s,.;|，。；])(?:${musicalFieldLabels})\\s*:\\s*$`, 'i'), '')
    .replace(/[,;:|，。；\s-]+$/g, '')
    .trim();
}

function formatAnalysisForDisplay(text?: string | null) {
  return text ? stripIncompleteMusicalField(text) : '';
}

function getCharacterCount(text?: string | null) {
  return text ? Array.from(text).length : 0;
}

function renderCharacterCount(text?: string | null, max?: number) {
  const count = getCharacterCount(text);
  const isOverLimit = Boolean(max && count > max);
  return (
    <span style={{
      fontSize: 12,
      fontWeight: 500,
      color: isOverLimit ? '#dc2626' : '#6b7280',
      marginLeft: 8,
    }}>
      {count}{max ? `/${max}` : ''} 字符
    </span>
  );
}

export default function AdminTemplatesPage() {
  const [data, setData] = useState<TemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 10;

  // Stats
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, unpublished: 0 });
  const [producers, setProducers] = useState<ProducerOption[]>([]);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', category: '', genre_tags: '', price: 0, producer_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [audioChanged, setAudioChanged] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const [analysisChoiceOpen, setAnalysisChoiceOpen] = useState(false);
  const analysisChoiceResolver = useRef<((choice: AnalysisChoice | null) => void) | null>(null);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Analysis modal
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisTemplate, setAnalysisTemplate] = useState<TemplateItem | null>(null);

  function requestAnalysisChoice(): Promise<AnalysisChoice | null> {
    setAnalysisChoiceOpen(true);
    return new Promise((resolve) => {
      analysisChoiceResolver.current = resolve;
    });
  }

  function resolveAnalysisChoice(choice: AnalysisChoice | null) {
    analysisChoiceResolver.current?.(choice);
    analysisChoiceResolver.current = null;
    setAnalysisChoiceOpen(false);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('includeStats', 'true');
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await fetch(`/api/admin/templates?${params.toString()}`);
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      setData(result.data || []);
      setTotal(result.total || 0);

      if (result.stats) {
        setStats(result.stats);
      }
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    async function fetchProducers() {
      try {
        const res = await fetch('/api/admin/producers?pageSize=200');
        if (!res.ok) return;
        const result = await res.json();
        setProducers(result.data || []);
      } catch {
        setProducers([]);
      }
    }
    fetchProducers();
  }, []);

  // Poll analysis status for templates in 'analyzing' state
  useEffect(() => {
    const analyzingTemplates = data.filter(t => t.analysis_status === 'analyzing');
    if (analyzingTemplates.length === 0) return;

    const interval = setInterval(async () => {
      for (const t of analyzingTemplates) {
        try {
          const res = await fetch(`/api/admin/templates/${t.id}/analysis-status`);
          if (res.ok) {
            const result = await res.json();
            if (result.status && result.status !== 'analyzing') {
              fetchData();
              break;
            }
          }
        } catch { /* ignore polling errors */ }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [data, fetchData]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function openCreateModal() {
    setEditingTemplate(null);
    setFormData({ name: '', description: '', category: '', genre_tags: '', price: 0, producer_id: '' });
    setCoverFile(null);
    setCoverPreview(null);
    setAudioFile(null);
    setAudioPreviewUrl(null);
    setAudioFiles([]);
    setAudioChanged(false);
    setUploadProgress(null);
    setFormOpen(true);
  }

  function openEditModal(template: TemplateItem) {
    setEditingTemplate(template);
    const genreTags = template.genre_tags?.length
      ? template.genre_tags.join(', ')
      : (template as any).genre || '';
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      genre_tags: genreTags,
      price: template.price || 0,
      producer_id: template.producer_id || '',
    });
    setCoverFile(null);
    setCoverPreview(template.cover_url || null);
    setAudioFile(null);
    setAudioPreviewUrl(template.preview_url || null);
    setAudioFiles([]);
    setAudioChanged(false);
    setUploadProgress(null);
    setFormOpen(true);
  }

  async function handleFormSubmit() {
    if (!formData.name.trim()) return;
    setSubmitting(true);
    setUploadProgress(null);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description,
        category: formData.category,
        genre_tags: formData.genre_tags.split(',').map((t) => t.trim()).filter(Boolean),
        price: formData.price,
        producer_id: formData.producer_id || null,
      };

      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate
        ? `/api/admin/templates/${editingTemplate.id}`
        : '/api/admin/templates';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '操作失败' }));
        throw new Error(err.error);
      }

      const result = await res.json();
      const templateId = editingTemplate?.id || result.data?.id;

      // Upload cover if selected
      if (coverFile && templateId) {
        setUploadProgress({ current: 0, total: 1, status: '上传封面...' });
        const coverFormData = new FormData();
        coverFormData.append('cover', coverFile);
        const coverRes = await fetch(`/api/admin/templates/${templateId}/cover`, {
          method: 'POST',
          body: coverFormData,
        });
        if (!coverRes.ok) {
          const coverErr = await coverRes.json().catch(() => ({ error: '封面上传失败' }));
          alert(`模板已保存，但封面上传失败: ${coverErr.error}`);
        }
      }

      // Upload audio files via signed URLs
      const filesToUpload = audioChanged
        ? (audioFiles.length > 0 ? audioFiles : (audioFile ? [audioFile] : []))
        : [];
      if (filesToUpload.length > 0 && templateId) {
        const analysisChoice = await requestAnalysisChoice();
        if (!analysisChoice) {
          setUploadProgress(null);
          return;
        }

        setUploadProgress({ current: 0, total: filesToUpload.length, status: '获取上传链接...' });

        // Get signed URLs
        const uploadUrlRes = await fetch(`/api/admin/templates/${templateId}/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: filesToUpload.map((f, i) => ({
              filename: f.name,
              contentType: f.type || 'audio/mpeg',
              index: i,
            })),
          }),
        });

        if (!uploadUrlRes.ok) {
          const uploadErr = await uploadUrlRes.json().catch(() => ({ error: '获取上传链接失败' }));
          throw new Error(uploadErr.error || '获取上传链接失败');
        }

        const { urls } = await uploadUrlRes.json();

        // Upload each file directly to storage via signed URL
        for (let i = 0; i < filesToUpload.length; i++) {
          setUploadProgress({ current: i + 1, total: filesToUpload.length, status: `上传音频 ${i + 1}/${filesToUpload.length}...` });
          const file = filesToUpload[i];
          const signedUrl = urls[i]?.signedUrl || urls[i]?.url;
          if (!signedUrl) throw new Error(`文件 ${i + 1} 未获得上传链接`);

          const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'audio/mpeg' },
            body: file,
          });
          if (!uploadRes.ok) {
            throw new Error(`音频文件 ${i + 1} 上传失败 (${uploadRes.status})`);
          }
        }

        setUploadProgress({ current: filesToUpload.length, total: filesToUpload.length, status: 'AI analyzing...' });

        try {
          const keyRes = await fetch('/api/admin/gemini-key');
          if (!keyRes.ok) throw new Error('Failed to get Gemini key');
          const { apiKey } = await keyRes.json();

          const audioBase64Files = await Promise.all(
            filesToUpload.map(async (file) => ({
              base64: await fileToBase64(file),
              mimeType: file.type || 'audio/mpeg',
            }))
          );

          const analysisTypes: AnalysisType[] = analysisChoice === 'both' ? ['suno', 'lyria3'] : [analysisChoice];

          for (const analysisType of analysisTypes) {
            setUploadProgress({ current: filesToUpload.length, total: filesToUpload.length, status: `Generating ${analysisType.toUpperCase()} analysis...` });
            const geminiResult = await callGeminiFromBrowser(apiKey, audioBase64Files, analysisType);

            setUploadProgress({ current: filesToUpload.length, total: filesToUpload.length, status: `Saving ${analysisType.toUpperCase()} analysis...` });
            const saveRes = await fetch(`/api/admin/templates/${templateId}/save-analysis`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                analysisType,
                analysisResult: geminiResult.analysisResult,
                lyriaPrompt: geminiResult.lyriaPrompt,
              }),
            });
            if (!saveRes.ok) {
              console.error(`Failed to save ${analysisType} analysis`);
            }
          }
        } catch (geminiErr) {
          console.error('Gemini 分析失败:', geminiErr);
          // Don't block the form submission if analysis fails
          alert(`音频已上传，但 AI 分析失败: ${geminiErr instanceof Error ? geminiErr.message : '未知错误'}`);
        }
      }

      setUploadProgress(null);
      setFormOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  function openStatusConfirm(id: string, status: string, name: string) {
    setConfirmAction({ id, status, name });
    setConfirmOpen(true);
  }

  async function handleStatusChange() {
    if (!confirmAction) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/admin/templates/${confirmAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: confirmAction.status }),
      });
      if (!res.ok) throw new Error('操作失败');
      setConfirmOpen(false);
      setConfirmAction(null);
      fetchData();
    } catch {
      alert('操作失败，请重试');
    } finally {
      setConfirming(false);
    }
  }

  const filterConfigs: FilterConfig[] = [
    { key: 'search', type: 'search', placeholder: '搜索模板名称...' },
    {
      key: 'category',
      type: 'select',
      placeholder: '所有分类',
      options: [
        { label: '免费模板', value: 'free_template' },
        { label: '付费模板', value: 'paid_template' },
        { label: 'Pop', value: 'Pop' },
        { label: 'Rock', value: 'Rock' },
        { label: 'Electronic', value: 'Electronic' },
        { label: 'Hip-Hop', value: 'Hip-Hop' },
        { label: 'R&B', value: 'R&B' },
      ],
    },
    {
      key: 'status',
      type: 'select',
      placeholder: '所有状态',
      options: [
        { label: '已发布', value: 'published' },
        { label: '待审核', value: 'pending' },
        { label: '已下架', value: 'unpublished' },
        { label: '已拒绝', value: 'rejected' },
      ],
    },
    {
      key: 'hasAudio',
      type: 'select',
      placeholder: '音频状态',
      options: [
        { label: '有音频', value: 'yes' },
        { label: '无音频', value: 'no' },
      ],
    },
  ];

  const columns: Column<TemplateItem>[] = [
    {
      key: 'name',
      title: '模板名称',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(135deg, #D4A574, #C9A86A)',
          }}>
            {row.cover_url && (
              <img
                src={row.cover_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 500, color: '#1f2937' }}>{row.name}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>ID: {row.id?.slice(0, 8)}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      title: '分类/风格',
      render: (row) => {
        const categoryLabelMap: Record<string, string> = {
          free_template: '免费模板',
          paid_template: '付费模板',
        };
        const displayCategory = categoryLabelMap[row.category] || row.category;
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {row.category && <Tag label={displayCategory} color="blue" />}
            {(row.genre_tags || []).slice(0, 2).map((t) => (
              <Tag key={t} label={t} color="purple" />
            ))}
          </div>
        );
      },
    },
    {
      key: 'price',
      title: '价格',
      render: (row) => <span>¥{((row.price || 0) / 100).toFixed(0)}</span>,
    },
    {
      key: 'sales_count',
      title: '销量',
      render: (row) => <span>{row.sales_count || 0}</span>,
    },
    {
      key: 'audio',
      title: '音频',
      render: (row) => (
        <Tag
          label={row.preview_url ? '有音频' : '无音频'}
          color={row.preview_url ? 'green' : 'gray'}
        />
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (row) => (
        <Tag
          label={statusLabelMap[row.status] || row.status}
          color={statusColorMap[row.status] || 'gray'}
        />
      ),
    },
    {
      key: 'created_at',
      title: '上传日期',
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {row.created_at ? new Date(row.created_at).toLocaleDateString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'analysis_status',
      title: '分析',
      render: (row) => {
        const s = row.analysis_status || 'pending';
        const sunoStatus = row.suno_analysis_status || 'pending';
        const labelMap: Record<string, string> = { completed: 'done', analyzing: 'running', failed: 'failed', pending: 'pending' };
        const colorMap: Record<string, 'green' | 'orange' | 'red' | 'gray'> = { completed: 'green', analyzing: 'orange', failed: 'red', pending: 'gray' };
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Tag label={`Lyria ${labelMap[s] || s}`} color={colorMap[s] || 'gray'} />
            <Tag label={`SUNO ${labelMap[sunoStatus] || sunoStatus}`} color={colorMap[sunoStatus] || 'gray'} />
          </div>
        );
      },
    },
    {
      key: 'actions',
      title: '操作',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => openEditModal(row)} style={actionBtnStyle}>编辑</button>
          {(row.analysis_status === 'completed' || row.suno_analysis_status === 'completed') && (
            <button onClick={() => { setAnalysisTemplate(row); setAnalysisOpen(true); }} style={{ ...actionBtnStyle, color: '#7c3aed' }}>分析</button>
          )}
          {row.status === 'published' && (
            <button onClick={() => openStatusConfirm(row.id, 'unpublished', row.name)} style={actionBtnStyle}>下架</button>
          )}
          {row.status === 'unpublished' && (
            <button onClick={() => openStatusConfirm(row.id, 'published', row.name)} style={actionBtnStyle}>重新上架</button>
          )}
          {row.status === 'pending' && (
            <>
              <button onClick={() => openStatusConfirm(row.id, 'published', row.name)} style={{ ...actionBtnStyle, color: '#16a34a' }}>通过</button>
              <button onClick={() => openStatusConfirm(row.id, 'rejected', row.name)} style={{ ...actionBtnStyle, color: '#dc2626' }}>拒绝</button>
            </>
          )}
        </div>
      ),
    },
  ];

  const confirmMessages: Record<string, { title: string; desc: string; variant: 'danger' | 'warning' | 'info' }> = {
    published: { title: '确认上架', desc: '确定要上架此模板吗？上架后用户可以浏览和购买。', variant: 'info' },
    unpublished: { title: '确认下架', desc: '确定要下架此模板吗？下架后用户将无法浏览和购买。', variant: 'warning' },
    rejected: { title: '确认拒绝', desc: '确定要拒绝此模板吗？拒绝后制作人将收到通知。', variant: 'danger' },
  };

  const confirmInfo = confirmAction ? confirmMessages[confirmAction.status] : null;

  return (
    <div>
      {/* Stats */}
      <div style={statsGridStyle}>
        <StatCard label="模板总数" value={stats.total} icon="🎵" iconColor="blue" />
        <StatCard label="已发布" value={stats.published} icon="✅" iconColor="green" />
        <StatCard label="待审核" value={stats.pending} icon="⏳" iconColor="orange" />
        <StatCard label="已下架" value={stats.unpublished} icon="📦" iconColor="red" />
      </div>

      {/* Filters */}
      <FilterBar
        filters={filterConfigs}
        values={filters}
        onChange={handleFilterChange}
        actions={
          <button onClick={openCreateModal} style={primaryBtnStyle}>添加模板</button>
        }
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        loading={loading}
      />

      {/* Form Modal */}
      <FormModal
        open={formOpen}
        title={editingTemplate ? '编辑模板' : '添加模板'}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        submitLabel={editingTemplate ? '保存' : '创建'}
        loading={submitting}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cover Image Upload */}
          <div>
            <label style={labelStyle}>封面图片</label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                border: '2px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: coverPreview ? undefined : '#fafafa',
              }}>
                {coverPreview ? (
                  <img src={coverPreview} alt="封面预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 24, color: '#d1d5db' }}>🖼️</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setCoverFile(file);
                      setCoverPreview(URL.createObjectURL(file));
                    }
                  }}
                  style={{ fontSize: 12, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}
                />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  支持 JPG、PNG、WebP，最大 5MB
                </div>
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>模板名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="输入模板名称"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="输入模板描述"
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            />
          </div>
          {/* Audio Upload - multi-file with progress */}
          <div>
            <label style={labelStyle}>参考音频（可多选）</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,.mp3,.wav,.ogg,.flac"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setAudioFiles(prev => [...prev, ...files]);
                    setAudioChanged(true);
                    // Also set single audioFile for backward compat
                    if (!audioFile) {
                      setAudioFile(files[0]);
                      setAudioPreviewUrl(URL.createObjectURL(files[0]));
                    }
                  }
                }}
                style={{ fontSize: 12, fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif" }}
              />
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                支持 MP3、WAV、OGG、FLAC，最大 20MB/文件，可选多个参考音频
              </div>
              {/* File list with players and delete buttons */}
              {audioFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {audioFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 8,
                      background: '#f9fafb', border: '1px solid #e5e7eb',
                    }}>
                      <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        🎵 {file.name} <span style={{ color: '#9ca3af' }}>({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                      </span>
                      <audio
                        controls
                        src={URL.createObjectURL(file)}
                        style={{ height: 28, maxWidth: 180 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAudioFiles(prev => prev.filter((_, i) => i !== idx));
                          if (audioFiles.length === 1) {
                            setAudioFile(null);
                            setAudioPreviewUrl(null);
                            setAudioChanged(false);
                          }
                        }}
                        style={{
                          border: 'none', background: '#fee2e2', color: '#dc2626',
                          borderRadius: 6, width: 24, height: 24, cursor: 'pointer',
                          fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Existing audio preview for edit mode */}
              {audioFiles.length === 0 && audioPreviewUrl && (
                <audio controls src={audioPreviewUrl} style={{ width: '100%', height: 36, marginTop: 4 }} />
              )}
              {/* Upload progress bar */}
              {uploadProgress && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#D4A574', fontWeight: 500, marginBottom: 4 }}>
                    {uploadProgress.status}
                  </div>
                  <div style={{
                    width: '100%', height: 6, borderRadius: 3,
                    background: '#f3f4f6', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                      height: '100%', borderRadius: 3,
                      background: 'linear-gradient(90deg, #D4A574, #C9A86A)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {uploadProgress.current}/{uploadProgress.total}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                style={inputStyle}
              >
                <option value="">请选择分类</option>
                <option value="free_template">免费模板</option>
                <option value="paid_template">付费模板</option>
                <option value="Pop">Pop</option>
                <option value="Rock">Rock</option>
                <option value="Electronic">Electronic</option>
                <option value="Hip-Hop">Hip-Hop</option>
                <option value="R&B">R&B</option>
                <option value="Jazz">Jazz</option>
                <option value="Classical">Classical</option>
                <option value="Lo-Fi">Lo-Fi</option>
                <option value="Country">Country</option>
                <option value="Folk">Folk</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>价格（分）</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData((p) => ({ ...p, price: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>模板归属</label>
            <select
              value={formData.producer_id}
              onChange={(e) => setFormData((p) => ({ ...p, producer_id: e.target.value }))}
              style={inputStyle}
            >
              <option value="">公共模板</option>
              {producers.map((producer) => (
                <option key={producer.id} value={producer.id}>
                  {producer.name || producer.email} {producer.email ? `(${producer.email})` : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              默认公共模板；选择制作人后，该模板会归属到对应制作人。
            </div>
          </div>
          <div>
            <label style={labelStyle}>风格标签（逗号分隔）</label>
            <input
              type="text"
              value={formData.genre_tags}
              onChange={(e) => setFormData((p) => ({ ...p, genre_tags: e.target.value }))}
              placeholder="如: 流行, 电子, 摇滚"
              style={inputStyle}
            />
          </div>
        </div>
      </FormModal>

      {analysisChoiceOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.62)', zIndex: 20000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }} onClick={() => resolveAnalysisChoice(null)}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
            padding: 24, boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#111827' }}>选择分析结果</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.7, color: '#6b7280' }}>
              上传音频后可以生成 SUNO、Lyria3，或两种都生成。两类结果会分别保存、分别查看。
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" onClick={() => resolveAnalysisChoice('suno')} style={choiceBtnStyle}>
                <strong>SUNO</strong>
                <span>1000 字符内，只分析编曲与制作，供 SUNO style 使用</span>
              </button>
              <button type="button" onClick={() => resolveAnalysisChoice('lyria3')} style={choiceBtnStyle}>
                <strong>Lyria3</strong>
                <span>保留原模板分析逻辑，供 Lyria3 模板提示词使用</span>
              </button>
              <button type="button" onClick={() => resolveAnalysisChoice('both')} style={{ ...choiceBtnStyle, borderColor: '#D4A574', background: '#fffbeb' }}>
                <strong>一起生成</strong>
                <span>SUNO 和 Lyria3 各生成一份，并分别保存</span>
              </button>
            </div>
            <button type="button" onClick={() => resolveAnalysisChoice(null)} style={{ ...actionBtnStyle, marginTop: 16 }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmInfo?.title || '确认操作'}
        description={confirmInfo?.desc || `确定要对"${confirmAction?.name}"执行此操作吗？`}
        variant={confirmInfo?.variant || 'warning'}
        confirmLabel="确认"
        onConfirm={handleStatusChange}
        onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
        loading={confirming}
      />

      {/* Analysis Result Modal */}
      {analysisOpen && analysisTemplate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }} onClick={() => setAnalysisOpen(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, maxWidth: 720, width: '100%',
            maxHeight: '80vh', overflow: 'auto', padding: 32,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>
                Analysis - {analysisTemplate.name}
              </h2>
              <button onClick={() => setAnalysisOpen(false)} style={{
                border: 'none', background: '#f3f4f6', borderRadius: 8,
                width: 32, height: 32, cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>x</button>
            </div>

            {analysisTemplate.analysis_result && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Lyria3 Analysis {renderCharacterCount(analysisTemplate.analysis_result)}
                </h3>
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb' }}>
                  {analysisTemplate.analysis_result}
                </div>
              </div>
            )}

            {analysisTemplate.lyria_prompt && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Lyria3 Prompt {renderCharacterCount(analysisTemplate.lyria_prompt)}
                </h3>
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, color: '#166534', fontFamily: 'monospace', border: '1px solid #bbf7d0', whiteSpace: 'pre-wrap' }}>
                  {analysisTemplate.lyria_prompt}
                </div>
              </div>
            )}

            {(analysisTemplate.suno_analysis_result || analysisTemplate.suno_prompt) && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>SUNO Analysis</h3>
                {analysisTemplate.suno_analysis_result && (
                  <>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      中文编曲分析 {renderCharacterCount(formatAnalysisForDisplay(analysisTemplate.suno_analysis_result))}
                    </div>
                    <div style={{ background: '#fff7ed', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.8, color: '#9a3412', whiteSpace: 'pre-wrap', border: '1px solid #fed7aa', marginBottom: 12 }}>
                      {formatAnalysisForDisplay(analysisTemplate.suno_analysis_result)}
                    </div>
                  </>
                )}
                {analysisTemplate.suno_prompt && (
                  <>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      SUNO style {renderCharacterCount(formatAnalysisForDisplay(analysisTemplate.suno_prompt), MAX_TEMPLATE_ANALYSIS_CHARS)}
                    </div>
                    <div style={{ background: '#fefce8', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, color: '#713f12', fontFamily: 'monospace', border: '1px solid #fde68a', whiteSpace: 'pre-wrap' }}>
                      {formatAnalysisForDisplay(analysisTemplate.suno_prompt)}
                    </div>
                  </>
                )}
              </div>
            )}

            {!analysisTemplate.analysis_result && !analysisTemplate.lyria_prompt && !analysisTemplate.suno_analysis_result && !analysisTemplate.suno_prompt && (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>No analysis yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
  marginBottom: 16,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  whiteSpace: 'nowrap',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  whiteSpace: 'nowrap',
};

const choiceBtnStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  textAlign: 'left',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  outline: 'none',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  boxSizing: 'border-box',
};
