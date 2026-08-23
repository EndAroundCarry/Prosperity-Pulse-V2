/**
 * Dataset registry — the single declarative budget table for all
 * Alpha Vantage data sources.  Adding a new source later means
 * appending one entry here.  Nothing else changes.
 *
 * The budget: 25 requests/day, 24 hourly ticks.  Each tick picks
 * the single most-overdue dataset and spends one call on it.
 */

import { PersistContext } from './alpha-vantage.client';
import {
  persistNews,
  persistMovers,
  persistTimeSeriesDaily,
  persistTreasuryYield,
  persistCryptoDaily,
  persistMacroIndicator,
  persistEarningsCalendar,
  persistIpoCalendar,
  persistUniverse,
  persistOnDemandSeriesDaily,
  persistOnDemandOverview,
  persistOnDemandEarnings,
} from './persist-handlers';

export type DatasetTier = 'A' | 'B' | 'C' | 'news' | 'ondemand';

export interface DatasetDefinition {
  /** Unique id, e.g. 'news.core', 'series.SPY', 'macro.CPI' */
  id: string;
  tier: DatasetTier;
  /** How fresh the data must be before it is considered stale */
  ttlMs: number;
  /** Alpha Vantage query params minus `apikey` and `function` */
  params: Record<string, string>;
  /** Whether the endpoint returns JSON or CSV */
  format: 'json' | 'csv';
  /** Pure function that persists raw response data to Firestore */
  persist: (raw: unknown, ctx: PersistContext) => Promise<void>;
  /**
   * Members of the same rotation group share one hourly slot via
   * round-robin.  Only Tier B and C datasets use this.
   */
  rotationGroup?: string;
  /** Human-readable name for debug/logging */
  label: string;
}

// ────────────────────────────────────────────────────────────
// Alpha Vantage function names
// ────────────────────────────────────────────────────────────
const NEWS_SENTIMENT = 'NEWS_SENTIMENT';
const TOP_GAINERS_LOSERS = 'TOP_GAINERS_LOSERS';
const TIME_SERIES_DAILY = 'TIME_SERIES_DAILY';
const TREASURY_YIELD = 'TREASURY_YIELD';
const DIGITAL_CURRENCY_DAILY = 'DIGITAL_CURRENCY_DAILY';
const OVERVIEW = 'OVERVIEW';
const EARNINGS = 'EARNINGS';
const LISTING_STATUS = 'LISTING_STATUS';

// ────────────────────────────────────────────────────────────
// Sector ETFs (Tier B rotation)
// ────────────────────────────────────────────────────────────
const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLV', name: 'Health Care' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLY', name: 'Consumer Discretionary' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Communication Services' },
];

const EXTRA_ROTATION = [
  { symbol: 'IWM', name: 'Russell 2000' },
  { symbol: 'GLD', name: 'Gold' },
  { symbol: 'USO', name: 'Oil' },
  { symbol: 'ETH-USD', name: 'Ethereum' },
  { symbol: 'EURUSD', name: 'EUR/USD', fx: true },
];

// ────────────────────────────────────────────────────────────
// Persist handler factories
// ────────────────────────────────────────────────────────────

function newsPersist() {
  return (raw: unknown, ctx: PersistContext) =>
    persistNews(raw, ctx.firestore);
}

function moversPersist() {
  return (raw: unknown, ctx: PersistContext) =>
    persistMovers(raw, ctx.firestore);
}

function seriesDailyPersist(symbol: string, assetClass: 'etf' | 'equity' | 'fx' = 'etf') {
  return (raw: unknown, ctx: PersistContext) =>
    persistTimeSeriesDaily(raw, symbol, assetClass, ctx.firestore);
}

function treasuryYieldPersist(id: string) {
  return (raw: unknown, ctx: PersistContext) =>
    persistTreasuryYield(raw, id, ctx.firestore);
}

function cryptoDailyPersist(symbol: string) {
  return (raw: unknown, ctx: PersistContext) =>
    persistCryptoDaily(raw, symbol, ctx.firestore);
}

function macroPersist(indicatorId: string) {
  return (raw: unknown, ctx: PersistContext) =>
    persistMacroIndicator(raw, indicatorId, ctx.firestore);
}

function earningsCalendarPersist() {
  return (raw: unknown, ctx: PersistContext) =>
    persistEarningsCalendar(raw, ctx.firestore);
}

function ipoCalendarPersist() {
  return (raw: unknown, ctx: PersistContext) =>
    persistIpoCalendar(raw, ctx.firestore);
}

function universePersist() {
  return (raw: unknown, ctx: PersistContext) =>
    persistUniverse(raw, ctx.firestore);
}

// ────────────────────────────────────────────────────────────
// Dataset definitions
// ────────────────────────────────────────────────────────────

/** News: financial_markets (core, refreshed every 6h) */
const NEWS_CORE: DatasetDefinition = {
  id: 'news.core',
  tier: 'news',
  ttlMs: 6 * 60 * 60 * 1000,
  params: {
    function: NEWS_SENTIMENT,
    topics: 'financial_markets',
    limit: '1000',
  },
  format: 'json',
  persist: newsPersist(),
  label: 'News — Financial Markets',
};

