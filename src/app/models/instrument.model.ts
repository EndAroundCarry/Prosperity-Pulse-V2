/**
 * Data models for market data, macro indicators, and calendar events.
 * See Phase 2 of the build plan for the full Firestore schema.
 */

export type AssetClass =
  | 'equity'
  | 'etf'
  | 'crypto'
  | 'fx'
  | 'commodity'
  | 'rate'
  | 'macro';

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange?: string;
  /** What index/commodity this ETF proxies (e.g. 'SPY' → 'S&P 500') */
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

export interface QuoteSnapshot {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  asOf: string;
  rangeLow: number;
  rangeHigh: number;
  /** ~30 closes, pre-sliced for sparkline rendering */
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
