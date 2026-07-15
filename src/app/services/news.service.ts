import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, query, orderBy, limit, startAfter } from '@angular/fire/firestore';
import { Observable, catchError, firstValueFrom, from, map, of, switchMap, throwError } from 'rxjs';
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
  banner_image?: string;
  topics?: Array<{ topic?: string; relevance_score?: string }>;
}

interface AlphaVantageNewsResponse {
  feed?: AlphaVantageNewsItem[];
}

interface FirestoreTopicDocument {
  name: string;
  newsIds: string[];
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly http = inject(HttpClient);
  private readonly firestore = inject(Firestore);
  private readonly apiKey = environment.alphaVantageKey;
  private readonly apiUrl = 'https://www.alphavantage.co/query';
  private readonly defaultTicker = 'AAPL';
  private readonly cacheTtlMs = 60 * 60 * 1000;
  private readonly cacheTtlMsForCheck = 24 * 60 * 60 * 1000; // 24 hours
  private readonly localCacheKey = 'prosperity-pulse-news-cache';
  private readonly topicCacheKey = 'prosperity-pulse-topics-cache';
  private cacheArticles: NewsArticle[] | null = null;
  private cacheTopics: string[] | null = null;
  private cacheLoadedAt = 0;
  private syncTimer: number | null = null;
  private readonly maxCachedArticles = 500; // Limit cached articles to prevent memory issues

  constructor() {
    this.restoreCache();
    this.startScheduledSync();
    // Check for immediate fetch if needed
    this.checkAndFetchIfNecessary();
  }

  getArticles(filter: NewsFilter, page: number, pageSize: number): Observable<NewsArticle[]> {
    return this.getCachedArticles().pipe(
      map((articles) => this.filterArticles(articles, filter)),
      map((articles) => {
        const start = page * pageSize;
        const end = start + pageSize;
        return articles.slice(start, end);
      }),
      catchError(() => of([]))
    );
  }

  getFilteredCount(filter: NewsFilter): Observable<number> {
    return this.getCachedArticles().pipe(
      map((articles) => this.filterArticles(articles, filter).length),
      catchError(() => of(0))
    );
  }

  getAllTopics(): Observable<string[]> {
    if (this.hasValidTopicCache()) {
      return of([...this.cacheTopics!]);
    }

    return this.loadTopicsFromFirestore().pipe(
      map((topics) => {
        if (topics.length > 0) {
          this.cacheTopics = topics;
          this.persistTopicCache(topics);
        }
        return topics;
      }),
      catchError(() => of([]))
    );
  }

  private getCachedArticles(): Observable<NewsArticle[]> {
    if (this.hasValidArticleCache()) {
      return of([...this.cacheArticles!]);
    }

    return this.loadArticlesFromFirestore().pipe(
      map((articles) => {
        // Limit cached articles to prevent memory issues
        const limitedArticles = articles.slice(0, this.maxCachedArticles);
        if (limitedArticles.length > 0) {
          this.cacheArticles = limitedArticles;
          this.cacheLoadedAt = Date.now();
          this.persistArticleCache(limitedArticles);
        }
        return limitedArticles;
      }),
      catchError(() => of([]))
    );
  }

  private startScheduledSync(): void {
    this.syncFromDatabaseOrAlphaVantage().subscribe({
      error: () => undefined,
    });

    if (this.syncTimer) {
      window.clearInterval(this.syncTimer);
    }

    this.syncTimer = window.setInterval(() => {
      this.syncFromDatabaseOrAlphaVantage().subscribe({
        error: () => undefined,
      });
    }, this.cacheTtlMs);
  }

  private syncFromDatabaseOrAlphaVantage(): Observable<void> {
    if (this.hasValidArticleCache()) {
      return of(undefined);
    }

    return this.loadArticlesFromFirestore().pipe(
      switchMap((articles) => {
        if (articles.length > 0) {
          // Limit cached articles to prevent memory issues
          const limitedArticles = articles.slice(0, this.maxCachedArticles);
          this.cacheArticles = limitedArticles;
          this.cacheLoadedAt = Date.now();
          this.persistArticleCache(limitedArticles);
          return this.loadTopicsFromFirestore().pipe(
            map((topics) => {
              if (topics.length > 0) {
                this.cacheTopics = topics;
                this.persistTopicCache(topics);
              }
              return undefined;
            })
          );
        }

        return this.ingestFromAlphaVantage();
      }),
      catchError(() => of(undefined))
    );
  }

