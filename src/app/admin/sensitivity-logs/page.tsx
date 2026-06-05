'use client';

import { useState, useEffect, useCallback } from 'react';
import DataTable, { Column } from '@/components/admin/DataTable';
import FilterBar, { FilterConfig } from '@/components/admin/FilterBar';
import Tag from '@/components/admin/Tag';
import type { SensitivityLog, SensitivityResultType, DetectedWord } from '@/types/sensitivity';

export default function SensitivityLogsPage() {
  const [data, setData] = useState<SensitivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (filters.resultType) {
        params.set('resultType', filters.resultType);
      }

      const res = await fetch(`/api/admin/sensitivity-logs?${params.toString()}`);
      if (!res.ok) throw new Error('请求失败');
      const result = await res.json();
      const logs = result.data || [];
      setData(logs);
      // 服务端不返回 total，根据返回数据量估算
      // 如果返回的数据量等于 pageSize，说明可能还有更多数据
      if (logs.length === pageSize) {
        setTotal(page * pageSize + 1); // 至少还有下一页
      } else {
        setTotal((page - 1) * pageSize + logs.length);
      }
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const filterConfigs: FilterConfig[] = [
    {
      key: 'resultType',
      type: 'select',
      placeholder: '检测结果',
      options: [
        { label: '通过 (pass)', value: 'pass' },
        { label: '改写 (rewrite)', value: 'rewrite' },
        { label: '拦截 (block)', value: 'block' },
      ],
    },
  ];

  const resultTypeConfig: Record<SensitivityResultType, { label: string; color: 'green' | 'orange' | 'red' }> = {
    pass: { label: '通过', color: 'green' },
    rewrite: { label: '改写', color: 'orange' },
    block: { label: '拦截', color: 'red' },
  };

  function truncateText(text: string | null | undefined, maxLen: number): string {
    if (!text) return '-';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }

  function formatDuration(ms: number | null): string {
    if (ms === null || ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function formatUserConfirmed(confirmed: boolean | null, resultType: SensitivityResultType): string {
    if (resultType === 'pass') return '-';
    if (resultType === 'block') return '已拦截';
    if (confirmed === null) return '未操作';
    return confirmed ? '已确认' : '已取消';
  }

  const columns: Column<SensitivityLog>[] = [
    {
      key: 'createdAt',
      title: '时间',
      width: 160,
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {new Date(row.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'inputDescription',
      title: '创作描述',
      render: (row) => (
        <span style={{ fontSize: 13 }} title={row.inputDescription}>
          {truncateText(row.inputDescription, 30)}
        </span>
      ),
    },
    {
      key: 'inputLyrics',
      title: '歌词',
      render: (row) => (
        <span style={{ fontSize: 13, color: row.inputLyrics ? '#374151' : '#9ca3af' }} title={row.inputLyrics || undefined}>
          {truncateText(row.inputLyrics, 20)}
        </span>
      ),
    },
    {
      key: 'resultType',
      title: '检测结果',
      width: 80,
      render: (row) => {
        const config = resultTypeConfig[row.resultType] || { label: row.resultType, color: 'gray' as const };
        return <Tag label={config.label} color={config.color} />;
      },
    },
    {
      key: 'detectionSource',
      title: '检测来源',
      width: 90,
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {row.detectionSource || '-'}
        </span>
      ),
    },
    {
      key: 'durationMs',
      title: '耗时',
      width: 70,
      render: (row) => (
        <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
          {formatDuration(row.durationMs)}
        </span>
      ),
    },
    {
      key: 'userConfirmed',
      title: '用户确认',
      width: 80,
      render: (row) => {
        const text = formatUserConfirmed(row.userConfirmed, row.resultType);
        let color = '#6b7280';
        if (text === '已确认') color = '#16a34a';
        if (text === '已取消') color = '#dc2626';
        if (text === '已拦截') color = '#dc2626';
        return <span style={{ fontSize: 12, color, fontWeight: 500 }}>{text}</span>;
      },
    },
    {
      key: 'expand',
      title: '',
      width: 40,
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpandedRow(expandedRow === row.id ? null : row.id);
          }}
          style={expandBtnStyle}
          title="展开详情"
        >
          {expandedRow === row.id ? '▲' : '▼'}
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Filters */}
      <FilterBar
        filters={filterConfigs}
        values={filters}
        onChange={handleFilterChange}
      />

      {/* Table with expandable rows */}
      {loading ? (
        <div style={containerStyle}>
          <div style={loadingStyle}>
            <div style={spinnerStyle} />
            <span style={{ color: '#6b7280', fontSize: 14 }}>加载中...</span>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div style={containerStyle}>
          <div style={emptyStyle}>
            <span style={{ fontSize: 32 }}>📭</span>
            <span style={{ color: '#9ca3af', fontSize: 14 }}>暂无检测日志</span>
          </div>
        </div>
      ) : (
        <div style={containerStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} style={{ ...thStyle, width: col.width }}>
                      {col.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIdx) => (
                  <ExpandableRow
                    key={row.id}
                    row={row}
                    rowIdx={rowIdx}
                    columns={columns}
                    expanded={expandedRow === row.id}
                    onToggle={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                    resultTypeConfig={resultTypeConfig}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination footer */}
          <PaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

/** 可展开行组件 */
function ExpandableRow({
  row,
  rowIdx,
  columns,
  expanded,
  onToggle,
  resultTypeConfig,
}: {
  row: SensitivityLog;
  rowIdx: number;
  columns: Column<SensitivityLog>[];
  expanded: boolean;
  onToggle: () => void;
  resultTypeConfig: Record<SensitivityResultType, { label: string; color: string }>;
}) {
  return (
    <>
      <tr
        style={{ ...(rowIdx % 2 === 0 ? {} : { background: '#fafafa' }), cursor: 'pointer' }}
        onClick={onToggle}
      >
        {columns.map((col) => (
          <td key={col.key} style={tdStyle}>
            {col.render ? col.render(row) : String((row as unknown as Record<string, unknown>)[col.key] ?? '')}
          </td>
        ))}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={columns.length} style={detailCellStyle}>
            <RowDetail row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

/** 行详情展开内容 */
function RowDetail({ row }: { row: SensitivityLog }) {
  return (
    <div style={detailContainerStyle}>
      {/* 完整创作描述 */}
      <DetailSection title="创作描述">
        <p style={detailTextStyle}>{row.inputDescription}</p>
      </DetailSection>

      {/* 完整歌词 */}
      {row.inputLyrics && (
        <DetailSection title="歌词">
          <p style={{ ...detailTextStyle, whiteSpace: 'pre-wrap' }}>{row.inputLyrics}</p>
        </DetailSection>
      )}

      {/* 检测到的敏感词 */}
      {row.detectedWords && row.detectedWords.length > 0 && (
        <DetailSection title="检测到的敏感词">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {row.detectedWords.map((w: DetectedWord, i: number) => (
              <span key={i} style={wordBadgeStyle}>
                {w.word}
                <span style={wordCategoryStyle}>
                  {w.category === 'celebrity' ? '明星' : w.category === 'song_name' ? '歌曲' : '违禁'}
                </span>
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* 改写后的 Prompt */}
      {row.rewrittenPrompt && (
        <DetailSection title="改写后的 Prompt">
          <p style={{ ...detailTextStyle, fontFamily: 'monospace', fontSize: 12 }}>{row.rewrittenPrompt}</p>
        </DetailSection>
      )}

      {/* 风格标签 */}
      {row.styleTags && row.styleTags.length > 0 && (
        <DetailSection title="风格标签">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.styleTags.map((tag, i) => (
              <Tag key={i} label={tag} color="purple" />
            ))}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

/** 详情区块 */
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={detailLabelStyle}>{title}</div>
      {children}
    </div>
  );
}

/** 分页控件 */
function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div style={footerStyle}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>
        显示 {startItem}-{endItem} / 共 {total} 条
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{ ...pageButtonStyle, opacity: page <= 1 ? 0.4 : 1 }}
        >
          ‹
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              style={{
                ...pageButtonStyle,
                background: pageNum === page ? '#D4A574' : '#fff',
                color: pageNum === page ? '#fff' : '#374151',
              }}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          style={{ ...pageButtonStyle, opacity: page >= totalPages ? 0.4 : 1 }}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ===== Styles =====

const containerStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
  overflow: 'hidden',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontWeight: 600,
  color: '#6b7280',
  fontSize: 12,
  borderBottom: '1px solid #f3f4f6',
  background: '#fafafa',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f3f4f6',
  color: '#374151',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderTop: '1px solid #f3f4f6',
};

const pageButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
};

const expandBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 10,
  color: '#9ca3af',
  padding: '4px 8px',
  borderRadius: 4,
};

const detailCellStyle: React.CSSProperties = {
  padding: 0,
  borderBottom: '1px solid #f3f4f6',
  background: '#f9fafb',
};

const detailContainerStyle: React.CSSProperties = {
  padding: '16px 24px',
};

const detailLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: 4,
};

const detailTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#374151',
  margin: 0,
  lineHeight: 1.6,
};

const wordBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 10px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  background: 'rgba(239,68,68,0.08)',
  color: '#dc2626',
};

const wordCategoryStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#9ca3af',
  fontWeight: 400,
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 0',
  gap: 12,
};

const spinnerStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  border: '3px solid #e5e7eb',
  borderTopColor: '#D4A574',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 0',
  gap: 8,
};
