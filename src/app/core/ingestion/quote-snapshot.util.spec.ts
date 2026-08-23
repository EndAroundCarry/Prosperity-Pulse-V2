import { buildQuoteSnapshot, mergeDashboardSnapshot } from './quote-snapshot.util';
import { Candle, DashboardSnapshot, QuoteSnapshot } from '../../models/instrument.model';

describe('quote snapshot util', () => {
  const candles: Candle[] = [
    { date: '2026-08-18', open: 100, high: 102, low: 99, close: 101, volume: 1000 },
    { date: '2026-08-19', open: 101, high: 103, low: 100, close: 102, volume: 1100 },
    { date: '2026-08-20', open: 102, high: 105, low: 101, close: 104, volume: 1200 },
  ];

  it('computes change, changePercent, asOf, and range from candles', () => {
    const q = buildQuoteSnapshot('SPY', 'S&P 500', 'etf', candles, 'S&P 500')!;
    expect(q.price).toBe(104);
    expect(q.previousClose).toBe(102);
    expect(q.change).toBe(2);
    expect(q.changePercent).toBeCloseTo(1.9608, 2);
    expect(q.asOf).toBe('2026-08-20');
    expect(q.rangeLow).toBe(101);
    expect(q.rangeHigh).toBe(104);
    expect(q.sparkline).toEqual([101, 102, 104]);
  });

  it('returns null for empty candles', () => {
    expect(buildQuoteSnapshot('SPY', 'S&P 500', 'etf', [])).toBeNull();
  });

  it('handles a single candle (previous === last)', () => {
    const q = buildQuoteSnapshot('SPY', 'S&P 500', 'etf', [candles[0]])!;
    expect(q.change).toBe(0);
    expect(q.changePercent).toBe(0);
  });

  it('caps the sparkline at 30 points', () => {
    const many: Candle[] = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      open: i,
      high: i + 1,
      low: i - 1,
      close: i,
      volume: 1,
    }));
    const q = buildQuoteSnapshot('TEST', 'Test', 'etf', many)!;
    expect(q.sparkline.length).toBe(30);
  });

  it('mergeDashboardSnapshot appends a new quote', () => {
    const q: QuoteSnapshot = buildQuoteSnapshot('SPY', 'S&P 500', 'etf', candles)!;
    const merged = mergeDashboardSnapshot(null, q, new Date('2026-08-23T12:00:00Z'));
    expect(merged.quotes.length).toBe(1);
    expect(merged.quotes[0].symbol).toBe('SPY');
  });

  it('mergeDashboardSnapshot replaces an existing quote for the same symbol', () => {
    const spy: QuoteSnapshot = buildQuoteSnapshot('SPY', 'S&P 500', 'etf', candles)!;
    const existing: DashboardSnapshot = {
      updatedAt: '2026-08-22T00:00:00Z',
      quotes: [spy, { ...spy, symbol: 'QQQ', name: 'Nasdaq 100' }],
    };
    const fresh = { ...spy, price: 110 };
    const merged = mergeDashboardSnapshot(existing, fresh, new Date('2026-08-23T12:00:00Z'));
    expect(merged.quotes.length).toBe(2);
    expect(merged.quotes.find((q) => q.symbol === 'SPY')?.price).toBe(110);
    expect(merged.quotes.find((q) => q.symbol === 'QQQ')).toBeDefined();
  });
});