  private ingestFromAlphaVantage(): Observable<void> {
    return this.http
      .get<AlphaVantageNewsResponse>(this.apiUrl, {
        params: {
          function: 'NEWS_SENTIMENT',
          tickers: this.defaultTicker,
          apikey: this.apiKey,
          limit: '1000',
        },
      })
      .pipe(
        switchMap((response) => from(this.persistAlphaVantageData(response))),
        catchError((error) => throwError(() => error))
      );
  }

  private async persistAlphaVantageData(response: AlphaVantageNewsResponse): Promise<void> {
    const articles = this.mapResponseToArticles(response, { searchQuery: '', topics: [] });
    const topicNames = Array.from(new Set(articles.flatMap((article) => article.topics))).sort();

    const newsCollection = collection(this.firestore, 'news');
    const topicsCollection = collection(this.firestore, 'topics');
    const newsDocs = await firstValueFrom(collectionData(newsCollection, { idField: 'firestoreId' }));
    const topicDocs = await firstValueFrom(collectionData(topicsCollection, { idField: 'firestoreId' }));
    const existingNewsIds = new Set(newsDocs.map((doc: any) => String(doc.firestoreId ?? '')));
    const existingTopics = new Map<string, FirestoreTopicDocument>(
      topicDocs.map((doc: any) => [String(doc.firestoreId ?? ''), { name: doc.name ?? '', newsIds: Array.isArray(doc.newsIds) ? doc.newsIds : [] }])
    );

    for (const article of articles) {
      const articleDocId = this.buildArticleDocId(article);
      if (!existingNewsIds.has(articleDocId)) {
        await setDoc(doc(newsCollection, articleDocId), {
          title: article.title,
          summary: article.summary,
          imageUrl: article.imageUrl,
          sourceUrl: article.sourceUrl,
          sourceName: article.sourceName,
          publishedAt: article.publishedAt,
          authors: article.authors,
          topics: article.topics,
          topicIds: article.topics.map((topic) => this.buildTopicDocId(topic)),
        });
        existingNewsIds.add(articleDocId);
      }

      article.topics.forEach((topic) => {
        const topicDocId = this.buildTopicDocId(topic);
        const existingTopic = existingTopics.get(topicDocId) ?? { name: topic, newsIds: [] };
        if (!existingTopic.newsIds.includes(articleDocId)) {
          existingTopic.newsIds.push(articleDocId);
        }
        existingTopics.set(topicDocId, existingTopic);
      });
    }

    for (const [topicDocId, topicDoc] of existingTopics.entries()) {
      await setDoc(doc(topicsCollection, topicDocId), {
        name: topicDoc.name,
        newsIds: Array.from(new Set(topicDoc.newsIds)),
      });
    }

    // Limit cached articles to prevent memory issues
    const limitedArticles = articles.slice(0, this.maxCachedArticles);
    this.cacheArticles = limitedArticles;
    this.cacheTopics = topicNames;
    this.cacheLoadedAt = Date.now();
    this.persistArticleCache(limitedArticles);
    this.persistTopicCache(topicNames);
  }

  private loadArticlesFromFirestore(): Observable<NewsArticle[]> {
    // Use Firestore query to limit results
    const newsCollection = collection(this.firestore, 'news');
    const q = query(newsCollection, orderBy('publishedAt', 'desc'), limit(1000));
    
    return collectionData(q, { idField: 'firestoreId' }).pipe(
      map((documents: any[]) =>
        documents.map((document, index) => ({
          id: index + 1,
          title: document.title ?? 'Untitled article',
          summary: document.summary ?? '',
          imageUrl: document.imageUrl ?? this.getImageUrl(document.title ?? ''),
          sourceUrl: document.sourceUrl ?? '#',
          sourceName: document.sourceName ?? 'Unknown source',
          publishedAt: document.publishedAt ?? '',
          authors: Array.isArray(document.authors) ? document.authors : [],
          topics: Array.isArray(document.topics) ? document.topics : [],
        }))
      )
    );
  }

  private loadTopicsFromFirestore(): Observable<string[]> {
    return collectionData(collection(this.firestore, 'topics'), { idField: 'firestoreId' }).pipe(
      map((documents: any[]) =>
        Array.from(new Set(documents.map((document) => document.name).filter((name): name is string => Boolean(name)))).sort((left, right) => left.localeCompare(right))
      )
    );
  }

