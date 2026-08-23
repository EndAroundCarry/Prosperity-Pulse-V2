export type SentimentLabel =
  | 'Bearish'
  | 'Somewhat-Bearish'
  | 'Neutral'
  | 'Somewhat-Bullish'
  | 'Bullish';

export interface TickerSentiment {
  ticker: string;
  relevanceScore: number;
  sentimentScore: number;
  sentimentLabel: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  /** Raw publishedAt string as stored in Firestore. */
  publishedAt: string;
  /** Parsed date; `publishedAt` remains a string for backward compat. */
  publishedAtDate: Date;
  authors: string[];
  topics: string[];
  overallSentimentScore?: number;
  overallSentimentLabel?: SentimentLabel;
  tickerSentiment?: TickerSentiment[];
  topicRelevance?: Record<string, number>;
}
