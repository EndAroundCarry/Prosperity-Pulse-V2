/**
 * Search service — instant local autocomplete from LISTING_STATUS data.
 *
 * Fetches the stock universe from Firestore once, caches in IndexedDB,
 * and serves zero-per-keystroke API cost autocomplete.
 * Wired to a Ctrl/Cmd+K command palette in the navbar.
 */

import { Injectable, inject } from '@angular/core';
import { MarketDataService, UniverseDoc } from './market-data.service';
import { Observable, of, switchMap, tap, catchError, map } from 'rxjs';

const IDB_NAME = 'prosperity-pulse-search';
const IDB_STORE = 'universe';
const IDB_KEY = 'symbols';
const IDB_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly marketData = inject(MarketDataService);

  private memoryCache: SearchResult[] | null = null;

  /**
   * Search symbols by query.  Returns top 20 matches.
   * Searches both symbol and name (case-insensitive).
   */
  search(query: string): Observable<SearchResult[]> {
    if (!query || query.trim().length === 0) {
      return of([]);
    }

    return this.loadUniverse().pipe(
      map((symbols) => {
        const q = query.toLowerCase().trim();
        return symbols
          .filter(
            (s) =>
              s.symbol.toLowerCase().includes(q) ||
              s.name.toLowerCase().includes(q)
          )
          .slice(0, 20);
      })
    );
  }

  /**
   * Load the universe from memory cache, IndexedDB, or Firestore.
   */
  private loadUniverse(): Observable<SearchResult[]> {
    if (this.memoryCache) {
      return of(this.memoryCache);
    }

    return this.loadFromIndexedDB().pipe(
      switchMap((cached) => {
        if (cached) {
          this.memoryCache = cached;
          return of(cached);
        }
        return this.marketData.getUniverse().pipe(
          map((doc) => {
            if (!doc || !doc.symbols) return [];
            const results: SearchResult[] = doc.symbols.map((s) => ({
              symbol: s.symbol,
              name: s.name,
              type: s.type,
              exchange: s.exchange,
            }));
            this.memoryCache = results;
            this.saveToIndexedDB(results);
            return results;
          }),
          catchError(() => of([]))
        );
      })
    );
  }

  /**
   * IndexedDB helpers for offline caching.
   */
  private loadFromIndexedDB(): Observable<SearchResult[] | null> {
    if (typeof indexedDB === 'undefined') return of(null);

    return new Observable((subscriber) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(IDB_STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const getReq = store.get(IDB_KEY);
          getReq.onsuccess = () => {
            const val = getReq.result;
            if (
              val &&
              val.data &&
              Date.now() - val.timestamp < IDB_TTL_MS
            ) {
              subscriber.next(val.data as SearchResult[]);
            } else {
              subscriber.next(null);
            }
            subscriber.complete();
            db.close();
          };
          getReq.onerror = () => {
            subscriber.next(null);
            subscriber.complete();
            db.close();
          };
        } catch {
          subscriber.next(null);
          subscriber.complete();
          db.close();
        }
      };
      request.onerror = () => {
        subscriber.next(null);
        subscriber.complete();
      };
    });
  }

  private saveToIndexedDB(data: SearchResult[]): void {
    if (typeof indexedDB === 'undefined') return;

    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ data, timestamp: Date.now() }, IDB_KEY);
      } catch {
        // Best effort
      } finally {
        db.close();
      }
    };
  }
}
