import { canSpend, quotaKeyFor, QuotaState, ON_DEMAND_RESERVE, DAILY_BUDGET } from './quota-ledger.service';

describe('quota ledger', () => {
  const now = Date.parse('2026-08-23T12:00:00Z');

  it('allows spending when no quota doc exists yet', () => {
    expect(canSpend(null, now, false)).toBeTrue();
    expect(canSpend(undefined, now, false)).toBeTrue();
  });

  it('allows background spend while under the effective (reserved) budget', () => {
    const quota: QuotaState = {
      used: DAILY_BUDGET - ON_DEMAND_RESERVE - 1,
      budget: DAILY_BUDGET,
      exhaustedAt: null,
      reservedForOnDemand: 0,
    };
    expect(canSpend(quota, now, false)).toBeTrue();
  });

  it('blocks background spend once the on-demand reserve would be touched', () => {
    const quota: QuotaState = {
      used: DAILY_BUDGET - ON_DEMAND_RESERVE,
      budget: DAILY_BUDGET,
      exhaustedAt: null,
      reservedForOnDemand: 0,
    };
    expect(canSpend(quota, now, false)).toBeFalse();
  });

  it('allows on-demand spend up to the full budget', () => {
    const quota: QuotaState = {
      used: DAILY_BUDGET - 1,
      budget: DAILY_BUDGET,
      exhaustedAt: null,
      reservedForOnDemand: 0,
    };
    expect(canSpend(quota, now, true)).toBeTrue();
  });

  it('blocks everything when exhaustedAt is in the future', () => {
    const quota: QuotaState = {
      used: 25,
      budget: 25,
      exhaustedAt: now + 60_000,
      reservedForOnDemand: 0,
    };
    expect(canSpend(quota, now, false)).toBeFalse();
    expect(canSpend(quota, now, true)).toBeFalse();
  });

  it('allows spending after exhaustedAt passes (next day)', () => {
    const quota: QuotaState = {
      used: 10,
      budget: 25,
      exhaustedAt: now - 60_000,
      reservedForOnDemand: 0,
    };
    expect(canSpend(quota, now, false)).toBeTrue();
  });

  it('uses Eastern timezone for the daily key', () => {
    // 2026-08-23 02:00 UTC is still 2026-08-22 in New York (EDT, UTC-4).
    const lateNightUtc = new Date('2026-08-23T02:00:00Z');
    expect(quotaKeyFor(lateNightUtc)).toBe('2026-08-22');

    // 2026-08-23 12:00 UTC is 2026-08-23 in New York.
    const middayUtc = new Date('2026-08-23T12:00:00Z');
    expect(quotaKeyFor(middayUtc)).toBe('2026-08-23');
  });
});
