/**
 * Market data service — reads all dashboard data from Firestore.
 *
 * Follows the schema from Phase 2:
 * - market_snapshot/dashboard  → single denormalized doc with all QuoteSnapshots
 * - market_movers/latest       → gainers, losers, most active
 * - market_series/{symbol}     → candle history per symbol
 * - macro/{indicatorId}        → macro indicator time series
 * - calendars/earnings         → earnings calendar
 * - calendars/ipo              → IPO calendar
 * - fundamentals/{symbol}      → on-demand ticker detail
 * - symbols/universe           → search autocomplete
 *
 * The dashboard reads market_snapshot/dashboard in ONE document read
 * regardless of how many tiles it shows — this is the key optimization.
 */

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  collection,
  collectionData,
} from '@angular/fire/firestore';
import { Observable, map, of, catchError } from 'rxjs';
import {
  QuoteSnapshot,
  Mover,
  Candle,
  MacroSeries,
  EarningsEvent,
  IpoEvent,
} from '../models/instrument.model';

// ────────────────────────────────────────────────────────────
// Dashboard snapshot (denormalized — one doc, many tiles)
// ────────────────────────────────────────────────────────────

export interface DashboardSnapshot {
  asOf: string;
  [symbol: string]: unknown; // Each key is a symbol with a QuoteSnapshot value
}

// ────────────────────────────────────────────────────────────
// Movers
// ────────────────────────────────────────────────────────────

export interface MoversDoc {
  asOf: string;
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
}

// ────────────────────────────────────────────────────────────
// Calendars
// ────────────────────────────────────────────────────────────

export interface EarningsCalendarDoc {
  fetchedAt: string;
  events: EarningsEvent[];
}

export interface IpoCalendarDoc {
  fetchedAt: string;
  events: IpoEvent[];
}

// ────────────────────────────────────────────────────────────
// Fundamentals
// ────────────────────────────────────────────────────────────

export interface FundamentalsDoc {
  symbol: string;
  name: string;
  description: string;
  marketCap: number;
  peRatio: number;
  eps: number;
  dividendYield: number;
  beta: number;
  weekFiftyTwoHigh: number;
  weekFiftyTwoLow: number;
  sector: string;
  industry: string;
  fetchedAt: string;
  earnings?: {
    annual: Array<{ fiscalDateEnding: string; reportedEPS: number }>;
    quarterly: Array<{
      fiscalDateEnding: string;
      reportedDate: string;
      reportedEPS: number;
      estimatedEPS: number;
      surprise: number;
      surprisePercentage: number;
    }>;
  };
}

// ────────────────────────────────────────────────────────────
// Universe (search autocomplete)
// ────────────────────────────────────────────────────────────

export interface UniverseDoc {
  fetchedAt: string;
  count: number;
  symbols: Array<{
    symbol: string;
    name: string;
    type: string;
    exchange: string;
  }>;
}

// ────────────────────────────────────────────────────────────
// Known index/ETF/crypto symbols for the dashboard
// ────────────────────────────────────────────────────────────

export const INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM'];
export const CRYPTO_SYMBOLS = ['BTC-USD', 'ETH-USD'];
export const FX_SYMBOLS = ['EURUSD'];
export const COMMODITY_SYMBOLS = ['GLD', 'USO'];
export const RATE_SYMBOLS = ['rate.10y', 'macro.2y_yield'];
export const MACRO_INDICATOR_IDS = [
  'macro.cpi',
  'macro.unemployment',
  'macro.fed_funds',
  'macro.gdp',
  'macro.retail_sales',
];

// Symbol → display label mapping
export const SYMBOL_LABELS: Record<string, string> = {
  SPY: 'S&P 500',
  QQQ: 'Nasdaq 100',
  DIA: 'Dow Jones',
  IWM: 'Russell 2000',
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  EURUSD: 'EUR/USD',
  GLD: 'Gold',
  USO: 'Oil',
  'rate.10y': '10Y Treasury',
  'macro.2y_yield': '2Y Treasury',
};

// Sector ETF symbols and labels
export const SECTOR_ETFS: Record<string, string> = {
  XLK: 'Technology',
  XLF: 'Financials',
  XLE: 'Energy',
  XLV: 'Health Care',
  XLI: 'Industrials',
  XLY: 'Cons. Disc.',
  XLP: 'Cons. Staples',
  XLU: 'Utilities',
  XLB: 'Materials',
  XLRE: 'Real Estate',
  XLC: 'Comm. Svcs.',
};

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly firestore = inject(Firestore);

  /**
   * Observable of the single denormalized dashboard snapshot doc.
   * Returns empty object if the doc doesn't exist yet.
   */
  getDashboardSnapshot(): Observable<DashboardSnapshot> {
    return docData(doc(this.firestore, 'market_snapshot/dashboard')).pipe(
      map((data) => (data as DashboardSnapshot) ?? { asOf: '' }),
      catchError(() => of({ asOf: '' }))
    );
  }

  /**
   * Extract a specific QuoteSnapshot from the dashboard doc.
   */
  getQuote(
    snapshot: DashboardSnapshot,
    symbol: string
  ): QuoteSnapshot | null {
    const val = snapshot[symbol];
    if (val && typeof val === 'object' && 'price' in (val as object)) {
      return val as unknown as QuoteSnapshot;
    }
    return null;
  }

  /**
   * Observable of market movers (gainers, losers, most active).
   */
  getMovers(): Observable<MoversDoc | null> {
    return docData(doc(this.firestore, 'market_movers/latest')).pipe(
      map((data) => data as MoversDoc | null),
      catchError(() => of(null))
    );
  }

  /**
   * Observable of a macro indicator time series.
   */
  getMacroIndicator(id: string): Observable<MacroSeries | null> {
    return docData(doc(this.firestore, `macro/${id}`)).pipe(
      map((data) => data as MacroSeries | null),
      catchError(() => of(null))
    );
  }

  /**
   * Observable of the earnings calendar.
   */
  getEarningsCalendar(): Observable<EarningsCalendarDoc | null> {
    return docData(doc(this.firestore, 'calendars/earnings')).pipe(
      map((data) => data as EarningsCalendarDoc | null),
      catchError(() => of(null))
    );
  }

  /**
   * Observable of the IPO calendar.
   */
  getIpoCalendar(): Observable<IpoCalendarDoc | null> {
    return docData(doc(this.firestore, 'calendars/ipo')).pipe(
      map((data) => data as IpoCalendarDoc | null),
      catchError(() => of(null))
    );
  }

  /**
   * Observable of fundamentals for a specific symbol.
   */
  getFundamentals(symbol: string): Observable<FundamentalsDoc | null> {
    return docData(doc(this.firestore, `fundamentals/${symbol}`)).pipe(
      map((data) => data as FundamentalsDoc | null),
      catchError(() => of(null))
    );
  }

  /**
   * Observable of the stock universe for search autocomplete.
   */
  getUniverse(): Observable<UniverseDoc | null> {
    return docData(doc(this.firestore, 'symbols/universe')).pipe(
      map((data) => data as UniverseDoc | null),
      catchError(() => of(null))
    );
  }
}
