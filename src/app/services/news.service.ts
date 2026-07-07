import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { NewsArticle } from '../models/news-article.model';
import { environment } from '../../environments/environment';

export interface NewsFilter {
  searchQuery: string;
  topics: string[];
}

interface AlphaVantageNewsItem {
  title?: string;
  url?: string;
  time_published?: string;
  authors?: string[];
  summary?: string;
  source?: string;
  topics?: Array<{ topic?: string; relevance_score?: string }>;
}

interface AlphaVantageNewsResponse {
  feed?: AlphaVantageNewsItem[];
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly http = inject(HttpClient);
  private readonly apiKey = environment.alphaVantageKey;
  private readonly apiUrl = 'https://www.alphavantage.co/query';
  private readonly defaultTicker = 'AAPL';
  private readonly topicsCache = new Set<string>();

  getArticles(filter: NewsFilter, page: number, pageSize: number): Observable<NewsArticle[]> {
    return this.fetchNews().pipe(
      map((response) => this.mapResponseToArticles(response, filter)),
      map((articles) => {
        this.updateTopicsCache(articles);
        const start = page * pageSize;
        const end = start + pageSize;
        return articles.slice(start, end);
      }),
      catchError(() => of([]))
    );
  }

  getFilteredCount(filter: NewsFilter): Observable<number> {
    return this.fetchNews().pipe(
      map((response) => this.mapResponseToArticles(response, filter).length),
      catchError(() => of(0))
    );
  }

  getAllTopics(): Observable<string[]> {
    if (this.topicsCache.size > 0) {
      return of(Array.from(this.topicsCache).sort());
    }

    return this.fetchNews().pipe(
      map((response) => this.extractTopics(response)),
      map((topics) => {
        topics.forEach((topic) => this.topicsCache.add(topic));
        return topics;
      }),
      catchError(() => of([]))
    );
  }

  private fetchNews(): Observable<AlphaVantageNewsResponse> {
    return this.http
      .get<AlphaVantageNewsResponse>(this.apiUrl, {
        params: {
          function: 'NEWS_SENTIMENT',
          tickers: this.defaultTicker,
          apikey: this.apiKey,
        },
      })
      .pipe(shareReplay(1));
  }

  private mapResponseToArticles(response: AlphaVantageNewsResponse, filter: NewsFilter): NewsArticle[] {
    const articles = (response.feed ?? []).map((item, index) => ({
      id: index + 1,
      title: item.title ?? 'Untitled article',
      summary: item.summary ?? '',
      imageUrl: this.getImageUrl(item.title ?? ''),
      sourceUrl: item.url ?? '#',
      sourceName: item.source ?? 'Unknown source',
      publishedAt: this.formatPublishedAt(item.time_published),
      authors: item.authors ?? [],
      topics: this.extractTopicsForItem(item),
    }));

    return articles.filter((article) => {
      const matchesQuery = article.title.toLowerCase().includes(filter.searchQuery.toLowerCase());
      const matchesTopics =
        filter.topics.length === 0 ||
        filter.topics.every((topic) => article.topics.includes(topic));
      return matchesQuery && matchesTopics;
    });
  }

  private extractTopics(response: AlphaVantageNewsResponse): string[] {
    const topics = new Set<string>();

    (response.feed ?? []).forEach((item) => {
      this.extractTopicsForItem(item).forEach((topic) => topics.add(topic));
    });

    return Array.from(topics).sort((a, b) => a.localeCompare(b));
  }

  private extractTopicsForItem(item: AlphaVantageNewsItem): string[] {
    return (item.topics ?? [])
      .map((topicEntry) => topicEntry.topic)
      .filter((topic): topic is string => Boolean(topic))
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0);
  }

  private updateTopicsCache(articles: NewsArticle[]): void {
    articles.forEach((article) => {
      article.topics.forEach((topic) => this.topicsCache.add(topic));
    });
  }

  private formatPublishedAt(timePublished?: string): string {
    if (!timePublished) {
      return '';
    }

    const datePart = timePublished.slice(0, 8);
    const timePart = timePublished.slice(8, 14);
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    const hour = timePart.slice(0, 2);
    const minute = timePart.slice(2, 4);
    const second = timePart.slice(4, 6);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  private getImageUrl(title: string): string {
    const fallbackImages = [
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=400&fit=crop',
    ];

    const hash = Array.from(title).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return fallbackImages[hash % fallbackImages.length];
  }
}
