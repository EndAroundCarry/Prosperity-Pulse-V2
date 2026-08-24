import { buildDatasetRegistry, PersistContext, DASHBOARD_DOC_PATH } from './dataset-registry';

function makeContext(): { ctx: PersistContext; writes: Map<string, Record<string, unknown>> } {
  const writes = new Map<string, Record<string, unknown>>();
  const ctx: PersistContext = {
    setDoc: async (path, data) => {
      writes.set(path, data);
    },
    deleteDoc: async () => undefined,
    getDoc: async (path) => writes.get(path) ?? null,
    now: () => new Date('2026-08-23T12:00:00Z'),
  };
  return { ctx, writes };
}

describe('dataset registry', () => {
  it('contains the expected datasets', () => {
    const registry = buildDatasetRegistry();
    const ids = registry.map((d) => d.id);
    expect(ids).toContain('news.core');
    expect(ids).toContain('series.SPY');
    expect(ids).toContain('crypto.BTC');
    expect(ids).toContain('rates.10y');
    expect(ids).toContain('calendars.earnings');
    expect(ids).toContain('symbols.universe');
    // All 11 sector ETFs present.
    expect(ids.filter((id) => id.startsWith('series.XL')).length).toBe(11);
  });

  it('news persist maps and stores articles with sentiment', async () => {
    const registry = buildDatasetRegistry();
    const news = registry.find((d) => d.id === 'news.core')!;
    const { ctx, writes } = makeContext();

    await news.persist(
      {
        feed: [
          {
            title: 'Markets Rally on Cooler Inflation',
            source: 'Reuters',
            time_published: '20260820T143000',
            summary: 'Stocks climbed.',
            url: 'https://example.com/a',
            banner_image: 'https://example.com/a.jpg',
            authors: ['Jane Doe'],
            topics: [{ topic: 'Finance', relevance_score: '0.9' }],
            overall_sentiment_score: '0.42',
            overall_sentiment_label: 'Somewhat-Bullish',
            ticker_sentiment: [
              { ticker: 'SPY', relevance_score: '0.8', ticker_sentiment_score: '0.5', ticker_sentiment_label: 'Bullish' },
            ],
          },
        ],
      },
      ctx
    );

    const newsDoc = [...writes.entries()].find(([path]) => path.startsWith('news/'))!;
    expect(newsDoc[0]).toBe('news/reuters-markets-rally-on-cooler-inflation-2026-08-20');
    expect(newsDoc[1]['overallSentimentScore']).toBe(0.42);
    expect(newsDoc[1]['overallSentimentLabel']).toBe('Somewhat-Bullish');
    expect(newsDoc[1]['tickerSentiment']).toEqual([
      { ticker: 'SPY', relevanceScore: 0.8, sentimentScore: 0.5, sentimentLabel: 'Bullish' },
    ]);

    // Topic doc written too.
    const topicDoc = writes.get('topics/finance');
    expect(topicDoc).toBeDefined();
    expect(topicDoc!['name']).toBe('Finance');
  });

  it('series persist writes a market_series doc with sorted candles', async () => {
    const registry = buildDatasetRegistry();
    const spy = registry.find((d) => d.id === 'series.SPY')!;
    const { ctx, writes } = makeContext();

    await spy.persist(
      {
        'Meta Data': { '2. Symbol': 'SPY' },
        'Time Series (Daily)': {
          '2026-08-20': { '1. open': '100', '2. high': '110', '3. low': '99', '4. close': '108', '5. volume': '1000' },
          '2026-08-19': { '1. open': '99', '2. high': '101', '3. low': '98', '4. close': '100', '5. volume': '900' },
        },
      },
      ctx
    );

    const doc = writes.get('market_series/SPY')!;
    expect(doc['symbol']).toBe('SPY');
    const candles = doc['candles'] as Array<{ date: string; close: number }>;
    expect(candles.length).toBe(2);
    expect(candles[0].date).toBe('2026-08-19');
    expect(candles[1].close).toBe(108);
    expect(doc['asOf']).toBe('2026-08-20');

    // Dashboard snapshot written with the tile, proxy label, and sparkline.
    const dash = writes.get(DASHBOARD_DOC_PATH)!;
    const quotes = dash['quotes'] as Array<Record<string, unknown>>;
    expect(quotes.length).toBe(1);
    expect(quotes[0]['symbol']).toBe('SPY');
    expect(quotes[0]['name']).toBe('S&P 500');
    expect(quotes[0]['proxyFor']).toBe('S&P 500');
    expect(quotes[0]['price']).toBe(108);
    expect(quotes[0]['changePercent']).toBe(8);
    expect(quotes[0]['asOf']).toBe('2026-08-20');
    expect((quotes[0]['sparkline'] as number[]).length).toBe(2);
  });

  it('a second series persist merges into the dashboard without wiping the first', async () => {
    const registry = buildDatasetRegistry();
    const spy = registry.find((d) => d.id === 'series.SPY')!;
    const qqq = registry.find((d) => d.id === 'series.QQQ')!;
    const { ctx, writes } = makeContext();

    const seriesPayload = (symbol: string, close: string) => ({
      'Meta Data': { '2. Symbol': symbol },
      'Time Series (Daily)': {
        '2026-08-20': { '1. open': '1', '2. high': '2', '3. low': '0.5', '4. close': close, '5. volume': '10' },
      },
    });

    await spy.persist(seriesPayload('SPY', '108'), ctx);
    await qqq.persist(seriesPayload('QQQ', '540'), ctx);

    const dash = writes.get(DASHBOARD_DOC_PATH)!;
    const quotes = dash['quotes'] as Array<Record<string, unknown>>;
    expect(quotes.length).toBe(2);
    expect(quotes.map((q) => q['symbol'])).toEqual(['SPY', 'QQQ']);
  });

  it('macro persist writes a macro doc', async () => {
    const registry = buildDatasetRegistry();
    const cpi = registry.find((d) => d.id === 'macro.CPI')!;
    const { ctx, writes } = makeContext();

    await cpi.persist(
      {
        name: 'Consumer Price Index for All Urban Consumers',
        unit: 'index 1982-1984=100',
        interval: 'monthly',
        data: [
          { date: '2026-07-01', value: '320.5' },
          { date: '2026-06-01', value: '319.8' },
        ],
      },
      ctx
    );

    const doc = writes.get('macro/cpi')!;
    expect(doc['unit']).toBe('index 1982-1984=100');
    expect((doc['points'] as Array<{ value: number }>)[0].value).toBe(320.5);
  });
});
