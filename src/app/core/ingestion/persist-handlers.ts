/**
 * Persist handlers — pure functions that transform raw Alpha Vantage
 * responses into Firestore documents.  Each handler takes the raw
 * API response and a Firestore instance, then writes to the schema
 * defined in the build plan (Phase 2).
 *
 * These have no Angular dependency — they receive Firestore as a
 * parameter so the same logic can be reused in a Cloud Function
 * entry point later (Phase 1.6 escape hatch).
 */

import {
  Firestore,
  doc,
  setDoc,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
  DocumentReference,
} from '@angular/fire/firestore';
import { buildArticleDocId } from '../article-id.util';
import { parseCsvLine } from './alpha-vantage.client';
import {
  Candle,
  QuoteSnapshot,
  Mover,
  MacroSeries,
} from '../../models/instrument.model';

// ────────────────────────────────────────────────────────────
// Alpha Vantage response shape interfaces
// ────────────────────────────────────────────────────────────

interface AvNewsFeedItem {
  title?: string;
  url?: string;
  time_published?: string;
  authors?: string[];
  summary?: string;
  source?: string;
  banner_image?: string;
  topics?: Array<{ topic?: string; relevance_score?: string }>;
  overall_sentiment_score?: string;
  overall_sentiment_label?: string;
  ticker_sentiment?: Array<{
    ticker?: string;
    relevance_score?: string;
    ticker_sentiment_score?: string;
    ticker_sentiment_label?: string;
  }>;
}

interface AvNewsResponse {
  feed?: AvNewsFeedItem[];
}

interface AvTimeSeriesDailyResponse {
  'Meta Data'?: Record<string, unknown>;
  'Time Series (Daily)'?: Record<
    string,
    {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. volume': string;
    }
  >;
}

interface AvMoversResponse {
  metadata?: string;
  top_gainers?: Array<{
    ticker: string;
    price: string;
    change_amount: string;
    change_percentage: string;
    volume: string;
  }>;
  top_losers?: Array<{
    ticker: string;
    price: string;
    change_amount: string;
    change_percentage: string;
    volume: string;
  }>;
  most_actively_traded?: Array<{
    ticker: string;
    price: string;
    change_amount: string;
    change_percentage: string;
    volume: string;
  }>;
}

interface AvTreasuryResponse {
  name?: string;
  interval?: string;
  unit?: string;
  data?: Array<{ date: string; value: string }>;
}

interface AvCryptoResponse {
  ['Meta Data']?: Record<string, unknown>;
  ['Time Series (Digital Currency Daily)']?: Record<
    string,
    Record<string, string>
  >;
}

interface AvMacroResponse {
  name?: string;
  interval?: string;
  unit?: string;
  data?: Array<{ date: string; value: string }>;
}

// ────────────────────────────────────────────────────────────
// Helper: safely parse a float from Alpha Vantage string
// ────────────────────────────────────────────────────────────

function toNum(val: string | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(dateStr: string): string {
  // Alpha Vantage uses "20240821" or "2024-08-21"
  const cleaned = dateStr.replace(/-/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }
  return dateStr;
}

// ────────────────────────────────────────────────────────────
// NEWS persist handlers
// ────────────────────────────────────────────────────────────

function formatAvTimestamp(timePublished: string): string {
  const compact = timePublished.replace(/[-:T/Z\s]/g, '');
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    const [, y, m, d, h, min, s] = match;
    return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  }
  return timePublished;
}

function extractTopics(item: AvNewsFeedItem): string[] {
  return (item.topics ?? [])
    .map((t) => t.topic)
    .filter((t): t is string => !!t)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function extractTopicRelevance(
  item: AvNewsFeedItem
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of item.topics ?? []) {
    if (t.topic && t.relevance_score) {
      map[t.topic] = toNum(t.relevance_score);
    }
  }
  return map;
}

/**
 * Persist a NEWS_SENTIMENT response.  Writes individual article
 * docs and updates the topics collection.
 */
