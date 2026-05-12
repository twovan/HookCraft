'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { MembershipInfo, MembershipTier } from '@/types/membership';

/** 获取带 auth header 的 fetch options */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }
  return {};
}

export interface MembershipStore {
  membership: MembershipInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchMembership: () => Promise<void>;
  setMembership: (info: MembershipInfo) => void;
  clearMembership: () => void;

  // Computed
  currentTier: () => MembershipTier;
  isPaid: () => boolean;
  isExpiringSoon: () => boolean;
}

export const useMembershipStore = create<MembershipStore>((set, get) => ({
  membership: null,
  isLoading: false,
  error: null,

  fetchMembership: async () => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/membership', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch membership: ${res.statusText}`);
      }
      const data: MembershipInfo = await res.json();
      set({ membership: data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  setMembership: (info: MembershipInfo) => {
    set({ membership: info, error: null });
  },

  clearMembership: () => {
    set({ membership: null, error: null });
  },

  currentTier: (): MembershipTier => {
    const { membership } = get();
    return membership?.tier ?? 'free';
  },

  isPaid: (): boolean => {
    const tier = get().currentTier();
    return tier === 'pro' || tier === 'business';
  },

  isExpiringSoon: (): boolean => {
    const { membership } = get();
    if (!membership?.expiresAt) return false;

    const expiresAt = membership.expiresAt instanceof Date
      ? membership.expiresAt
      : new Date(membership.expiresAt);

    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    return timeUntilExpiry > 0 && timeUntilExpiry <= sevenDaysMs;
  },
}));
