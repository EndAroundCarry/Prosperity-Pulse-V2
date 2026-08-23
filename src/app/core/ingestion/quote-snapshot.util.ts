import {
  Candle,
  DashboardSnapshot,
  QuoteSnapshot,
  AssetClass,
  SPARKLINE_POINTS,
} from '../../models/instrument.model';

/**
 * Build a QuoteSnapshot from a symbol's candle series.
 *
 * Pure and deterministic — the persist handlers call this and store the
 * result in `market_snapshot/dashboard`, so the dashboard renders without
 * touching `market_series` at all.
 */
export function buildQuoteSnapshot(
  symbol: string,
  name: string,
  assetClass: AssetClass,
  candles: Candle[],
  proxyFor?: string
): QuoteSnapshot | null {
  if (!candles || candles.length === 0) return null;

  const sorted = [...candles].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2] ?? last;

  const closes = sorted.map((c) => c.close);
  const sparkline = closes.slice(-SPARKLINE_POINTS);

  return {
    symbol,
    name,
    assetClass,
    proxyFor,
    price: last.close,
    previousClose: previous.close,
    change: last.close - previous.close,
    changePercent: previous.close !== 0 ? ((last.close - previous.close) / previous.close) * 100 : 0,
    asOf: last.date,
    rangeLow: Math.min(...closes),
    rangeHigh: Math.max(...closes),
    sparkline,
  };
}

/**
 * Merge a fresh quote into an existing dashboard snapshot (or create one).
 * The scheduler calls this from the persist handlers; a stale quote from a
 * partial rotation update must not wipe out tiles that haven't refreshed yet.
 */
export function mergeDashboardSnapshot(
  existing: DashboardSnapshot | null,
  quote: QuoteSnapshot,
  now: Date
): DashboardSnapshot {
  const quotes = existing?.quotes ? [...existing.quotes] : [];
  const idx = quotes.findIndex((q) => q.symbol === quote.symbol);
  if (idx >= 0) {
    quotes[idx] = quote;
  } else {
    quotes.push(quote);
  }
  return {
    updatedAt: now.toISOString(),
    quotes,
  };
}
