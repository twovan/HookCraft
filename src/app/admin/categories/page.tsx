'use client';

import { useEffect, useState, useCallback } from 'react';
import FormModal from '@/components/admin/FormModal';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  templateCount: number;
  createdAt: string;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [tags, setTags] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'tag'>('category');
  const [editingItem, setEditingItem] = useState<CategoryItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Toggle confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleItem, setToggleItem] = useState<{ item: CategoryItem; type: 'category' | 'tag' } | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/admin/categories'),
        fetch('/api/admin/tags'),
      ]);
      if (!catRes.ok || !tagRes.ok) throw new Error('请求失败');
      const catData = await catRes.json();
      const tagData = await tagRes.json();
      setCategories(catData.data || []);
      setTags(tagData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreateModal(type: 'category' | 'tag') {
    setModalType(type);
    setEditingItem(null);
    setFormName('');
    setFormIcon('');
    setModalOpen(true);
  }

  function openEditModal(item: CategoryItem, type: 'category' | 'tag') {
    setModalType(type);
    setEditingItem(item);
    setFormName(item.name);
    setFormIcon(item.icon);
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      const endpoint = modalType === 'category' ? '/api/admin/categories' : '/api/admin/tags';
      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `${endpoint}/${editingItem.id}` : endpoint;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), icon: formIcon }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '操作失败' }));
        throw new Error(err.error);
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  function openToggleConfirm(item: CategoryItem, type: 'category' | 'tag') {
    setToggleItem({ item, type });
    setConfirmOpen(true);
  }

  async function handleToggle() {
    if (!toggleItem) return;
    setToggling(true);
    try {
      const endpoint = toggleItem.type === 'category' ? '/api/admin/categories' : '/api/admin/tags';
      const res = await fetch(`${endpoint}/${toggleItem.item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !toggleItem.item.enabled }),
      });
      if (!res.ok) throw new Error('操作失败');
      setConfirmOpen(false);
      setToggleItem(null);
      fetchData();
    } catch {
      alert('操作失败，请重试');
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <span style={{ color: '#6b7280', fontSize: 14 }}>加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12 }}>
        <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
        <button onClick={fetchData} style={retryBtnStyle}>重试</button>
      </div>
    );
  }

  return (
    <div>
      <div style={gridStyle}>
        {/* Categories Table */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>模板类型</span>
            <button onClick={() => openCreateModal('category')} style={addBtnStyle}>+ 添加类型</button>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>名称</th>
                <th style={thStyle}>模板数</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>暂无分类</td></tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={tdStyle}>
                      <span>{cat.icon} {cat.name}</span>
                    </td>
                    <td style={tdStyle}>{cat.templateCount}</td>
                    <td style={tdStyle}>
                      <span style={{
                        ...statusDotStyle,
                        background: cat.enabled ? '#22c55e' : '#9ca3af',
                      }} />
                      {cat.enabled ? '启用' : '禁用'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openEditModal(cat, 'category')} style={actionBtnStyle}>编辑</button>
                        <button onClick={() => openToggleConfirm(cat, 'category')} style={actionBtnStyle}>
                          {cat.enabled ? '禁用' : '启用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Tags Table */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>风格标签</span>
            <button onClick={() => openCreateModal('tag')} style={addBtnStyle}>+ 添加风格</button>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>名称</th>
                <th style={thStyle}>模板数</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {tags.length === 0 ? (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>暂无标签</td></tr>
              ) : (
                tags.map((tag) => (
                  <tr key={tag.id}>
                    <td style={tdStyle}>
                      <span>{tag.icon} {tag.name}</span>
                    </td>
                    <td style={tdStyle}>{tag.templateCount}</td>
                    <td style={tdStyle}>
                      <span style={{
                        ...statusDotStyle,
                        background: tag.enabled ? '#22c55e' : '#9ca3af',
                      }} />
                      {tag.enabled ? '启用' : '禁用'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openEditModal(tag, 'tag')} style={actionBtnStyle}>编辑</button>
                        <button onClick={() => openToggleConfirm(tag, 'tag')} style={actionBtnStyle}>
                          {tag.enabled ? '禁用' : '启用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <FormModal
        open={modalOpen}
        title={editingItem
          ? `编辑${modalType === 'category' ? '类型' : '风格'}`
          : `添加${modalType === 'category' ? '类型' : '风格'}`
        }
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitLabel={editingItem ? '保存' : '创建'}
        loading={submitting}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>名称 *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={`输入${modalType === 'category' ? '类型' : '风格'}名称`}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>图标（可选）</label>
            <input
              type="text"
              value={formIcon}
              onChange={(e) => setFormIcon(e.target.value)}
              placeholder="输入 emoji 图标"
              style={inputStyle}
            />
          </div>
        </div>
      </FormModal>

      {/* Toggle Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={toggleItem?.item.enabled ? '禁用确认' : '启用确认'}
        description={toggleItem?.item.enabled
          ? `确定要禁用"${toggleItem?.item.name}"吗？禁用后相关模板将不再显示此分类。`
          : `确定要启用"${toggleItem?.item.name}"吗？`
        }
        variant={toggleItem?.item.enabled ? 'warning' : 'info'}
        confirmLabel={toggleItem?.item.enabled ? '禁用' : '启用'}
        onConfirm={handleToggle}
        onCancel={() => { setConfirmOpen(false); setToggleItem(null); }}
        loading={toggling}
      />
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 24,
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
  overflow: 'hidden',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #f3f4f6',
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

const statusDotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  marginRight: 6,
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