export async function persistNews(
  raw: unknown,
  firestore: Firestore
): Promise<void> {
  const response = raw as AvNewsResponse;
  const feed = response.feed ?? [];
  const newsRef = collection(firestore, 'news');
  const topicsRef = collection(firestore, 'topics');

  // Fetch existing docs to avoid overwrites
  const existingNewsSnap = await getDocs(newsRef);
  const existingNewsIds = new Set(existingNewsSnap.docs.map((d) => d.id));

  const existingTopicsSnap = await getDocs(topicsRef);
  const topicMap = new Map<string, { name: string; newsIds: string[] }>();
  for (const d of existingTopicsSnap.docs) {
    const data = d.data();
    topicMap.set(d.id, {
      name: data['name'] ?? '',
      newsIds: Array.isArray(data['newsIds']) ? data['newsIds'] : [],
    });
  }

  const newTopics = new Map<string, Set<string>>();

  for (const item of feed) {
    const publishedAt = item.time_published
      ? formatAvTimestamp(item.time_published)
      : '';
    const articleId = buildArticleDocId({
      title: item.title ?? '',
      sourceName: item.source ?? '',
      publishedAt,
    });

    if (existingNewsIds.has(articleId)) continue;

    const topics = extractTopics(item);

    const docData = {
      title: item.title ?? 'Untitled article',
      summary: item.summary ?? '',
      imageUrl: item.banner_image ?? '',
      sourceUrl: item.url ?? '#',
      sourceName: item.source ?? 'Unknown source',
      publishedAt,
      authors: item.authors ?? [],
      topics,
      topicIds: topics.map((t) =>
        t
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'topic'
      ),
      // Sentiment fields (Phase 2)
      overallSentimentScore: toNum(item.overall_sentiment_score),
      overallSentimentLabel: item.overall_sentiment_label ?? 'Neutral',
      tickerSentiment: (item.ticker_sentiment ?? []).map((ts) => ({
        ticker: ts.ticker ?? '',
        relevanceScore: toNum(ts.relevance_score),
        sentimentScore: toNum(ts.ticker_sentiment_score),
        sentimentLabel: ts.ticker_sentiment_label ?? 'Neutral',
      })),
      topicRelevance: extractTopicRelevance(item),
      publishedAtDate: new Date(publishedAt),
    };

    await setDoc(doc(newsRef, articleId), docData);
    existingNewsIds.add(articleId);

    // Track topic-article associations
    for (const topic of topics) {
      const topicId = topic
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'topic';
      if (!newTopics.has(topicId)) {
        newTopics.set(topicId, new Set());
      }
      newTopics.get(topicId)!.add(articleId);
    }
  }

  // Update topics collection
  for (const [topicId, articleIds] of newTopics) {
    const existing = topicMap.get(topicId);
    const mergedNewsIds = new Set([
      ...(existing?.newsIds ?? []),
      ...articleIds,
    ]);
    await setDoc(
      doc(topicsRef, topicId),
      {
        name: existing?.name ?? topicId,
        newsIds: Array.from(mergedNewsIds),
      },
      { merge: true }
    );
  }
}

// ────────────────────────────────────────────────────────────
// MOVERS persist handler
// ────────────────────────────────────────────────────────────

function parseMovers(
  items: AvMoversResponse['top_gainers']
): Mover[] {
  return (items ?? []).map((m) => ({
    symbol: m.ticker,
    price: toNum(m.price),
    changeAmount: toNum(m.change_amount),
    changePercent: toNum(m.change_percentage?.replace('%', '')),
    volume: toNum(m.volume),
  }));
}

/**
 * Persist TOP_GAINERS_LOSERS data to `market_movers/latest`.
 */
export async function persistMovers(
  raw: unknown,
  firestore: Firestore
): Promise<void> {
  const response = raw as AvMoversResponse;
  const docRef = doc(firestore, 'market_movers/latest');
  await setDoc(docRef, {
    asOf: new Date().toISOString(),
    gainers: parseMovers(response.top_gainers),
    losers: parseMovers(response.top_losers),
    mostActive: parseMovers(response.most_actively_traded),
  });
}

