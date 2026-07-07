import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';
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
  banner_image?:string;
  topics?: Array<{ topic?: string; relevance_score?: string }>;
}

interface AlphaVantageNewsResponse {
  feed?: AlphaVantageNewsItem[];
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly http = inject(HttpClient);
  private readonly apiKey = environment.alphaVantageKey;
  private readonly apiUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=1000&apikey=${environment.alphaVantageKey}`;
  private readonly defaultTicker = 'AAPL';
  private readonly topicsCache = new Set<string>();
  private cachedNewsResponse: AlphaVantageNewsResponse | null = null;
  private cachedNewsExpiry = 0;
  private inFlightNewsRequest: Observable<AlphaVantageNewsResponse> | null = null;
  private readonly cacheTtlMs = 60 * 60 * 1000;

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
    const now = Date.now();

    if (this.cachedNewsResponse && now < this.cachedNewsExpiry) {
      return of(this.cachedNewsResponse);
    }

    if (!this.inFlightNewsRequest) {
      this.inFlightNewsRequest = this.http
        .get<AlphaVantageNewsResponse>(this.apiUrl)
        .pipe(
          map((response) => {
            this.cachedNewsResponse = response;
            this.cachedNewsExpiry = now + this.cacheTtlMs;
            return response;
          }),
          catchError((error) => {
            this.cachedNewsResponse = null;
            this.cachedNewsExpiry = 0;
            return throwError(() => error);
          }),
          shareReplay(1)
        );
    }

    return this.inFlightNewsRequest.pipe(
      map((response) => {
        if (this.cachedNewsResponse && now < this.cachedNewsExpiry) {
          return this.cachedNewsResponse;
        }
        return response;
      })
    );
  }

  private mapResponseToArticles(response: AlphaVantageNewsResponse, filter: NewsFilter): NewsArticle[] {
    const articles = (response.feed ?? []).map((item, index) => ({
      id: index + 1,
      title: item.title ?? 'Untitled article',
      summary: item.summary ?? '',
      imageUrl: item?.banner_image ?? this.getImageUrl(item.title ?? ''),
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

    const normalized = timePublished.trim();
    const compactValue = normalized.replace(/[-:T/Z\s]/g, '');
    const compactMatch = compactValue.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);

    if (compactMatch) {
      const [, year, month, day, hour, minute, second] = compactMatch;
      const parsedYear = Number(year);
      const parsedMonth = Number(month);
      const parsedDay = Number(day);
      const parsedHour = Number(hour);
      const parsedMinute = Number(minute);
      const parsedSecond = Number(second);

      if (
        parsedMonth < 1 || parsedMonth > 12 ||
        parsedDay < 1 || parsedDay > 31 ||
        parsedHour < 0 || parsedHour > 23 ||
        parsedMinute < 0 || parsedMinute > 59 ||
        parsedSecond < 0 || parsedSecond > 59
      ) {
        return '';
      }

      return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    }

    const parsedDate = new Date(normalized);
    return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString();
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
