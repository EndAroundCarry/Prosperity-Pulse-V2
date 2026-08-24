import { QuoteSnapshot, Mover, EarningsEvent, IpoEvent } from '../models/instrument.model';

/** "Data as of <date> · end-of-day" freshness for a snapshot. */
export function asOfLabel(asOf: string): string {
  const d = new Date(asOf.length === 10 ? `${asOf}T12:00:00Z` : asOf);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function daysStale(updatedAtIso: string | undefined | null): number {
  if (!updatedAtIso) return Infinity;
  return Math.floor((Date.now() - Date.parse(updatedAtIso)) / (24 * 60 * 60 * 1000));
}

/**
 * Widget state machine per the plan: loading / loaded / empty / stale.
 */
export type WidgetState = 'loading' | 'loaded' | 'empty';

export function widgetState(hasData: boolean, loading: boolean): WidgetState {
  if (loading) return 'loading';
  return hasData ? 'loaded' : 'empty';
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

/** ▲/▼ arrow paired with every color cue (colorblind accessibility). */
export function directionArrow(value: number): '▲' | '▼' | '' {
  if (value > 0) return '▲';
  if (value < 0) return '▼';
  return '';
}

export interface SentimentSummary {
  averageScore: number;
  label: 'Bullish' | 'Somewhat-Bullish' | 'Neutral' | 'Somewhat-Bearish' | 'Bearish';
  articleCount: number;
  topTickers: Array<{ ticker: string; weight: number }>;
}

/**
 * Aggregate news sentiment across recent articles — derived from data
 * already being fetched; zero additional API cost.
 */
export function summarizeSentiment(
  articles: Array<{ publishedAt?: string; overallSentimentScore?: number; tickerSentiment?: Array<{ ticker: string; relevanceScore: number }> }>,
  windowHours = 24,
  now = Date.now()
): SentimentSummary {
  const cutoff = now - windowHours * 60 * 60 * 1000;
  const recent = articles.filter((a) => !a.publishedAt || Date.parse(a.publishedAt) >= cutoff);
  const scored = recent.filter((a) => typeof a.overallSentimentScore === 'number');

  const averageScore =
    scored.length > 0 ? scored.reduce((sum, a) => sum + (a.overallSentimentScore ?? 0), 0) / scored.length : 0;

  const weights = new Map<string, number>();
  for (const a of recent) {
    for (const t of a.tickerSentiment ?? []) {
      weights.set(t.ticker, (weights.get(t.ticker) ?? 0) + t.relevanceScore);
    }
  }
  const topTickers = [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ticker, weight]) => ({ ticker, weight }));

  const label: SentimentSummary['label'] =
    averageScore >= 0.35 ? 'Bullish'
    : averageScore >= 0.15 ? 'Somewhat-Bullish'
    : averageScore <= -0.35 ? 'Bearish'
    : averageScore <= -0.15 ? 'Somewhat-Bearish'
    : 'Neutral';

  return { averageScore, label, articleCount: scored.length, topTickers };
}

export interface UpcomingEvents {
  earnings: EarningsEvent[];
  ipos: IpoEvent[];
}

/** Next N earnings + M IPOs from cached calendars, sorted by date. */
export function pickUpcoming(
  earnings: EarningsEvent[],
  ipos: IpoEvent[],
  earningsCount = 5,
  ipoCount = 3
): UpcomingEvents {
  const byDate = <T extends { reportDate?: string; ipoDate?: string }>(rows: T[], key: 'reportDate' | 'ipoDate') =>
    [...rows]
      .filter((r) => !!r[key])
      .sort((a, b) => String(a[key]).localeCompare(String(b[key])));

  return {
    earnings: byDate(earnings, 'reportDate').slice(0, earningsCount),
    ipos: byDate(ipos, 'ipoDate').slice(0, ipoCount),
  };
}

/** Quote lookup from the dashboard snapshot. */
export function quoteBySymbol(quotes: QuoteSnapshot[] | undefined, symbol: string): QuoteSnapshot | undefined {
  return quotes?.find((q) => q.symbol === symbol);
}
