import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, limit } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

export interface SymbolEntry {
  symbol: string;
  name: string;
  exchange: string;
}

/**
 * Pure search over the symbol universe: exact-symbol first, then name
 * prefix match, then substring. Exported for unit testing.
 */
export function searchSymbols(entries: SymbolEntry[], term: string, max = 12): SymbolEntry[] {
  const t = term.trim().toUpperCase();
  if (t.length === 0) return [];
  const scored: Array<{ e: SymbolEntry; s: number }> = [];
  for (const e of entries) {
    const sym = e.symbol.toUpperCase();
    const name = (e.name ?? '').toUpperCase();
    let score = -1;
    if (sym === t) score = 0;
    else if (sym.startsWith(t)) score = 1;
    else if (name.startsWith(t)) score = 2;
    else if (name.includes(t)) score = 3;
    else if (sym.includes(t)) score = 4;
    if (score >= 0) scored.push({ e, s: score });
  }
  scored.sort((a, b) => a.s - b.s || a.e.symbol.localeCompare(b.e.symbol));
  return scored.slice(0, max).map((x) => x.e);
}

/**
 * Reads the chunked `symbols/universe_chunk_*` docs written by the
 * `symbols.universe` dataset's persist handler and serves local
 * autocomplete — zero per-keystroke API cost.
 */
@Injectable({ providedIn: 'root' })
export class SymbolUniverseService {
  private readonly firestore = inject(Firestore);
  private universe$: Observable<SymbolEntry[]> | null = null;

  /** All known symbols, cached after the first subscription. */
  getUniverse(): Observable<SymbolEntry[]> {
    if (!this.universe$) {
      // Chunks are capped at 5000 rows each; load a bounded subset to keep
      // memory sane while still covering the most relevant listings.
      const q = query(collection(this.firestore, 'symbols'), limit(10));
      this.universe$ = collectionData(q).pipe(
        map((docs) =>
          (docs ?? [])
            .flatMap((d) => (Array.isArray(d['symbols']) ? d['symbols'] : []))
            .map((row) => {
              const r = (row ?? {}) as Record<string, unknown>;
              return {
                symbol: String(r['symbol'] ?? ''),
                name: String(r['name'] ?? ''),
                exchange: String(r['exchange'] ?? ''),
              };
            })
            .filter((e) => e.symbol.length > 0)
        )
      );
    }
    return this.universe$;
  }

  search(term: string): Observable<SymbolEntry[]> {
    return this.getUniverse().pipe(map((entries) => searchSymbols(entries, term)));
  }
}
