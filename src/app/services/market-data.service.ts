import { Injectable, inject } from '@angular/core';
import { Firestore, collectionData, collection, docData, doc, query, orderBy, limit } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import {
  DashboardSnapshot,
  Mover,
  MacroSeries,
  EarningsEvent,
  IpoEvent,
} from '../models/instrument.model';
import { NewsArticle } from '../models/news-article.model';

export interface MoversDoc {
  asOf: string;
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
  updatedAt?: string;
}

export interface EarningsCalendarDoc {
  fetchedAt: string;
  events: EarningsEvent[];
}

export interface IpoCalendarDoc {
  fetchedAt: string;
  events: IpoEvent[];
}

/**
 * Pure Firestore reader for the market dashboard.
 *
 * A full dashboard render is ~4 document reads (snapshot + movers +
 * per-widget macro docs), not hundreds — this is the point of the
 * denormalized `market_snapshot/dashboard` doc.
 * No HTTP, no ingestion logic (that lives in core/ingestion).
 */
@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly firestore = inject(Firestore);

  /** The single denormalized doc with every quote tile. */
  getDashboardSnapshot(): Observable<DashboardSnapshot | null> {
    return docData(doc(this.firestore, 'market_snapshot/dashboard')).pipe(
      map((d) => (d ? (d as unknown as DashboardSnapshot) : null))
    );
  }

  getMovers(): Observable<MoversDoc | null> {
    return docData(doc(this.firestore, 'market_movers/latest')).pipe(
      map((d) => (d && Object.keys(d).length > 0 ? (d as unknown as MoversDoc) : null))
    );
  }

  getMacro(id: string): Observable<MacroSeries | null> {
    return docData(doc(this.firestore, 'macro', id)).pipe(
      map((d) => (d && Object.keys(d).length > 0 ? (d as unknown as MacroSeries) : null))
    );
  }

  getEarningsCalendar(): Observable<EarningsCalendarDoc | null> {
    return docData(doc(this.firestore, 'calendars/earnings')).pipe(
      map((d) => (d ? (d as unknown as EarningsCalendarDoc) : null))
    );
  }

  getIpoCalendar(): Observable<IpoCalendarDoc | null> {
    return docData(doc(this.firestore, 'calendars/ipo')).pipe(
      map((d) => (d ? (d as unknown as IpoCalendarDoc) : null))
    );
  }

  /** Top N articles by publishedAt for the news rail. */
  getTopNews(count = 6): Observable<NewsArticle[]> {
    const q = query(collection(this.firestore, 'news'), orderBy('publishedAt', 'desc'), limit(count));
    return collectionData(q).pipe(map((docs) => (docs ?? []).map(toArticle)));
  }
}

function toArticle(document: any): NewsArticle {
  return {
    id: document['id'] ?? document['firestoreId'] ?? '',
    title: document['title'] ?? 'Untitled article',
    summary: document['summary'] ?? '',
    imageUrl: document['imageUrl'] ?? '',
    sourceUrl: document['sourceUrl'] ?? '#',
    sourceName: document['sourceName'] ?? 'Unknown source',
    publishedAt: document['publishedAt'] ?? '',
    publishedAtDate: new Date(document['publishedAt'] ?? 0),
    authors: Array.isArray(document['authors']) ? document['authors'] : [],
    topics: Array.isArray(document['topics']) ? document['topics'] : [],
    overallSentimentScore: typeof document['overallSentimentScore'] === 'number' ? document['overallSentimentScore'] : undefined,
    tickerSentiment: Array.isArray(document['tickerSentiment']) ? document['tickerSentiment'] : undefined,
  };
}