// ────────────────────────────────────────────────────────────
// TIME_SERIES_DAILY persist handler (index proxies + sectors)
// ────────────────────────────────────────────────────────────

function parseTimeSeriesDaily(
  raw: AvTimeSeriesDailyResponse,
  symbol: string,
  assetClass: 'etf' | 'equity' | 'fx'
): { candles: Candle[]; snapshot: QuoteSnapshot } | null {
  const ts = raw['Time Series (Daily)'];
  if (!ts) return null;

  const dates = Object.keys(ts).sort(); // ascending
  if (dates.length === 0) return null;

  const candles: Candle[] = dates.map((date) => {
    const d = ts[date];
    return {
      date,
      open: toNum(d['1. open']),
      high: toNum(d['2. high']),
      low: toNum(d['3. low']),
      close: toNum(d['4. close']),
      volume: toNum(d['5. volume']),
    };
  });

  // Use the most recent close as current price
  const latest = candles[candles.length - 1];
  const previousClose =
    candles.length >= 2 ? candles[candles.length - 2].close : latest.close;
  const change = latest.close - previousClose;
  const changePercent =
    previousClose !== 0 ? (change / previousClose) * 100 : 0;

  // 30-day sparkline (last 30 closes)
  const sparkline = candles.slice(-30).map((c) => c.close);

  // 3-month range (approximately 63 trading days)
  const rangeWindow = candles.slice(-63);
  const rangeLow = Math.min(...rangeWindow.map((c) => c.low));
  const rangeHigh = Math.max(...rangeWindow.map((c) => c.high));

  const snapshot: QuoteSnapshot = {
    symbol,
    price: latest.close,
    previousClose,
    change,
    changePercent,
    asOf: latest.date,
    rangeLow,
    rangeHigh,
    sparkline,
  };

  return { candles, snapshot };
}

/**
 * Persist TIME_SERIES_DAILY for an index proxy or sector ETF.
 * Writes to `market_series/{symbol}` (candles array) and
 * updates `market_snapshot/dashboard` (quote snapshot).
 */
export async function persistTimeSeriesDaily(
  raw: unknown,
  symbol: string,
  assetClass: 'etf' | 'equity' | 'fx',
  firestore: Firestore
): Promise<void> {
  const parsed = parseTimeSeriesDaily(
    raw as AvTimeSeriesDailyResponse,
    symbol,
    assetClass
  );
  if (!parsed) return;

  // Write candles document
  const seriesRef = doc(firestore, `market_series/${symbol}`);
  await setDoc(seriesRef, {
    symbol,
    assetClass,
    asOf: parsed.candles[parsed.candles.length - 1]?.date ?? '',
    candles: parsed.candles,
  });

  // Update the denormalized dashboard snapshot
  await updateDashboardSnapshot(symbol, parsed.snapshot, firestore);
}

/**
 * Add/update a QuoteSnapshot in the denormalized dashboard doc.
 * Uses a Map internally to merge snapshots from multiple symbols.
 */
const dashboardSnapshots = new Map<string, QuoteSnapshot>();
let dashboardFlushTimer: ReturnType<typeof setTimeout> | null = null;

async function updateDashboardSnapshot(
  symbol: string,
  snapshot: QuoteSnapshot,
  firestore: Firestore
): Promise<void> {
  dashboardSnapshots.set(symbol, snapshot);

  // Debounce: flush to Firestore after 2 seconds of no updates
  // (batches multiple symbol updates from the same tick)
  if (dashboardFlushTimer) clearTimeout(dashboardFlushTimer);
  dashboardFlushTimer = setTimeout(async () => {
    const snapRef = doc(firestore, 'market_snapshot/dashboard');
    const data: Record<string, unknown> = {
      asOf: new Date().toISOString(),
    };
    for (const [sym, snap] of dashboardSnapshots) {
      data[sym] = snap;
    }
    dashboardSnapshots.clear();
    await setDoc(snapRef, data, { merge: true });
  }, 2000);
}

