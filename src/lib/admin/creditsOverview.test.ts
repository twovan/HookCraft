import { describe, expect, it } from 'vitest';
import { buildMonthlyQuotaMap } from './creditsOverview';

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
