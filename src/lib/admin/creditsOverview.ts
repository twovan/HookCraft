import { TIER_CONFIGS } from '../../config/tierConfig';
import type { AdminCreditConfig } from '../../types/admin';
import type { MembershipTier } from '../../types/membership';

export const CREDIT_TIERS: MembershipTier[] = ['free', 'pro', 'business'];

function getDefaultMonthlyQuota(tier: MembershipTier): number {
  return tier === 'free'
    ? TIER_CONFIGS.free.monthlyPreviews
    : TIER_CONFIGS[tier].monthlyCredits;
}

export function buildMonthlyQuotaMap(
  creditQuotas: AdminCreditConfig[] = [],
): Record<MembershipTier, number> {
  const quotaMap = CREDIT_TIERS.reduce((acc, tier) => {
    acc[tier] = getDefaultMonthlyQuota(tier);
    return acc;
  }, {} as Record<MembershipTier, number>);

  for (const quota of creditQuotas) {
    if (CREDIT_TIERS.includes(quota.tier) && Number.isFinite(quota.monthlyCredits)) {
      quotaMap[quota.tier] = quota.monthlyCredits;
    }
  }

  return quotaMap;
}

export interface CreditTransactionForTrend {
  created_at: string | null;
  total_cost: number | null;
  operation_type: string | null;
}

export interface DailyCreditTrendPoint {
  date: string;
  label: string;
  consumed: number;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function getDailyTrendStartDate(now = new Date()): Date {
  return addDays(startOfDay(now), -6);
}

export function buildDailyCreditTrend(
  transactions: CreditTransactionForTrend[] = [],
  now = new Date(),
): DailyCreditTrendPoint[] {
  const start = getDailyTrendStartDate(now);
  const buckets = new Map<string, number>();

  for (let index = 0; index < 7; index += 1) {
    buckets.set(formatDateKey(addDays(start, index)), 0);
  }

  for (const transaction of transactions) {
    if (!transaction.created_at || transaction.operation_type === 'purchase') continue;

    const cost = transaction.total_cost || 0;
    if (cost <= 0) continue;

    const key = formatDateKey(new Date(transaction.created_at));
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) || 0) + cost);
    }
  }

  return Array.from(buckets.entries()).map(([date, consumed]) => {
    const [year, month, day] = date.split('-').map(Number);
    return {
      date,
      label: formatDateLabel(new Date(year, month - 1, day)),
      consumed,
    };
  });
}
