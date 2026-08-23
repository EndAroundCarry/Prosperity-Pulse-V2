/**
 * The Alpha Vantage dataset registry — the whole budget table as data.
 *
 * Adding a data source later means appending one entry. Nothing else changes.
 * Persist handlers are pure functions (raw payload + persistence adapter)
 * with no Angular dependency, so the same registry can be lifted into a
 * Cloud Function or GitHub Action later (Phase 1.6).
 */

export type DatasetTier = 'A' | 'B' | 'C' | 'news' | 'ondemand';

/** Where a series doc should live and how it should be tagged. */
export interface SeriesMeta {
  assetClass: 'etf' | 'crypto' | 'fx' | 'commodity' | 'rate';
  name: string;
  proxyFor?: string;
}

export interface PersistContext {
  /** Write a document. Returns the Firestore write promise. */
  setDoc(path: string, data: Record<string, unknown>): Promise<void>;
  /** Delete a document. */
  deleteDoc(path: string): Promise<void>;
  /** Read a document's data (or null). */
  getDoc(path: string): Promise<Record<string, unknown> | null>;
  /** Timestamp helper for "as of" values. */
  now(): Date;
}

export interface DatasetDefinition {
  id: string;
  tier: DatasetTier;
  ttlMs: number;
  /** Alpha Vantage query params, minus apikey. */
  params: Record<string, string>;
  format: 'json' | 'csv';
  persist: (raw: unknown, ctx: PersistContext) => Promise<void>;
  /** Members of a group share one slot and round-robin. */
  rotationGroup?: string;
}

/** Cached dataset state persisted to Firestore `system/state/datasets/{id}`. */
export interface DatasetState {
  lastFetchedAt: string | null;
  lastStatus: 'ok' | 'error' | 'disabled' | null;
  lastError?: string;
  disabled?: boolean;
  rotationIndex?: number;
}

/** Default TTLs (milliseconds). */
export const TTL = {
  /** Tier A: once per trading day. */
  A: 24 * 60 * 60 * 1000,
  /** Tier B: ~5-day rotation. */
  B: 5 * 24 * 60 * 60 * 1000,
  /** Tier C: weekly. */
  C: 7 * 24 * 60 * 60 * 1000,
  /** News core: 6h. */
  news: 6 * 60 * 60 * 1000,
  /** On-demand: 24h. */
  ondemand: 24 * 60 * 60 * 1000,
} as const;

/**
 * Build the registry. Imported as a factory so tests can pass a stub
 * persist context without Angular DI.
 */
