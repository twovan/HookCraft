'use client';

import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  type: 'select' | 'search' | 'date-range';
  placeholder: string;
  options?: FilterOption[];
}

export interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  actions?: React.ReactNode;
}

export default function FilterBar({ filters, values, onChange, actions }: FilterBarProps) {
  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
        {filters.map((filter) => {
          if (filter.type === 'search') {
            return (
              <input
                key={filter.key}
                type="text"
                placeholder={filter.placeholder}
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                style={searchInputStyle}
              />
            );
          }
          if (filter.type === 'select') {
            return (
              <select
                key={filter.key}
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                style={selectStyle}
              >
                <option value="">{filter.placeholder}</option>
                {filter.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            );
          }
          if (filter.type === 'date-range') {
            return (
              <input
                key={filter.key}
                type="date"
                placeholder={filter.placeholder}
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                style={dateInputStyle}
              />
            );
          }
          return null;
        })}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 20px',
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.04)',
  marginBottom: 16,
};

const searchInputStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  outline: 'none',
  minWidth: 200,
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const selectStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  outline: 'none',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};

const dateInputStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  outline: 'none',
  fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
};
