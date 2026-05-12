'use client';

import React from 'react';

export interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ total, page, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = total === 0 ? 0 : Math.min(page * pageSize, total);

  if (total === 0) {
    return null;
  }

  return (
    <div style={containerStyle}>
      <span style={infoStyle}>
        显示 {startItem}-{endItem} / 共 {total} 条
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{ ...buttonStyle, opacity: page <= 1 ? 0.4 : 1 }}
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
                ...buttonStyle,
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
          style={{ ...buttonStyle, opacity: page >= totalPages ? 0.4 : 1 }}
        >
          ›
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 0',
};

const infoStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7280',
};

const buttonStyle: React.CSSProperties = {
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
