'use client';

import { useEffect, useState, useCallback } from 'react';
import FormModal from '@/components/admin/FormModal';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import type { SensitiveWordEntry, SensitiveWordCategory } from '@/types/sensitivity';

/** 分类标签映射 */
const CATEGORY_LABELS: Record<SensitiveWordCategory | 'all', string> = {
  all: '全部',
  celebrity: '明星名字',
  song_name: '歌曲名称',
  forbidden: '违禁词',
};

const CATEGORY_OPTIONS: SensitiveWordCategory[] = ['celebrity', 'song_name', 'forbidden'];

export default function AdminSensitiveWordsPage() {
  // 列表数据
  const [words, setWords] = useState<SensitiveWordEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选与分页
  const [currentCategory, setCurrentCategory] = useState<SensitiveWordCategory | 'all'>('all');
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const pageSize = 20;

  // 新增/编辑弹窗
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<SensitiveWordEntry | null>(null);
  const [formWord, setFormWord] = useState('');
  const [formCategory, setFormCategory] = useState<SensitiveWordCategory>('celebrity');
  const [formVariants, setFormVariants] = useState('');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 删除确认
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingWord, setDeletingWord] = useState<SensitiveWordEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 批量导入弹窗
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchCategory, setBatchCategory] = useState<SensitiveWordCategory>('celebrity');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // 展开查看缓存改写
  const [expandedCacheId, setExpandedCacheId] = useState<string | null>(null);

  /** 获取敏感词列表 */
  const fetchWords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (currentCategory !== 'all') {
        params.set('category', currentCategory);
      }
      if (searchText) {
        params.set('search', searchText);
      }
      const res = await fetch(`/api/admin/sensitive-words?${params.toString()}`);
      if (!res.ok) throw new Error('请求失败');
      const data = await res.json();
      setWords(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, currentCategory, searchText]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  /** 切换分类筛选 */
  function handleCategoryChange(cat: SensitiveWordCategory | 'all') {
    setCurrentCategory(cat);
    setPage(1);
  }

  /** 打开新增弹窗 */
  function openCreateModal() {
    setEditingWord(null);
    setFormWord('');
    setFormCategory('celebrity');
    setFormVariants('');
    setFormNote('');
    setFormModalOpen(true);
  }

  /** 打开编辑弹窗 */
  function openEditModal(item: SensitiveWordEntry) {
    setEditingWord(item);
    setFormWord(item.word);
    setFormCategory(item.category);
    setFormVariants(item.variants.join(', '));
    setFormNote(item.note || '');
    setFormModalOpen(true);
  }

  /** 提交新增/编辑 */
  async function handleFormSubmit() {
    if (!formWord.trim()) return;
    setSubmitting(true);
    try {
      const variants = formVariants
        .split(/[,，]/)
        .map((v) => v.trim())
        .filter(Boolean);

      const body = {
        word: formWord.trim(),
        category: formCategory,
        variants,
        note: formNote.trim(),
      };

      const url = editingWord
        ? `/api/admin/sensitive-words/${editingWord.id}`
        : '/api/admin/sensitive-words';
      const method = editingWord ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '操作失败' }));
        throw new Error(err.error);
      }

      setFormModalOpen(false);
      fetchWords();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  /** 打开删除确认 */
  function openDeleteConfirm(item: SensitiveWordEntry) {
    setDeletingWord(item);
    setDeleteConfirmOpen(true);
  }

  /** 确认删除 */
  async function handleDelete() {
    if (!deletingWord) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/sensitive-words/${deletingWord.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('删除失败');
      setDeleteConfirmOpen(false);
      setDeletingWord(null);
      fetchWords();
    } catch {
      alert('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  }

  /** 打开批量导入弹窗 */
  function openBatchModal() {
    setBatchText('');
    setBatchCategory('celebrity');
    setBatchModalOpen(true);
  }

  /** 提交批量导入 */
  async function handleBatchSubmit() {
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setBatchSubmitting(true);
    try {
      const wordsPayload = lines.map((word) => ({
        word,
        category: batchCategory,
      }));

      const res = await fetch('/api/admin/sensitive-words/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: wordsPayload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '导入失败' }));
        throw new Error(err.error);
      }

      const result = await res.json();
      alert(`导入完成：成功 ${result.imported} 条，跳过 ${result.skipped} 条（重复）`);
      setBatchModalOpen(false);
      fetchWords();
    } catch (err) {
      alert(err instanceof Error ? err.message : '导入失败');
    } finally {
      setBatchSubmitting(false);
    }
  }

  /** 格式化时间 */
  function formatTime(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** 总页数 */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 加载中
  if (loading && words.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <span style={{ color: '#6b7280', fontSize: 14 }}>加载中...</span>
      </div>
    );
  }

  // 错误
  if (error && words.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12 }}>
        <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
        <button onClick={fetchWords} style={retryBtnStyle}>重试</button>
      </div>
    );
  }

  return (
    <div>
      {/* 顶部操作栏 */}
      <div style={cardStyle}>
        <div style={toolbarStyle}>
          {/* 分类筛选 */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(Object.keys(CATEGORY_LABELS) as Array<SensitiveWordCategory | 'all'>).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                style={{
                  ...tabBtnStyle,
                  ...(currentCategory === cat ? tabBtnActiveStyle : {}),
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          {/* 搜索 + 操作按钮 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <form onSubmit={(e) => { e.preventDefault(); setSearchText(searchInput); setPage(1); }} style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索敏感词..."
                style={{ ...inputStyle, width: 160, padding: '6px 12px', fontSize: 12 }}
              />
              <button type="submit" style={secondaryBtnStyle}>搜索</button>
              {searchText && (
                <button type="button" onClick={() => { setSearchInput(''); setSearchText(''); setPage(1); }} style={{ ...secondaryBtnStyle, color: '#9ca3af' }}>清除</button>
              )}
            </form>
            <button onClick={openBatchModal} style={secondaryBtnStyle}>批量导入</button>
            <button onClick={openCreateModal} style={addBtnStyle}>+ 新增敏感词</button>
          </div>
        </div>

        {/* 表格 */}
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>敏感词</th>
              <th style={thStyle}>分类</th>
              <th style={thStyle}>变体词</th>
              <th style={thStyle}>缓存改写</th>
              <th style={thStyle}>命中次数</th>
              <th style={thStyle}>最近命中时间</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {words.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', padding: '40px 16px' }}>
                  暂无敏感词数据
                </td>
              </tr>
            ) : (
              words.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500 }}>{item.word}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      ...categoryBadgeStyle,
                      background: categoryColors[item.category]?.bg || '#f3f4f6',
                      color: categoryColors[item.category]?.text || '#374151',
                    }}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>
                      {item.variants.length > 0 ? item.variants.join(', ') : '-'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {item.cachedRewrite ? (
                      <div>
                        <button
                          onClick={() => setExpandedCacheId(expandedCacheId === item.id ? null : item.id)}
                          style={{
                            ...categoryBadgeStyle,
                            background: '#f0fdf4',
                            color: '#16a34a',
                            cursor: 'pointer',
                            border: 'none',
                            fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
                          }}
                        >
                          已缓存 {expandedCacheId === item.id ? '▲' : '▼'}
                        </button>
                        {expandedCacheId === item.id && (
                          <div style={{
                            marginTop: 8,
                            padding: '8px 10px',
                            background: '#f9fafb',
                            borderRadius: 6,
                            border: '1px solid #e5e7eb',
                            fontSize: 11,
                            lineHeight: 1.6,
                          }}>
                            <div style={{ marginBottom: 4 }}>
                              <strong>改写提示词:</strong>{' '}
                              <span style={{ color: '#6b7280' }}>
                                {item.cachedRewrite.rewrittenPrompt.length > 80
                                  ? item.cachedRewrite.rewrittenPrompt.slice(0, 80) + '...'
                                  : item.cachedRewrite.rewrittenPrompt}
                              </span>
                            </div>
                            {item.cachedRewrite.styleTags && item.cachedRewrite.styleTags.length > 0 && (
                              <div style={{ marginBottom: 4 }}>
                                <strong>Style Tags:</strong>{' '}
                                <span style={{ color: '#6b7280' }}>{item.cachedRewrite.styleTags.join(', ')}</span>
                              </div>
                            )}
                            {item.cachedRewrite.styleTagsCn && item.cachedRewrite.styleTagsCn.length > 0 && (
                              <div>
                                <strong>中文标签:</strong>{' '}
                                <span style={{ color: '#6b7280' }}>{item.cachedRewrite.styleTagsCn.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>-</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500 }}>{item.hitCount}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>
                      {formatTime(item.lastHitAt)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEditModal(item)} style={actionBtnStyle}>编辑</button>
                      <button onClick={() => openDeleteConfirm(item)} style={actionBtnDangerStyle}>删除</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 分页 */}
        {total > 0 && (
          <div style={paginationStyle}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              共 {total} 条，第 {page}/{totalPages} 页
            </span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                style={{ ...pageBtnStyle, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                首页
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ ...pageBtnStyle, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                上一页
              </button>
              {/* 页码按钮 */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) { pageNum = i + 1; }
                else if (page <= 3) { pageNum = i + 1; }
                else if (page >= totalPages - 2) { pageNum = totalPages - 4 + i; }
                else { pageNum = page - 2 + i; }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    style={{
                      ...pageBtnStyle,
                      background: pageNum === page ? '#D4A574' : '#fff',
                      color: pageNum === page ? '#fff' : '#374151',
                      borderColor: pageNum === page ? '#D4A574' : '#e5e7eb',
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ ...pageBtnStyle, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                下一页
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                style={{ ...pageBtnStyle, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                末页
              </button>
              {/* 跳转 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = parseInt(jumpPage, 10);
                  if (!isNaN(target) && target >= 1 && target <= totalPages) {
                    setPage(target);
                  }
                  setJumpPage('');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}
              >
                <span style={{ fontSize: 12, color: '#6b7280' }}>跳至</span>
                <input
                  type="text"
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  style={{ width: 40, padding: '4px 6px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 12, textAlign: 'center' }}
                />
                <span style={{ fontSize: 12, color: '#6b7280' }}>页</span>
                <button type="submit" style={{ ...pageBtnStyle, fontSize: 11 }}>GO</button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      <FormModal
        open={formModalOpen}
        title={editingWord ? '编辑敏感词' : '新增敏感词'}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        submitLabel={editingWord ? '保存' : '创建'}
        loading={submitting}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>敏感词 *</label>
            <input
              type="text"
              value={formWord}
              onChange={(e) => setFormWord(e.target.value)}
              placeholder="输入敏感词内容"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>分类 *</label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as SensitiveWordCategory)}
              style={inputStyle}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>变体词（逗号分隔）</label>
            <input
              type="text"
              value={formVariants}
              onChange={(e) => setFormVariants(e.target.value)}
              placeholder="例如：燕姿, Yanzi, 孙燕姿的歌"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <input
              type="text"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="备注说明（可选）"
              style={inputStyle}
            />
          </div>
        </div>
      </FormModal>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="删除确认"
        description={`确定要删除敏感词"${deletingWord?.word}"吗？删除后将无法恢复。`}
        variant="danger"
        confirmLabel="删除"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteConfirmOpen(false); setDeletingWord(null); }}
        loading={deleting}
      />

      {/* 批量导入弹窗 */}
      <FormModal
        open={batchModalOpen}
        title="批量导入敏感词"
        onClose={() => setBatchModalOpen(false)}
        onSubmit={handleBatchSubmit}
        submitLabel="导入"
        loading={batchSubmitting}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>分类 *</label>
            <select
              value={batchCategory}
              onChange={(e) => setBatchCategory(e.target.value as SensitiveWordCategory)}
              style={inputStyle}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>敏感词列表（每行一个）*</label>
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={'周杰伦\n孙燕姿\n林俊杰\n...'}
              rows={10}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 160 }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            提示：每行输入一个敏感词，重复的词将自动跳过。单次最多导入 500 条。
          </div>
        </div>
      </FormModal>
    </div>
  );
}

// ============ 样式 ============

const categoryColors: Record<SensitiveWordCategory, { bg: string; text: string }> = {
  celebrity: { bg: '#eff6ff', text: '#2563eb' },
  song_name: { bg: '#f0fdf4', text: '#16a34a' },
  forbidden: { bg: '#fef2f2', text: '#dc2626' },
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
  overflow: 'hidden',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #f3f4f6',
  flexWrap: 'wrap',
  gap: 12,
};

const tabBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#6b7280',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const tabBtnActiveStyle: React.CSSProperties = {
  background: '#D4A574',
  color: '#fff',
  borderColor: '#D4A574',
};

const addBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  borderBottom: '1px solid #f3f4f6',
  background: '#fafafa',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f3f4f6',
  color: '#374151',
  fontSize: 13,
};

const categoryBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 500,
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
};

const actionBtnDangerStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #fecaca',
  background: '#fff',
  color: '#dc2626',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 20px',
  borderTop: '1px solid #f3f4f6',
};

const pageBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const retryBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#D4A574',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
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
