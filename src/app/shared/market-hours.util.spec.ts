import { computeMarketStatus } from './market-hours.util';

describe('market-hours.util', () => {
  it('reports open during regular trading hours on a weekday', () => {
    // Wed 2026-08-19 12:00 ET = 16:00 UTC (EDT)
    const status = computeMarketStatus(new Date('2026-08-19T16:00:00Z'));
    expect(status.isOpen).toBe(true);
    expect(Date.parse(status.nextTransitionAt)).toBeGreaterThan(Date.parse('2026-08-19T16:00:00Z'));
  });

  it('reports closed before the open and points at today\'s open', () => {
    // Wed 2026-08-19 08:00 ET = 12:00 UTC
    const status = computeMarketStatus(new Date('2026-08-19T12:00:00Z'));
    expect(status.isOpen).toBe(false);
    expect(status.nextTransitionAt.startsWith('2026-08-19')).toBe(true);
  });

  it('reports closed on a market holiday', () => {
    // Christmas 2026 falls on a Friday; midday ET is inside "open" minutes.
    const status = computeMarketStatus(new Date('2026-12-25T17:00:00Z'));
    expect(status.isOpen).toBe(false);
  });

  it('reports closed on a weekend and finds the next weekday open', () => {
    // Saturday 2026-08-22 18:00 UTC
    const status = computeMarketStatus(new Date('2026-08-22T18:00:00Z'));
    expect(status.isOpen).toBe(false);
    expect(status.nextTransitionAt.startsWith('2026-08-24')).toBe(true); // Monday
  });
});