// ────────────────────────────────────────────────────────────
// TREASURY YIELD persist handler
// ────────────────────────────────────────────────────────────

/**
 * Persist TREASURY_YIELD data to `macro/{id}`.
 */
export async function persistTreasuryYield(
  raw: unknown,
  indicatorId: string,
  firestore: Firestore
): Promise<void> {
  const response = raw as AvTreasuryResponse;
  const points = (response.data ?? [])
    .map((d) => ({ date: d.date, value: toNum(d.value) }))
    .filter((p) => p.value > 0);

  const series: MacroSeries = {
    id: indicatorId,
    name: response.name ?? indicatorId,
    unit: response.unit ?? 'percent',
    interval: response.interval ?? 'daily',
    points,
  };

  const ref = doc(firestore, `macro/${indicatorId}`);
  await setDoc(ref, series);
}

// ────────────────────────────────────────────────────────────
// DIGITAL_CURRENCY_DAILY persist handler (BTC, ETH)
// ────────────────────────────────────────────────────────────

/**
 * Persist DIGITAL_CURRENCY_DAILY to `market_series/{symbol}-USD`
 * and update the dashboard snapshot.
 */
export async function persistCryptoDaily(
  raw: unknown,
  symbol: string,
  firestore: Firestore
): Promise<void> {
  const response = raw as AvCryptoResponse;
  const ts =
    response['Time Series (Digital Currency Daily)'] ?? {};
  const dates = Object.keys(ts).sort();
  if (dates.length === 0) return;

  const candles: Candle[] = dates.map((date) => {
    const d = ts[date];
    const closeKey = `4a. close (USD)`;
    const openKey = `1a. open (USD)`;
    const highKey = `2a. high (USD)`;
    const lowKey = `3a. low (USD)`;
    const volKey = `5. volume`;
    return {
      date,
      open: toNum(d[openKey]),
      high: toNum(d[highKey]),
      low: toNum(d[lowKey]),
      close: toNum(d[closeKey]),
      volume: toNum(d[volKey]),
    };
  });

  const latest = candles[candles.length - 1];
  const previousClose =
    candles.length >= 2 ? candles[candles.length - 2].close : latest.close;
  const change = latest.close - previousClose;
  const changePercent =
    previousClose !== 0 ? (change / previousClose) * 100 : 0;
  const sparkline = candles.slice(-30).map((c) => c.close);

  const docId = `${symbol}-USD`;
  const seriesRef = doc(firestore, `market_series/${docId}`);
  await setDoc(seriesRef, {
    symbol: docId,
    assetClass: 'crypto',
    asOf: latest.date,
    candles,
  });

  const snapshot: QuoteSnapshot = {
    symbol: docId,
    price: latest.close,
    previousClose,
    change,
    changePercent,
    asOf: latest.date,
    rangeLow: Math.min(...candles.slice(-63).map((c) => c.low)),
    rangeHigh: Math.max(...candles.slice(-63).map((c) => c.high)),
    sparkline,
  };
  await updateDashboardSnapshot(docId, snapshot, firestore);
}

// ────────────────────────────────────────────────────────────
// MACRO indicator persist handlers (CPI, unemployment, etc.)
// ────────────────────────────────────────────────────────────

/**
 * Persist generic macro data (CPI, unemployment, fed funds, GDP,
 * retail sales) to `macro/{indicatorId}`.
 */
export async function persistMacroIndicator(
  raw: unknown,
  indicatorId: string,
  firestore: Firestore
): Promise<void> {
  const response = raw as AvMacroResponse;
  const points = (response.data ?? [])
    .map((d) => ({ date: d.date, value: toNum(d.value) }))
    .filter((p) => p.value > 0);

  const series: MacroSeries = {
    id: indicatorId,
    name: response.name ?? indicatorId,
    unit: response.unit ?? '',
    interval: response.interval ?? '',
    points,
  };

  const ref = doc(firestore, `macro/${indicatorId}`);
  await setDoc(ref, series);
}

