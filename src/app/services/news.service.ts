import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy, limit, startAfter, where } from '@angular/fire/firestore';
import { Observable, catchError, map, of, take } from 'rxjs';
import { NewsArticle } from '../models/news-article.model';
import { buildArticleDocId } from '../core/article-id.util';

export type NewsSortMode = 'newest' | 'most-relevant' | 'most-bullish' | 'most-bearish' | 'most-discussed';
export type SentimentBucket = 'bullish' | 'neutral' | 'bearish';

export interface NewsFilter {
  searchQuery: string;
  topics: string[];
  ticker?: string;
  sentiment?: SentimentBucket;
  sort?: NewsSortMode;
}

export const BULLISH_THRESHOLD = 0.15;

export function sentimentBucket(score: number | undefined): SentimentBucket | null {
  if (typeof score !== 'number') return null;
  if (score >= BULLISH_THRESHOLD) return 'bullish';
  if (score <= -BULLISH_THRESHOLD) return 'bearish';
  return 'neutral';
}

/**
 * Pure Firestore reader for the news feed.
 *
 * Ingestion moved to src/app/core/ingestion (Phase 1). This service no
 * longer talks to Alpha Vantage or fires network traffic on construction —
 * it reads only the `news` and `topics` collections.
 */
@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly firestore = inject(Firestore);

  /**
   * Fetch a page of articles from Firestore. The caller is responsible
   * for client-side search matching; topic filtering happens server-side
   * via the `topicIds array-contains + publishedAt desc` composite index.
   */
  getArticlesRaw(
    filter: NewsFilter,
    _page: number,
    pageSize: number,
    lastPublishedAt?: string | null,
    lastId?: string | null
  ): Observable<NewsArticle[]> {
    void _page;
    void lastId;
    const primaryTopic = filter.topics.length > 0 ? filter.topics[0] : null;
    return this.loadArticlesFromFirestore(pageSize + 1, lastPublishedAt, primaryTopic).pipe(
      catchError(() => of([]))
    );
  }

  getAllTopics(): Observable<string[]> {
    return this.loadTopicsFromFirestore().pipe(
      map((topics) => topics),
      catchError(() => of([]))
    );
  }

  private loadArticlesFromFirestore(
    limitCount: number,
    lastPublishedAt?: string | null,
    topicId?: string | null
  ): Observable<NewsArticle[]> {
    const newsCollection = collection(this.firestore, 'news');
    if (topicId) {
      let q = query(
        newsCollection,
        where('topicIds', 'array-contains', topicId),
        orderBy('publishedAt', 'desc'),
        limit(limitCount)
      );
      if (lastPublishedAt) {
        q = query(
          newsCollection,
          where('topicIds', 'array-contains', topicId),
          orderBy('publishedAt', 'desc'),
          startAfter(lastPublishedAt),
          limit(limitCount)
        );
      }
      return collectionData(q, { idField: 'firestoreId' }).pipe(take(1), map((documents: any[]) => documents.map((d) => this.mapArticle(d))));
    }

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
      map((documents: any[]) => documents.map((document) => this.mapArticle(document)))
    );
  }

  private mapArticle(document: any): NewsArticle {
    const docId = document.firestoreId || buildArticleDocId({
      title: document.title,
      sourceName: document.sourceName,
      publishedAt: document.publishedAt,
    } as any);
    return {
      id: docId,
      title: document.title ?? 'Untitled article',
      summary: document.summary ?? '',
      imageUrl: document.imageUrl ?? '',
      sourceUrl: document.sourceUrl ?? '#',
      sourceName: document.sourceName ?? 'Unknown source',
      publishedAt: document.publishedAt ?? '',
      publishedAtDate: document.publishedAtDate
        ? new Date(document.publishedAtDate.seconds ? document.publishedAtDate.seconds * 1000 : document.publishedAtDate)
        : new Date(document.publishedAt ?? 0),
      authors: Array.isArray(document.authors) ? document.authors : [],
      topics: Array.isArray(document.topics) ? document.topics : [],
      overallSentimentScore:
        typeof document.overallSentimentScore === 'number' ? document.overallSentimentScore : undefined,
      overallSentimentLabel: document.overallSentimentLabel ?? undefined,
      tickerSentiment: Array.isArray(document.tickerSentiment) ? document.tickerSentiment : undefined,
      topicRelevance: document.topicRelevance ?? undefined,
    };
  }

  private loadTopicsFromFirestore(): Observable<string[]> {
    return collectionData(collection(this.firestore, 'topics'), { idField: 'firestoreId' }).pipe(
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
}