  private filterArticles(articles: NewsArticle[], filter: NewsFilter): NewsArticle[] {
    return articles.filter((article) => {
      const matchesQuery = article.title.toLowerCase().includes(filter.searchQuery.toLowerCase());
      const matchesTopics =
        filter.topics.length === 0 || filter.topics.every((topic) => article.topics.includes(topic));
      return matchesQuery && matchesTopics;
    });
  }

  private mapResponseToArticles(response: AlphaVantageNewsResponse, filter: NewsFilter): NewsArticle[] {
    const articles = (response.feed ?? []).map((item, index) => ({
      id: index + 1,
      title: item.title ?? 'Untitled article',
      summary: item.summary ?? '',
      imageUrl: item.banner_image ?? this.getImageUrl(item.title ?? ''),
      sourceUrl: item.url ?? '#',
      sourceName: item.source ?? 'Unknown source',
      publishedAt: this.formatPublishedAt(item.time_published),
      authors: item.authors ?? [],
      topics: this.extractTopicsForItem(item),
    }));

    return articles.filter((article) => {
      const matchesQuery = article.title.toLowerCase().includes(filter.searchQuery.toLowerCase());
      const matchesTopics =
        filter.topics.length === 0 || filter.topics.every((topic) => article.topics.includes(topic));
      return matchesQuery && matchesTopics;
    });
  }

  private extractTopicsForItem(item: AlphaVantageNewsItem): string[] {
    return (item.topics ?? [])
      .map((topicEntry) => topicEntry.topic)
      .filter((topic): topic is string => Boolean(topic))
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0);
  }

  private buildArticleDocId(article: NewsArticle): string {
    const titleSlug = (article.title || 'article').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const sourceSlug = (article.sourceName || 'source').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const dateSlug = article.publishedAt ? article.publishedAt.slice(0, 10) : 'unknown';
    return `${sourceSlug}-${titleSlug}-${dateSlug}`.slice(0, 120);
  }

  private buildTopicDocId(topic: string): string {
    return topic.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topic';
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

  private hasValidArticleCache(): boolean {
    return Boolean(this.cacheArticles && this.cacheArticles.length > 0 && Date.now() - this.cacheLoadedAt < this.cacheTtlMs);
  }

  private hasValidTopicCache(): boolean {
    return Boolean(this.cacheTopics && this.cacheTopics.length > 0);
  }

  private restoreCache(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedArticles = window.localStorage.getItem(this.localCacheKey);
      if (storedArticles) {
        this.cacheArticles = JSON.parse(storedArticles) as NewsArticle[];
      }

      const storedTopics = window.localStorage.getItem(this.topicCacheKey);
      if (storedTopics) {
        this.cacheTopics = JSON.parse(storedTopics) as string[];
      }

      const storedLoadedAt = window.localStorage.getItem('prosperity-pulse-news-cache-time');
      this.cacheLoadedAt = storedLoadedAt ? Number(storedLoadedAt) : 0;
    } catch {
      this.cacheArticles = null;
      this.cacheTopics = null;
      this.cacheLoadedAt = 0;
    }
  }

  private persistArticleCache(articles: NewsArticle[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.localCacheKey, JSON.stringify(articles));
    window.localStorage.setItem('prosperity-pulse-news-cache-time', String(Date.now()));
  }

  private persistTopicCache(topics: string[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.topicCacheKey, JSON.stringify(topics));
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

  // New method to check if immediate fetch is needed
  private checkAndFetchIfNecessary(): void {
    // Check if we have valid cache data
    if (this.hasValidArticleCache()) {
      // If we have valid cache, check if it's older than 24 hours
      const isOlderThan24Hours = Date.now() - this.cacheLoadedAt > this.cacheTtlMsForCheck;
      
      if (isOlderThan24Hours) {
        // If cache is older than 24 hours, fetch immediately from AlphaVantage
        this.ingestFromAlphaVantage().subscribe({
          error: (err) => {
             console.log(err)
          }
        });
      }
    } else {
      // If no cache exists, fetch immediately from AlphaVantage
      this.ingestFromAlphaVantage().subscribe({
        error: (err) => {
          console.log(err)
        }
      });
    }
  }
}
