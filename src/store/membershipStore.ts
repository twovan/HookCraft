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
  fetchMembership: (options?: { force?: boolean }) => Promise<void>;
  setMembership: (info: MembershipInfo) => void;
  clearMembership: () => void;

  // Computed
  currentTier: () => MembershipTier;
  isPaid: () => boolean;
  isExpiringSoon: () => boolean;
}

const MEMBERSHIP_FETCH_TTL_MS = 3000;
let membershipFetchPromise: Promise<void> | null = null;
let lastMembershipFetchAt = 0;

export const useMembershipStore = create<MembershipStore>((set, get) => ({
  membership: null,
  isLoading: false,
  error: null,

  fetchMembership: async (options) => {
    const now = Date.now();
    if (!options?.force && membershipFetchPromise) return membershipFetchPromise;
    if (!options?.force && get().membership && now - lastMembershipFetchAt < MEMBERSHIP_FETCH_TTL_MS) return;

    set({ isLoading: true, error: null });
    membershipFetchPromise = (async () => {
      try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/membership', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch membership: ${res.statusText}`);
      }
      const data: MembershipInfo = await res.json();
      set({ membership: data, isLoading: false });
      lastMembershipFetchAt = Date.now();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        set({ error: message, isLoading: false });
      } finally {
        membershipFetchPromise = null;
      }
    })();

    return membershipFetchPromise;
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