/** News: earnings/ipo/mergers (refreshed every 24h) */
const NEWS_SECONDARY: DatasetDefinition = {
  id: 'news.secondary',
  tier: 'news',
  ttlMs: 24 * 60 * 60 * 1000,
  params: {
    function: NEWS_SENTIMENT,
    topics: 'earnings,ipo,mergers_and_acquisitions',
    limit: '500',
  },
  format: 'json',
  persist: newsPersist(),
  label: 'News — Earnings/IPO/M&A',
};

/** Top gainers, losers, and most active (every 12h) */
const MOVERS: DatasetDefinition = {
  id: 'movers',
  tier: 'A',
  ttlMs: 12 * 60 * 60 * 1000,
  params: { function: TOP_GAINERS_LOSERS },
  format: 'json',
  persist: moversPersist(),
  label: 'Top Movers',
};

/** Index proxy ETFs (Tier A, daily) */
function indexProxy(
  sym: string,
  name: string,
  proxyFor: string
): DatasetDefinition {
  return {
    id: `series.${sym}`,
    tier: 'A',
    ttlMs: 24 * 60 * 60 * 1000,
    params: { function: TIME_SERIES_DAILY, symbol: sym },
    format: 'json',
    persist: seriesDailyPersist(sym, 'etf'),
    label: `${sym} — ${name} proxy for ${proxyFor}`,
  };
}

/** Treasury yield (Tier A, daily) */
function treasuryYield(
  id: string,
  label: string,
  maturity: string,
  ttlDays: number
): DatasetDefinition {
  return {
    id,
    tier: 'A',
    ttlMs: ttlDays * 24 * 60 * 60 * 1000,
    params: { function: TREASURY_YIELD, interval: 'daily', maturity },
    format: 'json',
    persist: treasuryYieldPersist(id),
    label,
  };
}

/** Crypto daily (Tier A, daily) */
function cryptoDaily(sym: string, name: string): DatasetDefinition {
  return {
    id: `crypto.${sym}`,
    tier: 'A',
    ttlMs: 24 * 60 * 60 * 1000,
    params: { function: DIGITAL_CURRENCY_DAILY, symbol: sym, market: 'USD' },
    format: 'json',
    persist: cryptoDailyPersist(sym),
    label: `${name} (${sym})`,
  };
}

/** Sector / extra rotation ETFs (Tier B, ~5-day cycle) */
const SECTOR_DATASETS: DatasetDefinition[] = [
  ...SECTOR_ETFS.map((e) => ({
    id: `sector.${e.symbol}`,
    tier: 'B' as DatasetTier,
    ttlMs: 5 * 24 * 60 * 60 * 1000,
    params: { function: TIME_SERIES_DAILY, symbol: e.symbol },
    format: 'json' as const,
    persist: seriesDailyPersist(e.symbol, 'etf'),
    rotationGroup: 'sector_etfs',
    label: `${e.name} sector (${e.symbol})`,
  })),
  ...EXTRA_ROTATION.map((e) => ({
    id: e.fx
      ? `fx.${e.symbol}`
      : e.symbol.startsWith('ETH')
        ? `crypto.${e.symbol}`
        : `etf.${e.symbol}`,
    tier: 'B' as DatasetTier,
    ttlMs: 5 * 24 * 60 * 60 * 1000,
    params: e.fx
      ? { function: TIME_SERIES_DAILY, symbol: e.symbol }
      : {
          function: e.symbol.startsWith('ETH')
            ? DIGITAL_CURRENCY_DAILY
            : TIME_SERIES_DAILY,
          ...(e.symbol.startsWith('ETH')
            ? { symbol: e.symbol.split('-')[0], market: 'USD' }
            : { symbol: e.symbol }),
        },
    format: 'json' as const,
    persist: e.symbol.startsWith('ETH')
      ? cryptoDailyPersist(e.symbol.split('-')[0])
      : seriesDailyPersist(
          e.symbol,
          e.fx ? 'fx' : 'etf'
        ),
    rotationGroup: 'sector_etfs',
    label: e.name,
  })),
];

