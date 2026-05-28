import { describe, expect, it } from 'vitest';
import {
  calculateCreditsPackPrice,
  findCreditsPack,
  getPublicCreditsPacks,
} from './creditsPack';

describe('credits pack config', () => {
  it('uses configured packs for public pricing', () => {
    expect(getPublicCreditsPacks([
      { id: 'starter', credits: 12, price: 3600, businessDiscount: 0.75 },
    ])).toEqual([
      expect.objectContaining({
        id: 'starter',
        credits: 12,
        price: 3600,
        discountPrice: 2700,
        label: '12 Credits',
      }),
    ]);
  });

  it('falls back to default packs when admin config is empty', () => {
    expect(getPublicCreditsPacks([])).toHaveLength(3);
  });

  it('finds legacy hyphen pack ids and calculates business discount', () => {
    const pack = findCreditsPack([], 'pack-50');

    expect(pack?.id).toBe('pack_50');
    expect(calculateCreditsPackPrice(pack!, 'business')).toBe(7900);
  });
});