export function buildDatasetRegistry(): DatasetDefinition[] {
  return [
    {
      id: 'news.core',
      tier: 'news',
      ttlMs: TTL.news,
      params: {
        function: 'NEWS_SENTIMENT',
        topics: 'financial_markets',
        limit: '1000',
      },
      format: 'json',
      persist: persistNews,
    },
    {
      id: 'news.earnings',
      tier: 'news',
      ttlMs: TTL.A,
      params: {
        function: 'NEWS_SENTIMENT',
        topics: 'earnings,ipo,mergers_and_acquisitions',
        limit: '1000',
      },
      format: 'json',
      persist: persistNews,
    },
    {
      id: 'movers.latest',
      tier: 'news',
      ttlMs: 12 * 60 * 60 * 1000,
      params: {
        function: 'TOP_GAINERS_LOSERS',
      },
      format: 'json',
      persist: persistMovers,
    },
    {
      id: 'series.SPY',
      tier: 'A',
      ttlMs: TTL.A,
      params: { function: 'TIME_SERIES_DAILY', symbol: 'SPY', outputsize: 'compact' },
      format: 'json',
      persist: persistSeries,
    },
    {
      id: 'series.QQQ',
      tier: 'A',
      ttlMs: TTL.A,
      params: { function: 'TIME_SERIES_DAILY', symbol: 'QQQ', outputsize: 'compact' },
      format: 'json',
      persist: persistSeries,
    },
    {
      id: 'series.DIA',
      tier: 'A',
      ttlMs: TTL.A,
      params: { function: 'TIME_SERIES_DAILY', symbol: 'DIA', outputsize: 'compact' },
      format: 'json',
      persist: persistSeries,
    },
    {
      id: 'series.IWM',
      tier: 'A',
      ttlMs: TTL.A,
      params: { function: 'TIME_SERIES_DAILY', symbol: 'IWM', outputsize: 'compact' },
      format: 'json',
      persist: persistSeries,
    },
    {
      id: 'rates.10y',
      tier: 'A',
      ttlMs: TTL.A,
      params: { function: 'TREASURY_YIELD', maturity: '10year', interval: 'daily' },
      format: 'json',
      persist: persistMacro,
    },
    {
      id: 'crypto.BTC',
      tier: 'A',
      ttlMs: TTL.A,
      params: { function: 'DIGITAL_CURRENCY_DAILY', symbol: 'BTC', market: 'USD' },
      format: 'json',
      persist: persistCryptoSeries,
    },
    // ---- Tier B: sector ETFs + a few extras, rotating ----
    ...sectorEtfs(),
    {
      id: 'series.ETH',
      tier: 'B',
      ttlMs: TTL.B,
      rotationGroup: 'crypto-extra',
      params: { function: 'DIGITAL_CURRENCY_DAILY', symbol: 'ETH', market: 'USD' },
      format: 'json',
      persist: persistCryptoSeries,
    },
    {
      id: 'fx.EURUSD',
      tier: 'B',
      ttlMs: TTL.B,
      rotationGroup: 'fx',
      params: { function: 'FX_DAILY', from_symbol: 'EUR', to_symbol: 'USD', outputsize: 'compact' },
      format: 'json',
      persist: persistFxSeries,
    },
    // ---- Tier C: slow macro ----
    {
      id: 'macro.CPI',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'CPI' },
      format: 'json',
      persist: persistMacro,
    },
    {
      id: 'macro.UNEMPLOYMENT',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'UNEMPLOYMENT' },
      format: 'json',
      persist: persistMacro,
    },
    {
      id: 'macro.FEDERAL_FUNDS_RATE',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'FEDERAL_FUNDS_RATE' },
      format: 'json',
      persist: persistMacro,
    },
    {
      id: 'macro.REAL_GDP',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'REAL_GDP' },
      format: 'json',
      persist: persistMacro,
    },
    {
      id: 'macro.RETAIL_SALES',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'RETAIL_SALES' },
      format: 'json',
      persist: persistMacro,
    },
    {
      id: 'rates.2y',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'TREASURY_YIELD', maturity: '2year', interval: 'daily' },
      format: 'json',
      persist: persistMacro,
    },
    // ---- Tier C calendars ----
    {
      id: 'calendars.earnings',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'EARNINGS_CALENDAR', horizon: '3months' },
      format: 'csv',
      persist: persistEarningsCalendar,
    },
    {
      id: 'calendars.ipo',
      tier: 'C',
      ttlMs: TTL.C,
      params: { function: 'IPO_CALENDAR' },
      format: 'csv',
      persist: persistIpoCalendar,
    },
    // ---- Tier C universe (powers search autocomplete) ----
    {
      id: 'symbols.universe',
      tier: 'C',
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      params: { function: 'LISTING_STATUS' },
      format: 'csv',
      persist: persistSymbolUniverse,
    },
  ];
}

