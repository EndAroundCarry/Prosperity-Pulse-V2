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
  publishedAt: string;
  authors: string[];
  topics: string[];
  // Sentiment fields (Phase 2 — already in API responses, previously discarded)
  overallSentimentScore?: number;
  overallSentimentLabel?: string;
  tickerSentiment?: TickerSentiment[];
  topicRelevance?: Record<string, number>;
}
