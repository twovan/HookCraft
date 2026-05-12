'use client';

import React from 'react';

export interface Column<T> {
  key: string;
  title: string;
  render?: (row: T) => React.ReactNode;
  width?: number | string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export default function DataTable<T>({ columns, data, total, page, pageSize, onPageChange, loading }: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          <span style={{ color: '#6b7280', fontSize: 14 }}>加载中...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          <span style={{ fontSize: 32 }}>📭</span>
          <span style={{ color: '#9ca3af', fontSize: 14 }}>暂无数据</span>
        </div>
      </div>
    );
  }

  return (
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
              <tr key={rowIdx} style={rowIdx % 2 === 0 ? {} : { background: '#fafafa' }}>
                {columns.map((col) => (
                  <td key={col.key} style={tdStyle}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination footer */}
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
    </div>
  );
}

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