function sectorEtfs(): DatasetDefinition[] {
  const sectors: Array<[string, string]> = [
    ['XLK', 'Technology'],
    ['XLF', 'Financials'],
    ['XLE', 'Energy'],
    ['XLV', 'Health Care'],
    ['XLI', 'Industrials'],
    ['XLY', 'Consumer Discretionary'],
    ['XLP', 'Consumer Staples'],
    ['XLU', 'Utilities'],
    ['XLB', 'Materials'],
    ['XLRE', 'Real Estate'],
    ['XLC', 'Communication Services'],
  ];
  return sectors.map(([symbol, name]) => ({
    id: `series.${symbol}`,
    tier: 'B' as const,
    ttlMs: TTL.B,
    rotationGroup: 'sectors',
    params: { function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact' },
    format: 'json' as const,
    persist: persistSeries,
  }));
}

// ---------------------------------------------------------------------------
// Pure persist handlers. Each takes (raw payload, PersistContext) and writes
// the Firestore layout described in Phase 2.
// ---------------------------------------------------------------------------

function persistNews(raw: unknown, ctx: PersistContext): Promise<void> {
  const feed = (raw as { feed?: unknown[] })?.feed ?? [];
  const nowIso = ctx.now().toISOString();
  const writes: Promise<void>[] = [];
  const topicNameToIds = new Map<string, Set<string>>();

  for (const item of feed) {
    const record = (item ?? {}) as Record<string, unknown>;
    const title = String(record['title'] ?? 'Untitled article');
    const source = String(record['source'] ?? 'Unknown source');
    const timePublished = record['time_published'] ? String(record['time_published']) : '';
    const publishedAt = formatPublishedAt(timePublished);
    const id = buildArticleDocId({ title, sourceName: source, publishedAt });

    const topicEntries = Array.isArray(record['topics']) ? (record['topics'] as Array<Record<string, unknown>>) : [];
    const topics = topicEntries
      .map((t) => String(t['topic'] ?? '').trim())
      .filter((t) => t.length > 0);
    const topicIds = topics.map((t) => buildTopicDocId(t));

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      if (!topicNameToIds.has(topic)) topicNameToIds.set(topic, new Set());
      topicNameToIds.get(topic)!.add(topicIds[i]);
    }

    // Sentiment fields (Phase 8 will surface these; store them now).
    const overallSentimentScore = Number(record['overall_sentiment_score'] ?? 0);
    const overallSentimentLabel = String(record['overall_sentiment_label'] ?? 'Neutral');
    const tickerSentiment = Array.isArray(record['ticker_sentiment'])
      ? (record['ticker_sentiment'] as Array<Record<string, unknown>>).map((t) => ({
          ticker: String(t['ticker'] ?? ''),
          relevanceScore: Number(t['relevance_score'] ?? 0),
          sentimentScore: Number(t['ticker_sentiment_score'] ?? 0),
          sentimentLabel: String(t['ticker_sentiment_label'] ?? 'Neutral'),
        }))
      : [];
    const topicRelevance: Record<string, number> = {};
    for (const t of topicEntries) {
      const name = String(t['topic'] ?? '');
      if (name) topicRelevance[name] = Number(t['relevance_score'] ?? 0);
    }

    writes.push(
      ctx.setDoc(`news/${id}`, {
        title,
        summary: String(record['summary'] ?? ''),
        imageUrl: String(record['banner_image'] ?? ''),
        sourceUrl: String(record['url'] ?? '#'),
        sourceName: source,
        publishedAt,
        publishedAtDate: publishedAt ? new Date(publishedAt) : null,
        authors: Array.isArray(record['authors']) ? record['authors'] : [],
        topics,
        topicIds,
        overallSentimentScore,
        overallSentimentLabel,
        tickerSentiment,
        topicRelevance,
        ingestedAt: nowIso,
      })
    );
  }

  // Maintain the distinct topics collection the news feed reads.
  for (const [topic, articleIds] of topicNameToIds.entries()) {
    const topicId = buildTopicDocId(topic);
    writes.push(
      ctx.setDoc(`topics/${topicId}`, {
        name: topic,
        newsIds: Array.from(articleIds),
      })
    );
  }

  return Promise.all(writes).then(() => undefined);
}

