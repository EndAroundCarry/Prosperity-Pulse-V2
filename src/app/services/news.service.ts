import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy, limit, startAfter } from '@angular/fire/firestore';
import { Observable, catchError, map, of, take } from 'rxjs';
import { NewsArticle } from '../models/news-article.model';
import { buildArticleDocId } from '../core/article-id.util';

export interface NewsFilter {
  searchQuery: string;
  topics: string[];
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
   * for filtering by search query and topics.
   */
  getArticlesRaw(
    _filter: NewsFilter,
    _page: number,
    pageSize: number,
    lastPublishedAt?: string | null,
    lastId?: string | null
  ): Observable<NewsArticle[]> {
    void _filter;
    void _page;
    void lastId;
    return this.loadArticlesFromFirestore(pageSize + 1, lastPublishedAt).pipe(
      map((articles) => articles),
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
            authors: Array.isArray(document.authors) ? document.authors : [],
            topics: Array.isArray(document.topics) ? document.topics : [],
          };
        })
      )
    );
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