// ────────────────────────────────────────────────────────────
// CALENDAR persist handlers (earnings, IPO)
// ────────────────────────────────────────────────────────────

export async function persistEarningsCalendar(
  raw: unknown,
  firestore: Firestore
): Promise<void> {
  const csvText = raw as string;
  const rows = parseCsvLine(csvText);
  if (rows.length < 2) return; // header + at least one data row

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const symbolIdx = header.indexOf('symbol');
  const nameIdx = header.indexOf('name');
  const reportDateIdx = header.indexOf('reportdate');
  const fiscalDateIdx = header.indexOf('fiscaldateending');
  const estimateIdx = header.indexOf('estimate');
  const currencyIdx = header.indexOf('currency');

  const events = rows.slice(1).map((row) => ({
    symbol: symbolIdx >= 0 ? row[symbolIdx] ?? '' : '',
    name: nameIdx >= 0 ? row[nameIdx] ?? '' : '',
    reportDate: reportDateIdx >= 0 ? row[reportDateIdx] ?? '' : '',
    fiscalDateEnding:
      fiscalDateIdx >= 0 ? row[fiscalDateIdx] ?? '' : '',
    estimate:
      estimateIdx >= 0 && row[estimateIdx]
        ? toNum(row[estimateIdx])
        : null,
    currency: currencyIdx >= 0 ? row[currencyIdx] ?? '' : '',
  }));

  const ref = doc(firestore, 'calendars/earnings');
  await setDoc(ref, {
    fetchedAt: new Date().toISOString(),
    events,
  });
}

export async function persistIpoCalendar(
  raw: unknown,
  firestore: Firestore
): Promise<void> {
  const csvText = raw as string;
  const rows = parseCsvLine(csvText);
  if (rows.length < 2) return;

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const symbolIdx = header.indexOf('symbol');
  const nameIdx = header.indexOf('name');
  const ipoDateIdx = header.indexOf('ipodate');
  const priceLowIdx = header.indexOf('pricelowlowest') !== -1
    ? header.indexOf('pricelowlowest')
    : header.indexOf('price low');
  const priceHighIdx = header.indexOf('pricehighhighest') !== -1
    ? header.indexOf('pricehighhighest')
    : header.indexOf('price high');
  const exchangeIdx = header.indexOf('exchange');

  const events = rows.slice(1).map((row) => ({
    symbol: symbolIdx >= 0 ? row[symbolIdx] ?? '' : '',
    name: nameIdx >= 0 ? row[nameIdx] ?? '' : '',
    ipoDate: ipoDateIdx >= 0 ? row[ipoDateIdx] ?? '' : '',
    priceRangeLow:
      priceLowIdx >= 0 && row[priceLowIdx]
        ? toNum(row[priceLowIdx])
        : null,
    priceRangeHigh:
      priceHighIdx >= 0 && row[priceHighIdx]
        ? toNum(row[priceHighIdx])
        : null,
    exchange: exchangeIdx >= 0 ? row[exchangeIdx] ?? '' : '',
  }));

  const ref = doc(firestore, 'calendars/ipo');
  await setDoc(ref, {
    fetchedAt: new Date().toISOString(),
    events,
  });
}

// ────────────────────────────────────────────────────────────
// UNIVERSE (LISTING_STATUS) persist handler
// ────────────────────────────────────────────────────────────

/**
 * Persist LISTING_STATUS CSV to `symbols/universe` as a chunked
 * document.  The CSV contains every active US symbol — used for
 * search autocomplete.
 */
