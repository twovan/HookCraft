import { describe, expect, it } from 'vitest';
import { CREDITS_COST, CREDITS_COST_RULES } from './creditsCost';

describe('credits cost rules', () => {
  it('keeps basic and advanced stem analysis as distinct billable operations', () => {
    expect(CREDITS_COST.stem_split).toBe(10);
    expect(CREDITS_COST.stem_split_advanced).toBe(50);
    expect(CREDITS_COST_RULES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'stem_split', cost: 10 }),
        expect.objectContaining({ operation: 'stem_split_advanced', cost: 50 }),
      ]),
    );
  });
});
