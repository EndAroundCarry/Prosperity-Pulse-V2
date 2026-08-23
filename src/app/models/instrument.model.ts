/**
 * Market-data models (Phase 2). There were no market-data models before.
 */

export type AssetClass = 'equity' | 'etf' | 'crypto' | 'fx' | 'commodity' | 'rate' | 'macro';

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange?: string;
  /** e.g. proxyFor: 'SPY' -> 'S&P 500' */
  proxyFor?: string;
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Denormalized quote snapshot for one tile. Stored inside the single
 * `market_snapshot/dashboard` doc so the whole dashboard is one read.
 */
export interface QuoteSnapshot {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  proxyFor?: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  /** Trading date of the close, e.g. '2026-08-20'. */
  asOf: string;
  /** Over the loaded window. */
  rangeLow: number;
  rangeHigh: number;
  /** ~30 closes, pre-sliced for cheap rendering. */
  sparkline: number[];
}

export interface Mover {
  symbol: string;
  price: number;
  changeAmount: number;
  changePercent: number;
  volume: number;
}

export interface MacroSeries {
  id: string;
  name: string;
  unit: string;
  interval: string;
  points: { date: string; value: number }[];
}

export interface EarningsEvent {
  symbol: string;
  name: string;
  reportDate: string;
  fiscalDateEnding: string;
  estimate: number | null;
  currency: string;
}

export interface IpoEvent {
  symbol: string;
  name: string;
  ipoDate: string;
  priceRangeLow: number | null;
  priceRangeHigh: number | null;
  exchange: string;
}

/** Contents of the denormalized `market_snapshot/dashboard` doc. */
export interface DashboardSnapshot {
  updatedAt: string;
  quotes: QuoteSnapshot[];
}

export const SPARKLINE_POINTS = 30;
