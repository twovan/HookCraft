import type { MembershipTier } from '@/types/membership';
import type { CreditsPack } from '@/types/admin';

export type PublicCreditsPack = CreditsPack & {
  discountPrice: number;
  label: string;
};

export const DEFAULT_CREDITS_PACKS: CreditsPack[] = [
  { id: 'pack_50', credits: 50, price: 9900, businessDiscount: 7900 / 9900 },
  { id: 'pack_100', credits: 100, price: 17900, businessDiscount: 14300 / 17900 },
  { id: 'pack_200', credits: 200, price: 32900, businessDiscount: 26300 / 32900 },
];

function normalizePackId(packId: string) {
  return packId.trim().replaceAll('-', '_');
}

function normalizeDiscount(discount: number) {
  if (!Number.isFinite(discount) || discount <= 0) return 1;
  return Math.min(1, discount);
}

export function getEffectiveCreditsPacks(packs: CreditsPack[] | null | undefined) {
  return packs?.length ? packs : DEFAULT_CREDITS_PACKS;
}

export function getPublicCreditsPacks(packs: CreditsPack[] | null | undefined): PublicCreditsPack[] {
  return getEffectiveCreditsPacks(packs).map((pack) => ({
    ...pack,
    discountPrice: Math.round(pack.price * normalizeDiscount(pack.businessDiscount)),
    label: `${pack.credits} Credits`,
  }));
}

export function findCreditsPack(packs: CreditsPack[] | null | undefined, packId: string) {
  const effectivePacks = getEffectiveCreditsPacks(packs);
  const normalizedPackId = normalizePackId(packId);
  return effectivePacks.find((pack) => (
    pack.id === packId || normalizePackId(pack.id) === normalizedPackId
  )) || null;
}

export function calculateCreditsPackPrice(pack: CreditsPack, tier: MembershipTier | null | undefined) {
  if (tier === 'business') {
    return Math.round(pack.price * normalizeDiscount(pack.businessDiscount));
  }
  return pack.price;
}
