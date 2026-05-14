'use client';

import { useState, useEffect, useCallback } from 'react';
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
  producer_id: string;
  price: number;
  sales_count: number;
  status: string;
  created_at: string;
  cover_url?: string;
  preview_url?: string;
  analysis_status?: string;
  analysis_result?: string;
  lyria_prompt?: string;
}

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

export default function AdminTemplatesPage() {
  const [data, setData] = useState<TemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 10;

  // Stats
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, unpublished: 0 });

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', category: '', genre_tags: '', price: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Analysis modal
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisTemplate, setAnalysisTemplate] = useState<TemplateItem | null>(null);

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

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function openCreateModal() {
    setEditingTemplate(null);
    setFormData({ name: '', description: '', category: '', genre_tags: '', price: 0 });
    setCoverFile(null);
    setCoverPreview(null);
    setAudioFile(null);
    setAudioPreviewUrl(null);
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
    });
    setCoverFile(null);
    setCoverPreview(template.cover_url || null);
    setAudioFile(null);
    setAudioPreviewUrl(template.preview_url || null);
    setFormOpen(true);
  }

  async function handleFormSubmit() {
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description,
        category: formData.category,
        genre_tags: formData.genre_tags.split(',').map((t) => t.trim()).filter(Boolean),
        price: formData.price,
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

      // Upload audio if selected
      if (audioFile && templateId) {
        const audioFormData = new FormData();
        audioFormData.append('audio', audioFile);
        const audioRes = await fetch(`/api/admin/templates/${templateId}/audio`, {
          method: 'POST',
          body: audioFormData,
        });
        if (!audioRes.ok) {
          const audioErr = await audioRes.json().catch(() => ({ error: '音频上传失败' }));
          alert(`模板已保存，但音频上传失败: ${audioErr.error}`);
        }
      }

      setFormOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
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
      render: (row) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {row.category && <Tag label={row.category} color="blue" />}
          {(row.genre_tags || []).slice(0, 2).map((t) => (
            <Tag key={t} label={t} color="purple" />
          ))}
        </div>
      ),
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
        const labelMap: Record<string, string> = { completed: '已完成', analyzing: '分析中', failed: '失败', pending: '待分析' };
        const colorMap: Record<string, 'green' | 'orange' | 'red' | 'gray'> = { completed: 'green', analyzing: 'orange', failed: 'red', pending: 'gray' };
        return <Tag label={labelMap[s] || s} color={colorMap[s] || 'gray'} />;
      },
    },
    {
      key: 'actions',
      title: '操作',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => openEditModal(row)} style={actionBtnStyle}>编辑</button>
          {row.analysis_status === 'completed' && (
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
                  style={{ fontSize: 12, fontFamily: "'Inter', sans-serif" }}
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
          {/* Audio Upload - moved up for visibility */}
          <div>
            <label style={labelStyle}>试听音频</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,.mp3,.wav,.ogg,.flac"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAudioFile(file);
                    setAudioPreviewUrl(URL.createObjectURL(file));
                  }
                }}
                style={{ fontSize: 12, fontFamily: "'Inter', sans-serif" }}
              />
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                支持 MP3、WAV、OGG、FLAC，最大 20MB
              </div>
              {audioPreviewUrl && (
                <audio controls src={audioPreviewUrl} style={{ width: '100%', height: 36, marginTop: 4 }} />
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>分类</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                placeholder="如: Pop, Rock"
                style={inputStyle}
              />
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
            background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%',
            maxHeight: '80vh', overflow: 'auto', padding: 32,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>
                分析结果 — {analysisTemplate.name}
              </h2>
              <button onClick={() => setAnalysisOpen(false)} style={{
                border: 'none', background: '#f3f4f6', borderRadius: 8,
                width: 32, height: 32, cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            {analysisTemplate.analysis_result ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>📊 AI 分析</h3>
                  <button onClick={() => { navigator.clipboard.writeText(analysisTemplate.analysis_result || ''); }} style={{
                    border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 6,
                    padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#6b7280',
                  }}>复制</button>
                </div>
                <div style={{
                  background: '#f9fafb', borderRadius: 10, padding: 16,
                  fontSize: 13, lineHeight: 1.8, color: '#374151',
                  whiteSpace: 'pre-wrap', border: '1px solid #e5e7eb',
                }}>
                  {analysisTemplate.analysis_result}
                </div>
              </div>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 24 }}>暂无分析结果</div>
            )}

            {analysisTemplate.lyria_prompt && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>🎵 Lyria Prompt</h3>
                  <button onClick={() => { navigator.clipboard.writeText(analysisTemplate.lyria_prompt || ''); }} style={{
                    border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 6,
                    padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#166534',
                  }}>复制</button>
                </div>
                <div style={{
                  background: '#f0fdf4', borderRadius: 10, padding: 16,
                  fontSize: 13, lineHeight: 1.6, color: '#166534',
                  fontFamily: 'monospace', border: '1px solid #bbf7d0',
                  whiteSpace: 'pre-wrap',
                }}>
                  {analysisTemplate.lyria_prompt}
                </div>
              </div>
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
  fontFamily: "'Inter', sans-serif",
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
  fontFamily: "'Inter', sans-serif",
  whiteSpace: 'nowrap',
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
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
};