export async function persistUniverse(
  raw: unknown,
  firestore: Firestore
): Promise<void> {
  const csvText = raw as string;
  const rows = parseCsvLine(csvText);
  if (rows.length < 2) return;

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const symbolIdx = header.indexOf('symbol');
  const nameIdx = header.indexOf('name');
  const typeIdx = header.indexOf('type');
  const exchangeIdx = header.indexOf('exchange');
  const statusIdx = header.indexOf('status');

  const symbols = rows
    .slice(1)
    .filter((row) => {
      // Only keep active entries
      const status = statusIdx >= 0 ? row[statusIdx]?.toLowerCase() : '';
      return status === 'active';
    })
    .map((row) => ({
      symbol: symbolIdx >= 0 ? row[symbolIdx] ?? '' : '',
      name: nameIdx >= 0 ? row[nameIdx] ?? '' : '',
      type: typeIdx >= 0 ? row[typeIdx] ?? '' : '',
      exchange: exchangeIdx >= 0 ? row[exchangeIdx] ?? '' : '',
    }));

  // Store as a single document (Firestore doc limit is 1MB,
  // ~10k symbols * ~80 bytes each ≈ 800KB, should fit)
  // If it exceeds limits in the future, split into chunks.
  const ref = doc(firestore, 'symbols/universe');
  await setDoc(ref, {
    fetchedAt: new Date().toISOString(),
    count: symbols.length,
    symbols,
  });
}

// ────────────────────────────────────────────────────────────
// On-demand persist handlers (user-initiated ticker lookups)
// ────────────────────────────────────────────────────────────

/**
 * Persist an on-demand TIME_SERIES_DAILY fetch for a user-requested ticker.
 */
export async function persistOnDemandSeriesDaily(
  raw: unknown,
  symbol: string,
  firestore: Firestore
): Promise<void> {
  // Reuse the same logic as scheduled time series
  await persistTimeSeriesDaily(raw, symbol, 'equity', firestore);
}

/**
 * Persist an on-demand OVERVIEW fetch to `fundamentals/{symbol}`.
 */
export async function persistOnDemandOverview(
  raw: unknown,
  symbol: string,
  firestore: Firestore
): Promise<void> {
  const overview = raw as Record<string, unknown>;
  const ref = doc(firestore, `fundamentals/${symbol}`);
  await setDoc(
    ref,
    {
      symbol,
      name: overview['Name'] ?? '',
      description: overview['Description'] ?? '',
      marketCap: toNum(overview['MarketCapitalization'] as string),
      peRatio: toNum(overview['PERatio'] as string),
      eps: toNum(overview['EPS'] as string),
      dividendYield: toNum(overview['DividendYield'] as string),
      beta: toNum(overview['Beta'] as string),
      weekFiftyTwoHigh: toNum(
        overview['52WeekHigh'] as string
      ),
      weekFiftyTwoLow: toNum(
        overview['52WeekLow'] as string
      ),
      sector: overview['Sector'] ?? '',
      industry: overview['Industry'] ?? '',
      fetchedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Persist an on-demand EARNINGS fetch to `fundamentals/{symbol}`.
 */
export async function persistOnDemandEarnings(
  raw: unknown,
  symbol: string,
  firestore: Firestore
): Promise<void> {
  const earnings = raw as Record<string, unknown>;
  const annualEarnings = (earnings['annualEarnings'] ?? []) as Array<
    Record<string, unknown>
  >;
  const quarterlyEarnings = (earnings['quarterlyEarnings'] ?? []) as Array<
    Record<string, unknown>
  >;

  const ref = doc(firestore, `fundamentals/${symbol}`);
  await setDoc(
    ref,
    {
      symbol,
      earnings: {
        annual: annualEarnings.map((e) => ({
          fiscalDateEnding: e['fiscalDateEnding'] ?? '',
          reportedEPS: toNum(e['reportedEPS'] as string),
        })),
        quarterly: quarterlyEarnings.map((e) => ({
          fiscalDateEnding: e['fiscalDateEnding'] ?? '',
          reportedDate: e['reportedDate'] ?? '',
          reportedEPS: toNum(e['reportedEPS'] as string),
          estimatedEPS: toNum(e['estimatedEPS'] as string),
          surprise: toNum(e['surprise'] as string),
          surprisePercentage: toNum(
            e['surprisePercentage'] as string
          ),
        })),
      },
      fetchedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