function persistSeries(raw: unknown, ctx: PersistContext): Promise<void> {
  const series = (raw as Record<string, unknown>)?.['Time Series (Daily)'] as Record<string, unknown> | undefined;
  if (!series) return Promise.resolve();

  const candles = Object.entries(series)
    .map(([date, value]) => {
      const v = (value ?? {}) as Record<string, string>;
      return {
        date,
        open: Number(v['1. open'] ?? 0),
        high: Number(v['2. high'] ?? 0),
        low: Number(v['3. low'] ?? 0),
        close: Number(v['4. close'] ?? 0),
        volume: Number(v['5. volume'] ?? 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-100);

  const symbol = String(
    ((raw as Record<string, unknown>)?.['Meta Data'] as Record<string, unknown> | undefined)?.['2. Symbol'] ?? ''
  );
  if (!symbol || candles.length === 0) return Promise.resolve();

  return ctx.setDoc(`market_series/${symbol}`, {
    symbol,
    assetClass: 'etf',
    asOf: candles[candles.length - 1].date,
    candles,
    updatedAt: ctx.now().toISOString(),
  });
}

function persistCryptoSeries(raw: unknown, ctx: PersistContext): Promise<void> {
  const series = (raw as Record<string, unknown>)?.['Time Series (Digital Currency Daily)'] as
    | Record<string, unknown>
    | undefined;
  if (!series) return Promise.resolve();

  const symbol = String(
    ((raw as Record<string, unknown>)?.['Meta Data'] as Record<string, unknown> | undefined)?.['3. Digital Currency Code'] ?? ''
  );
  const candles = Object.entries(series)
    .map(([date, value]) => {
      const v = (value ?? {}) as Record<string, string>;
      return {
        date,
        open: Number(v['1a. open (USD)'] ?? v['1. open'] ?? 0),
        high: Number(v['2a. high (USD)'] ?? v['2. high'] ?? 0),
        low: Number(v['3a. low (USD)'] ?? v['3. low'] ?? 0),
        close: Number(v['4a. close (USD)'] ?? v['4. close'] ?? 0),
        volume: Number(v['5. volume'] ?? 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-100);

  if (!symbol || candles.length === 0) return Promise.resolve();

  return ctx.setDoc(`market_series/${symbol}`, {
    symbol,
    assetClass: 'crypto',
    asOf: candles[candles.length - 1].date,
    candles,
    updatedAt: ctx.now().toISOString(),
  });
}

function persistFxSeries(raw: unknown, ctx: PersistContext): Promise<void> {
  const series = (raw as Record<string, unknown>)?.['Time Series FX (Daily)'] as Record<string, unknown> | undefined;
  if (!series) return Promise.resolve();

  const symbol = 'EURUSD';
  const candles = Object.entries(series)
    .map(([date, value]) => {
      const v = (value ?? {}) as Record<string, string>;
      return {
        date,
        open: Number(v['1. open'] ?? 0),
        high: Number(v['2. high'] ?? 0),
        low: Number(v['3. low'] ?? 0),
        close: Number(v['4. close'] ?? 0),
        volume: 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-100);

  if (candles.length === 0) return Promise.resolve();

  return ctx.setDoc(`market_series/${symbol}`, {
    symbol,
    assetClass: 'fx',
    asOf: candles[candles.length - 1].date,
    candles,
    updatedAt: ctx.now().toISOString(),
  });
}

function persistMovers(raw: unknown, ctx: PersistContext): Promise<void> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const map = (rows: unknown): Array<Record<string, unknown>> =>
    (Array.isArray(rows) ? rows : []).map((row) => (row ?? {}) as Record<string, unknown>);

  return ctx.setDoc('market_movers/latest', {
    asOf: ctx.now().toISOString(),
    gainers: map(r['top_gainers']).map(moverFromRow),
    losers: map(r['top_losers']).map(moverFromRow),
    mostActive: map(r['most_actively_traded']).map(moverFromRow),
    updatedAt: ctx.now().toISOString(),
  });
}

function moverFromRow(row: Record<string, unknown>) {
  return {
    symbol: String(row['ticker'] ?? ''),
    price: Number(row['price'] ?? 0),
    changeAmount: Number(row['change_amount'] ?? 0),
    changePercent: Number(String(row['change_percentage'] ?? '0%').replace('%', '')),
    volume: Number(row['volume'] ?? 0),
  };
}

function persistMacro(raw: unknown, ctx: PersistContext): Promise<void> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const data = Array.isArray(r['data']) ? (r['data'] as Array<Record<string, unknown>>) : [];
  if (data.length === 0) return Promise.resolve();

  const name = String(r['name'] ?? '');
  const unit = String(r['unit'] ?? '');
  const interval = String(r['interval'] ?? '');
  const points = data.map((d) => ({
    date: String(d['date'] ?? ''),
    value: Number(d['value'] ?? 0),
  }));

  const id = deriveMacroId(name);
  return ctx.setDoc(`macro/${id}`, {
    id,
    name,
    unit,
    interval,
    points,
    updatedAt: ctx.now().toISOString(),
  });
}

function deriveMacroId(name: string): string {
  if (!name) return 'macro';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'macro';
}

function persistEarningsCalendar(raw: unknown, ctx: PersistContext): Promise<void> {
  return persistCalendar('calendars/earnings', raw, (row) => ({
    symbol: String(row['symbol'] ?? ''),
    name: String(row['name'] ?? ''),
    reportDate: String(row['reportDate'] ?? ''),
    fiscalDateEnding: String(row['fiscalDateEnding'] ?? ''),
    estimate: row['estimate'] === '' || row['estimate'] == null ? null : Number(row['estimate']),
    currency: String(row['currency'] ?? 'USD'),
  }), ctx);
}

function persistIpoCalendar(raw: unknown, ctx: PersistContext): Promise<void> {
  return persistCalendar('calendars/ipo', raw, (row) => ({
    symbol: String(row['symbol'] ?? ''),
    name: String(row['name'] ?? ''),
    ipoDate: String(row['ipoDate'] ?? ''),
    priceRangeLow: row['priceRangeLow'] === '' || row['priceRangeLow'] == null ? null : Number(row['priceRangeLow']),
    priceRangeHigh: row['priceRangeHigh'] === '' || row['priceRangeHigh'] == null ? null : Number(row['priceRangeHigh']),
    exchange: String(row['exchange'] ?? ''),
  }), ctx);
}

function persistCalendar(
  path: string,
  raw: unknown,
  mapRow: (row: Record<string, unknown>) => Record<string, unknown>,
  ctx: PersistContext
): Promise<void> {
  const rows = Array.isArray(raw) ? raw : [];
  return ctx.setDoc(path, {
    fetchedAt: ctx.now().toISOString(),
    events: rows.map((row) => mapRow((row ?? {}) as Record<string, unknown>)),
  });
}

function persistSymbolUniverse(raw: unknown, ctx: PersistContext): Promise<void> {
  // LISTING_STATUS returns CSV text. The client parses it and we store a
  // chunked universe. The raw here is the parsed rows array.
  const rows = Array.isArray(raw) ? raw : [];
  const chunkSize = 5000;
  const chunks: Promise<void>[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    chunks.push(
      ctx.setDoc(`symbols/universe_chunk_${Math.floor(i / chunkSize)}`, {
        symbols: chunk,
        updatedAt: ctx.now().toISOString(),
      })
    );
  }
  return Promise.all(chunks).then(() => undefined);
}

// ---------------------------------------------------------------------------
// Small shared helpers (mirror of the current news.service.ts; Phase 2 moves
// these to src/app/core/article-id.util.ts).
// ---------------------------------------------------------------------------

export function buildArticleDocId(article: { title?: string; sourceName?: string; publishedAt?: string }): string {
  const titleSlug = (article.title || 'article')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const sourceSlug = (article.sourceName || 'source')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const dateSlug = article.publishedAt ? article.publishedAt.slice(0, 10) : 'unknown';
  return `${sourceSlug}-${titleSlug}-${dateSlug}`.slice(0, 120);
}

export function buildTopicDocId(topic: string): string {
  return topic.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topic';
}

export function formatPublishedAt(timePublished?: string): string {
  if (!timePublished) return '';
  const normalized = timePublished.trim();
  const compactValue = normalized.replace(/[-:T/Z\s]/g, '');
  const compactMatch = compactValue.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day, hour, minute, second] = compactMatch;
    const parsedMonth = Number(month);
    const parsedDay = Number(day);
    const parsedHour = Number(hour);
    const parsedMinute = Number(minute);
    const parsedSecond = Number(second);
    if (
      parsedMonth < 1 || parsedMonth > 12 ||
      parsedDay < 1 || parsedDay > 31 ||
      parsedHour < 0 || parsedHour > 23 ||
      parsedMinute < 0 || parsedMinute > 59 ||
      parsedSecond < 0 || parsedSecond > 59
    ) {
      return '';
    }
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
  const parsedDate = new Date(normalized);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString();
}