/** Slow macro data (Tier C, weekly rotation) */
const MACRO_DATASETS: DatasetDefinition[] = [
  treasuryYield('macro.2y_yield', '2-Year Treasury Yield', '2year', 7),
  {
    id: 'macro.cpi',
    tier: 'C',
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    params: { function: 'CPI', interval: 'monthly' },
    format: 'json',
    persist: macroPersist('macro.cpi'),
    rotationGroup: 'macro',
    label: 'CPI / Inflation',
  },
  {
    id: 'macro.unemployment',
    tier: 'C',
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    params: { function: 'UNEMPLOYMENT' },
    format: 'json',
    persist: macroPersist('macro.unemployment'),
    rotationGroup: 'macro',
    label: 'Unemployment Rate',
  },
  {
    id: 'macro.fed_funds',
    tier: 'C',
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    params: { function: 'FEDERAL_FUNDS_RATE' },
    format: 'json',
    persist: macroPersist('macro.fed_funds'),
    rotationGroup: 'macro',
    label: 'Federal Funds Rate',
  },
  {
    id: 'macro.gdp',
    tier: 'C',
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    params: { function: 'REAL_GDP', interval: 'quarterly' },
    format: 'json',
    persist: macroPersist('macro.gdp'),
    rotationGroup: 'macro',
    label: 'Real GDP',
  },
  {
    id: 'macro.retail_sales',
    tier: 'C',
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    params: { function: 'RETAIL_SALES' },
    format: 'json',
    persist: macroPersist('macro.retail_sales'),
    rotationGroup: 'macro',
    label: 'Retail Sales',
  },
];

/** Calendar datasets (Tier C, weekly) */
const CALENDAR_DATASETS: DatasetDefinition[] = [
  {
    id: 'calendar.earnings',
    tier: 'C',
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    params: { function: 'EARNINGS_CALENDAR' },
    format: 'csv',
    persist: earningsCalendarPersist(),
    label: 'Earnings Calendar',
  },
  {
    id: 'calendar.ipo',
    tier: 'C',
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    params: { function: 'IPO_CALENDAR' },
    format: 'csv',
    persist: ipoCalendarPersist(),
    label: 'IPO Calendar',
  },
];

/** Universe: LISTING_STATUS for search autocomplete (every 30 days) */
const UNIVERSE: DatasetDefinition = {
  id: 'universe',
  tier: 'C',
  ttlMs: 30 * 24 * 60 * 60 * 1000,
  params: { function: LISTING_STATUS },
  format: 'csv',
  persist: universePersist(),
  label: 'Stock Universe (all US symbols)',
};

// ────────────────────────────────────────────────────────────
// On-demand datasets (user-initiated ticker lookups, not
// scheduled — drawn from leftover budget)
// ────────────────────────────────────────────────────────────

export function onDemandSeriesDaily(symbol: string): DatasetDefinition {
  return {
    id: `ondemand.series.${symbol}`,
    tier: 'ondemand',
    ttlMs: 24 * 60 * 60 * 1000,
    params: { function: TIME_SERIES_DAILY, symbol },
    format: 'json',
    persist: (raw, ctx) => persistOnDemandSeriesDaily(raw, symbol, ctx.firestore),
    label: `On-demand: ${symbol} daily series`,
  };
}

export function onDemandOverview(symbol: string): DatasetDefinition {
  return {
    id: `ondemand.overview.${symbol}`,
    tier: 'ondemand',
    ttlMs: 24 * 60 * 60 * 1000,
    params: { function: OVERVIEW, symbol },
    format: 'json',
    persist: (raw, ctx) => persistOnDemandOverview(raw, symbol, ctx.firestore),
    label: `On-demand: ${symbol} overview`,
  };
}

export function onDemandEarnings(symbol: string): DatasetDefinition {
  return {
    id: `ondemand.earnings.${symbol}`,
    tier: 'ondemand',
    ttlMs: 24 * 60 * 60 * 1000,
    params: { function: EARNINGS, symbol },
    format: 'json',
    persist: (raw, ctx) => persistOnDemandEarnings(raw, symbol, ctx.firestore),
    label: `On-demand: ${symbol} earnings`,
  };
}

// ────────────────────────────────────────────────────────────
// Master registry — the ordered list of all scheduled datasets
// ────────────────────────────────────────────────────────────

export const DATASET_REGISTRY: DatasetDefinition[] = [
  // News (highest refresh rate)
  NEWS_CORE,
  NEWS_SECONDARY,
  // Movers (best value: gainers + losers + most-active in one call)
  MOVERS,
  // Index proxies (Tier A)
  indexProxy('SPY', 'S&P 500 ETF', 'S&P 500'),
  indexProxy('QQQ', 'Nasdaq 100 ETF', 'Nasdaq 100'),
  indexProxy('DIA', 'Dow Jones ETF', 'Dow Jones'),
  indexProxy('IWM', 'Russell 2000 ETF', 'Russell 2000'),
  // Rates (Tier A)
  treasuryYield('rate.10y', '10-Year Treasury Yield', '10year', 1),
  // Crypto (Tier A)
  cryptoDaily('BTC', 'Bitcoin'),
  // Sector + extra rotation (Tier B)
  ...SECTOR_DATASETS,
  // Slow macro (Tier C)
  ...MACRO_DATASETS,
  // Calendars (Tier C)
  ...CALENDAR_DATASETS,
  // Universe (Tier C)
  UNIVERSE,
];

/**
 * Look up a dataset by id.  Returns undefined for unknown ids
 * (e.g. on-demand datasets that aren't in the registry).
 */
export function findDataset(id: string): DatasetDefinition | undefined {
  return DATASET_REGISTRY.find((d) => d.id === id);
}
