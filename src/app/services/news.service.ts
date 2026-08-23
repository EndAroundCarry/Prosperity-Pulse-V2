import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  limit,
  startAfter,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of, take } from 'rxjs';
import { NewsArticle } from '../models/news-article.model';
import { buildArticleDocId } from '../core/article-id.util';

export interface NewsFilter {
  searchQuery: string;
  topics: string[];
}

/**
 * Pure Firestore reader for news articles and topics.
 *
 * All ingestion logic (Alpha Vantage fetching, caching, scheduling)
 * has been moved to the ingestion engine in `core/ingestion/`.
 * This service only reads from Firestore.
 */
@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly firestore = inject(Firestore);

  /**
   * Fetch a page of articles from Firestore.
   * The caller is responsible for filtering by search query and topics.
   */
  getArticlesRaw(
    filter: NewsFilter,
    page: number,
    pageSize: number,
    lastPublishedAt?: string | null,
    _lastId?: string | null
  ): Observable<NewsArticle[]> {
    return this.loadArticlesFromFirestore(pageSize + 1, lastPublishedAt).pipe(
      map((articles) => articles),
      catchError(() => of([]))
    );
  }

  getAllTopics(): Observable<string[]> {
    return this.loadTopicsFromFirestore().pipe(
      catchError(() => of([]))
    );
  }

  private loadArticlesFromFirestore(
    limitCount: number,
    lastPublishedAt?: string | null
  ): Observable<NewsArticle[]> {
    const newsCollection = collection(this.firestore, 'news');
    let q = query(
      newsCollection,
      orderBy('publishedAt', 'desc'),
      limit(limitCount)
    );

    if (lastPublishedAt) {
      q = query(
        newsCollection,
        orderBy('publishedAt', 'desc'),
        startAfter(lastPublishedAt),
        limit(limitCount)
      );
    }

    return collectionData(q, { idField: 'firestoreId' }).pipe(
      take(1),
      map((documents: any[]) =>
        documents.map((document) => {
          const docId =
            document.firestoreId ||
            buildArticleDocId({
              title: document.title,
              sourceName: document.sourceName,
              publishedAt: document.publishedAt,
            });
          return {
            id: docId,
            title: document.title ?? 'Untitled article',
            summary: document.summary ?? '',
            imageUrl:
              document.imageUrl ?? this.getImageUrl(document.title ?? ''),
            sourceUrl: document.sourceUrl ?? '#',
            sourceName: document.sourceName ?? 'Unknown source',
            publishedAt: document.publishedAt ?? '',
            authors: Array.isArray(document.authors) ? document.authors : [],
            topics: Array.isArray(document.topics) ? document.topics : [],
            // Sentiment fields (persisted by ingestion engine)
            overallSentimentScore: typeof document.overallSentimentScore === 'number' ? document.overallSentimentScore : undefined,
            overallSentimentLabel: typeof document.overallSentimentLabel === 'string' ? document.overallSentimentLabel : undefined,
            tickerSentiment: Array.isArray(document.tickerSentiment) ? document.tickerSentiment : undefined,
          };
        })
      )
    );
  }

  private loadTopicsFromFirestore(): Observable<string[]> {
    return collectionData(collection(this.firestore, 'topics'), {
      idField: 'firestoreId',
    }).pipe(
      map((documents: any[]) =>
        Array.from(
          new Set(
            documents
              .map((document) => document.name)
              .filter((name): name is string => Boolean(name))
          )
        ).sort((left, right) => left.localeCompare(right))
      )
    );
  }

  private getImageUrl(title: string): string {
    const fallbackImages = [
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=400&fit=crop',
    ];

    const hash = Array.from(title).reduce(
      (acc, char) => acc + char.charCodeAt(0),
      0
    );
    return fallbackImages[hash % fallbackImages.length];
  }
}
