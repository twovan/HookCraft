'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { CreditInfoEnhanced } from '@/types/credits';

export interface PreviewCount {
  used: number;
  total: number;
  remaining: number;
}

/** 获取带 auth header 的 fetch options */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }
  return {};
}

export interface CreditStore {
  credits: CreditInfoEnhanced | null;
  previewCount: PreviewCount | null;
  isLoading: boolean;

  // Actions
  fetchCredits: (options?: { force?: boolean }) => Promise<void>;
  fetchPreviewCount: (options?: { force?: boolean }) => Promise<void>;
  decrementCredits: (amount: number, monthlyCost: number, purchasedCost: number) => void;
  addPurchasedCredits: (amount: number) => void;
  decrementPreview: () => void;

  // Computed
  isLow: () => boolean;
  isExhausted: () => boolean;
  isMonthlyExhausted: () => boolean;
  usagePercentage: () => number;
  resetCountdown: () => string;
}

const CREDIT_FETCH_TTL_MS = 3000;
let creditsFetchPromise: Promise<void> | null = null;
let previewFetchPromise: Promise<void> | null = null;
let lastCreditsFetchAt = 0;
let lastPreviewFetchAt = 0;

export const useCreditStore = create<CreditStore>((set, get) => ({
  credits: null,
  previewCount: null,
  isLoading: false,

  fetchCredits: async (options) => {
    const now = Date.now();
    if (!options?.force && creditsFetchPromise) return creditsFetchPromise;
    if (!options?.force && get().credits && now - lastCreditsFetchAt < CREDIT_FETCH_TTL_MS) return;

    set({ isLoading: true });
    creditsFetchPromise = (async () => {
      try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/credits', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch credits: ${res.statusText}`);
      }
      const data = await res.json();
      // Parse enhanced server response into CreditInfoEnhanced
      const credits: CreditInfoEnhanced = {
        userId: data.userId ?? '',
        tier: data.tier ?? 'free',
        monthlyUsed: data.monthlyUsed ?? 0,
        monthlyTotal: data.monthlyTotal ?? 0,
        monthlyRemaining: data.monthlyRemaining ?? 0,
        purchasedBalance: data.purchasedBalance ?? 0,
        totalAvailable: data.totalAvailable ?? 0,
        periodStart: data.periodStart ? new Date(data.periodStart) : new Date(),
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : new Date(),
      };
      set({ credits, isLoading: false });
      lastCreditsFetchAt = Date.now();
      } catch {
        set({ isLoading: false });
      } finally {
        creditsFetchPromise = null;
      }
    })();

    return creditsFetchPromise;
  },

  fetchPreviewCount: async (options) => {
    const now = Date.now();
    if (!options?.force && previewFetchPromise) return previewFetchPromise;
    if (!options?.force && get().previewCount && now - lastPreviewFetchAt < CREDIT_FETCH_TTL_MS) return;

    set({ isLoading: true });
    previewFetchPromise = (async () => {
      try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/credits/preview', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch preview count: ${res.statusText}`);
      }
      const data: PreviewCount = await res.json();
      set({ previewCount: data, isLoading: false });
      lastPreviewFetchAt = Date.now();
      } catch {
        set({ isLoading: false });
      } finally {
        previewFetchPromise = null;
      }
    })();

    return previewFetchPromise;
  },

  decrementCredits: (amount: number, monthlyCost: number, purchasedCost: number) => {
    const { credits } = get();
    if (!credits) return;

    set({
      credits: {
        ...credits,
        monthlyUsed: credits.monthlyUsed + monthlyCost,
        monthlyRemaining: Math.max(0, credits.monthlyRemaining - monthlyCost),
        purchasedBalance: Math.max(0, credits.purchasedBalance - purchasedCost),
        totalAvailable: Math.max(0, credits.totalAvailable - amount),
      },
    });
  },

  addPurchasedCredits: (amount: number) => {
    const { credits } = get();
    if (!credits) return;

    set({
      credits: {
        ...credits,
        purchasedBalance: credits.purchasedBalance + amount,
        totalAvailable: credits.totalAvailable + amount,
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
    if (!credits) return false;
    const totalPool = credits.monthlyTotal + credits.purchasedBalance;
    if (totalPool === 0) return false;
    return credits.totalAvailable / totalPool < 0.2;
  },

  isExhausted: (): boolean => {
    const { credits } = get();
    if (!credits) return false;
    return credits.totalAvailable === 0;
  },

  isMonthlyExhausted: (): boolean => {
    const { credits } = get();
    if (!credits) return false;
    return credits.monthlyRemaining === 0 && credits.purchasedBalance > 0;
  },

  usagePercentage: (): number => {
    const { credits } = get();
    if (!credits || credits.monthlyTotal === 0) return 0;
    return (credits.monthlyUsed / credits.monthlyTotal) * 100;
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
