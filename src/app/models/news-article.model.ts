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
}
