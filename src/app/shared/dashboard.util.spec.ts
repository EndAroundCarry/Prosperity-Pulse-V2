import { summarizeSentiment, pickUpcoming, widgetState, quoteBySymbol } from './dashboard.util';
import { QuoteSnapshot, EarningsEvent } from '../models/instrument.model';

describe('dashboard.util', () => {
  it('summarizeSentiment averages scores and ranks tickers by relevance', () => {
    const now = Date.parse('2026-08-20T12:00:00Z');
    const summary = summarizeSentiment(
      [
        {
          publishedAt: '2026-08-20T11:00:00Z',
          overallSentimentScore: 0.5,
          tickerSentiment: [{ ticker: 'AAPL', relevanceScore: 0.9 }],
        },
        {
          publishedAt: '2026-08-20T10:00:00Z',
          overallSentimentScore: -0.1,
          tickerSentiment: [{ ticker: 'MSFT', relevanceScore: 0.4 }],
        },
      ],
      24,
      now
    );
    expect(summary.articleCount).toBe(2);
    expect(summary.averageScore).toBeCloseTo(0.2);
    expect(summary.topTickers[0].ticker).toBe('AAPL');
    expect(summary.label).toBe('Somewhat-Bullish');
  });

  it('pickUpcoming sorts by date and caps counts', () => {
    const e = (d: string): EarningsEvent => ({
      symbol: d, name: '', reportDate: d, fiscalDateEnding: d, estimate: null, currency: 'USD',
    });
    const result = pickUpcoming(
      [e('2026-09-01'), e('2026-08-25'), e('2026-09-02'), e('2026-08-26'), e('2026-08-27'), e('2026-08-28')],
      [],
      5,
      3
    );
    expect(result.earnings.map((x) => x.reportDate)).toEqual([
      '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-09-01',
    ]);
    expect(result.ipos).toEqual([]);
  });

  it('widgetState returns loading before loaded/empty resolution', () => {
    expect(widgetState(false, true)).toBe('loading');
    expect(widgetState(true, false)).toBe('loaded');
    expect(widgetState(false, false)).toBe('empty');
  });

  it('quoteBySymbol finds a quote by symbol or returns undefined', () => {
    const q = { symbol: 'SPY' } as QuoteSnapshot;
    expect(quoteBySymbol([q] as any, 'SPY')).toBe(q);
    expect(quoteBySymbol([q] as any, 'QQQ')).toBeUndefined();
  });
});
