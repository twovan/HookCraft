'use client';

import { create } from 'zustand';
import type { CreditInfo } from '@/types/credits';

export interface PreviewCount {
  used: number;
  total: number;
  remaining: number;
}

export interface CreditStore {
  credits: CreditInfo | null;
  previewCount: PreviewCount | null;
  isLoading: boolean;

  // Actions
  fetchCredits: () => Promise<void>;
  fetchPreviewCount: () => Promise<void>;
  decrementCredits: (amount: number) => void;
  decrementPreview: () => void;

  // Computed
  isLow: () => boolean;
  isExhausted: () => boolean;
  usagePercentage: () => number;
  resetCountdown: () => string;
}

export const useCreditStore = create<CreditStore>((set, get) => ({
  credits: null,
  previewCount: null,
  isLoading: false,

  fetchCredits: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/credits');
      if (!res.ok) {
        throw new Error(`Failed to fetch credits: ${res.statusText}`);
      }
      const data: CreditInfo = await res.json();
      set({ credits: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchPreviewCount: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/credits/preview');
      if (!res.ok) {
        throw new Error(`Failed to fetch preview count: ${res.statusText}`);
      }
      const data: PreviewCount = await res.json();
      set({ previewCount: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  decrementCredits: (amount: number) => {
    const { credits } = get();
    if (!credits) return;

    set({
      credits: {
        ...credits,
        used: credits.used + amount,
        remaining: Math.max(0, credits.remaining - amount),
      },
    });
  },

  decrementPreview: () => {
    const { previewCount } = get();
    if (!previewCount) return;

    set({
      previewCount: {
        ...previewCount,
        used: previewCount.used + 1,
        remaining: Math.max(0, previewCount.remaining - 1),
      },
    });
  },

  isLow: (): boolean => {
    const { credits } = get();
    if (!credits || credits.total === 0) return false;
    return credits.remaining / credits.total < 0.2;
  },

  isExhausted: (): boolean => {
    const { credits } = get();
    if (!credits) return false;
    return credits.remaining === 0;
  },

  usagePercentage: (): number => {
    const { credits } = get();
    if (!credits || credits.total === 0) return 0;
    return (credits.used / credits.total) * 100;
  },

  resetCountdown: (): string => {
    const { credits } = get();
    if (!credits?.periodEnd) return '';

    const periodEnd = credits.periodEnd instanceof Date
      ? credits.periodEnd
      : new Date(credits.periodEnd);

    const now = new Date();
    const diffMs = periodEnd.getTime() - now.getTime();

    if (diffMs <= 0) return '即将刷新';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}天${hours}小时后刷新`;
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟后刷新`;
  },
}));
