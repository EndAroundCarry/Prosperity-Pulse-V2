export interface NewsArticle {
  id: number;
  title: string;
  summary: string;
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  authors: string[];
  topics: string[];
}
