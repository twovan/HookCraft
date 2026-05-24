'use client';

import { useCallback, useEffect, useState } from 'react';
import StatCard from '@/components/admin/StatCard';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';

interface GeneratedSong {
  id: string;
  batchId?: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  title?: string | null;
  authorName?: string | null;
  status: string;
  generationType: string;
  modelId: string;
  versionNumber?: number | null;
  durationSeconds?: number | null;
  creditsConsumed: number;
  prompt: string;
  batchPrompt: string;
  templateId?: string | null;
  templateName?: string | null;
  templateGenre?: string | null;
  styleTags: string[];
  usePremiumSinger: boolean;
  lyrics: string;
  songStructure: string;
  audioUrl?: string | null;
  audioPath?: string | null;
  rawAudioPath?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SongStats {
  totalSongs: number;
  completed: number;
  failed: number;
  generating: number;
  totalCredits: number;
}

const pageSize = 20;

export default function AdminGeneratedSongsPage() {
  const [data, setData] = useState<GeneratedSong[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedSong, setSelectedSong] = useState<GeneratedSong | null>(null);
  const [stats, setStats] = useState<SongStats>({
    totalSongs: 0,
    completed: 0,
    failed: 0,
    generating: 0,
    totalCredits: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const res = await fetch(`/api/admin/generated-songs?${params.toString()}`);
      if (!res.ok) throw new Error('request failed');
      const result = await res.json();
      setData(result.data || []);
      setTotal(result.total || 0);
      if (result.stats) setStats(result.stats);
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

  const filterConfigs: FilterConfig[] = [
    { key: 'search', type: 'search', placeholder: '搜索歌曲标题 / Prompt / 错误 / ID' },
    {
      key: 'status',
      type: 'select',
      placeholder: '全部状态',
      options: [
        { label: '已完成', value: 'completed' },
        { label: '生成中', value: 'generating' },
        { label: '等待中', value: 'pending' },
        { label: '失败', value: 'failed' },
        { label: '已选中', value: 'selected' },
        { label: '已归档', value: 'archived' },
      ],
    },
    {
      key: 'generationType',
      type: 'select',
      placeholder: '全部模型类型',
      options: [
        { label: '预览', value: 'preview' },
        { label: '完整 Demo', value: 'full_demo' },
        { label: '模板编曲', value: 'arrangement' },
      ],
    },
  ];

  const columns: Column<GeneratedSong>[] = [
    {
      key: 'song',
      title: '歌曲',
      width: 260,
      render: (row) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>
            {row.title || '未命名歌曲'}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
            {row.id.slice(0, 10)}... {row.versionNumber ? `v${row.versionNumber}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      title: '用户',
      width: 190,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.userName}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{row.userEmail || row.userId.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      key: 'template',
      title: '模板/类型',
      render: (row) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Tag label={formatGenerationType(row.generationType)} color="blue" />
          {row.templateName && <Tag label={row.templateName} color="purple" />}
        </div>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (row) => {
        const status = getStatusMeta(row.status);
        return <Tag label={status.label} color={status.color} />;
      },
    },
    {
      key: 'duration',
      title: '时长',
      render: (row) => <span>{formatDuration(row.durationSeconds)}</span>,
    },
    {
      key: 'lyrics',
      title: '歌词',
      render: (row) => <span>{row.lyrics ? `${Array.from(row.lyrics).length} 字符` : '-'}</span>,
    },
    {
      key: 'createdAt',
      title: '生成时间',
      width: 150,
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {new Date(row.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (row) => (
        <button type="button" onClick={() => setSelectedSong(row)} style={actionBtnStyle}>
          查看
        </button>
      ),
    },
  ];

  return (
    <div>
      <div style={statsGridStyle}>
        <StatCard label="歌曲总数" value={stats.totalSongs} icon="♪" iconColor="blue" />
        <StatCard label="已完成" value={stats.completed} icon="✓" iconColor="green" />
        <StatCard label="生成中" value={stats.generating} icon="…" iconColor="orange" />
        <StatCard label="失败" value={stats.failed} icon="!" iconColor="red" />
      </div>

      <FilterBar filters={filterConfigs} values={filters} onChange={handleFilterChange} />

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        loading={loading}
      />

      {selectedSong && (
        <SongDetailModal song={selectedSong} onClose={() => setSelectedSong(null)} />
      )}
    </div>
  );
}

function SongDetailModal({ song, onClose }: { song: GeneratedSong; onClose: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>{song.title || '未命名歌曲'}</h3>
            <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
              {song.userName} · {new Date(song.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>x</button>
        </div>

        <div style={detailGridStyle}>
          <Info label="任务 ID" value={song.id} mono />
          <Info label="批次 ID" value={song.batchId || '-'} mono />
          <Info label="用户 ID" value={song.userId} mono />
          <Info label="用户邮箱" value={song.userEmail || '-'} />
          <Info label="状态" value={getStatusMeta(song.status).label} />
          <Info label="类型" value={formatGenerationType(song.generationType)} />
          <Info label="模型" value={song.modelId || '-'} />
          <Info label="版本" value={song.versionNumber ? `v${song.versionNumber}` : '-'} />
          <Info label="时长" value={formatDuration(song.durationSeconds)} />
          <Info label="消耗积分" value={String(song.creditsConsumed || 0)} />
          <Info label="模板" value={song.templateName || '-'} />
          <Info label="高级歌手" value={song.usePremiumSinger ? '是' : '否'} />
        </div>

        {song.audioUrl && (
          <section style={sectionStyle}>
            <h4 style={sectionTitleStyle}>音频</h4>
            <audio controls src={song.audioUrl} style={{ width: '100%', height: 38 }} />
          </section>
        )}

        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>生成参数</h4>
          <div style={textBoxStyle}>{song.prompt || song.batchPrompt || '无 Prompt'}</div>
          {song.styleTags?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {song.styleTags.map((tag) => <Tag key={tag} label={tag} color="purple" />)}
            </div>
          )}
        </section>

        {song.songStructure && (
          <section style={sectionStyle}>
            <h4 style={sectionTitleStyle}>歌曲结构</h4>
            <div style={textBoxStyle}>{song.songStructure}</div>
          </section>
        )}

        <section style={sectionStyle}>
          <h4 style={sectionTitleStyle}>歌词 {song.lyrics ? `(${Array.from(song.lyrics).length} 字符)` : ''}</h4>
          <div style={{ ...textBoxStyle, maxHeight: 280, overflow: 'auto' }}>
            {song.lyrics || '暂无歌词'}
          </div>
        </section>

        {(song.errorMessage || song.errorCode) && (
          <section style={sectionStyle}>
            <h4 style={{ ...sectionTitleStyle, color: '#dc2626' }}>失败信息</h4>
            <div style={{ ...textBoxStyle, color: '#991b1b', background: '#fef2f2', borderColor: '#fecaca' }}>
              {song.errorCode ? `[${song.errorCode}] ` : ''}{song.errorMessage || '-'}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={infoItemStyle}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 13,
        color: '#1f2937',
        fontFamily: mono ? 'monospace' : "'PingFang SC', 'Microsoft YaHei', sans-serif",
        overflowWrap: 'anywhere',
      }}>
        {value}
      </div>
    </div>
  );
}

function getStatusMeta(status: string): { label: string; color: 'green' | 'orange' | 'red' | 'blue' | 'gray' } {
  const map: Record<string, { label: string; color: 'green' | 'orange' | 'red' | 'blue' | 'gray' }> = {
    completed: { label: '已完成', color: 'green' },
    selected: { label: '已选中', color: 'green' },
    generating: { label: '生成中', color: 'blue' },
    building_prompt: { label: '构建 Prompt', color: 'blue' },
    pending: { label: '等待中', color: 'orange' },
    failed: { label: '失败', color: 'red' },
    archived: { label: '已归档', color: 'gray' },
  };
  return map[status] || { label: status || '未知', color: 'gray' };
}

function formatGenerationType(type: string) {
  const map: Record<string, string> = {
    preview: '预览',
    full_demo: '完整 Demo',
    arrangement: '模板编曲',
  };
  return map[type] || type || '-';
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16,
  marginBottom: 16,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#7c3aed',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
};

const modalStyle: React.CSSProperties = {
  width: 'min(980px, 96vw)',
  maxHeight: '88vh',
  overflowY: 'auto',
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
  padding: 24,
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  paddingBottom: 16,
  borderBottom: '1px solid #e5e7eb',
  marginBottom: 16,
};

const closeBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: 'none',
  borderRadius: 8,
  background: '#f3f4f6',
  color: '#6b7280',
  cursor: 'pointer',
  fontSize: 16,
};

const detailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 10,
};

const infoItemStyle: React.CSSProperties = {
  border: '1px solid #eef0f3',
  borderRadius: 10,
  padding: '10px 12px',
  background: '#fafafa',
  minWidth: 0,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 14,
  color: '#374151',
  fontWeight: 700,
};

const textBoxStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  background: '#f9fafb',
  color: '#374151',
  padding: 14,
  fontSize: 13,
  lineHeight: 1.75,
  whiteSpace: 'pre-wrap',
};
