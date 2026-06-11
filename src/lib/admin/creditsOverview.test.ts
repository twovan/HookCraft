import { describe, expect, it } from 'vitest';
import { buildDailyCreditTrend, buildMonthlyQuotaMap } from './creditsOverview';

describe('buildMonthlyQuotaMap', () => {
  it('uses current tier defaults for the admin credits overview', () => {
    expect(buildMonthlyQuotaMap([])).toMatchObject({
      free: 3,
      pro: 100,
      business: 300,
    });
  });

  it('uses saved admin quota config when present', () => {
    expect(
      buildMonthlyQuotaMap([
        { tier: 'business', monthlyCredits: 500 },
      ]),
    ).toMatchObject({
      business: 500,
    });
  });
});

describe('buildDailyCreditTrend', () => {
  it('returns the last seven days with zero-filled missing days', () => {
    const trend = buildDailyCreditTrend(
      [
        { created_at: '2026-06-10T08:00:00.000Z', total_cost: 20, operation_type: 'full_demo' },
        { created_at: '2026-06-10T12:00:00.000Z', total_cost: 30, operation_type: 'preview' },
        { created_at: '2026-06-11T01:00:00.000Z', total_cost: -100, operation_type: 'purchase' },
      ],
      new Date('2026-06-11T15:00:00.000Z'),
    );

    expect(trend).toHaveLength(7);
    expect(trend.at(-2)).toMatchObject({ date: '2026-06-10', consumed: 50 });
    expect(trend.at(-1)).toMatchObject({ date: '2026-06-11', consumed: 0 });
  });
});
