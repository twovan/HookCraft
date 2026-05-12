'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UseAdminDataOptions {
  endpoint: string;
  pageSize?: number;
  initialFilters?: Record<string, string>;
}

export interface UseAdminDataResult<T> {
  data: T[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
  filters: Record<string, string>;
  setPage: (page: number) => void;
  setFilter: (key: string, value: string) => void;
  refresh: () => void;
}

export function useAdminData<T>(options: UseAdminDataOptions): UseAdminDataResult<T> {
  const { endpoint, pageSize = 10, initialFilters = {} } = options;
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const response = await fetch(`${endpoint}?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result.data || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请重试');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, pageSize, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    total,
    page,
    loading,
    error,
    filters,
    setPage,
    setFilter,
    refresh,
  };
}
