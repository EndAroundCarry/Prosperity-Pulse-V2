import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  collectionData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { switchMap, of, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

export const WATCHLIST_CAP = 10;
const GUEST_KEY = 'pp.watchlist';

/**
 * Watchlist per the plan: Firestore `users/{uid}/watchlist` for signed-in
 * users, localStorage fallback for the guest flow. Capped at 10 symbols —
 * each one competes for the on-demand budget.
 */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  /** Auth-state stream; '' when signed out (kept as Observable for piping). */
  private readonly uid$ = new Observable<string>((observer) =>
    onAuthStateChanged(this.auth, (user) => observer.next(user?.uid ?? ''))
  );

  private readonly uid = toSignal(this.uid$, { initialValue: '' });

  private readonly localSymbols = signal<string[]>(this.readLocal());

  /** Remote watchlist when signed in; null when signed out. */
  private readonly remoteList = toSignal(
    this.uid$.pipe(
      switchMap((uid) => {
        if (!uid) return of(null);
        return collectionData(collection(this.firestore, 'users', uid, 'watchlist')).pipe(
          map((docs) =>
            (docs ?? [])
              .map((d) => ({
                symbol: String(d['symbol'] ?? d['id'] ?? ''),
                order: typeof d['order'] === 'number' ? d['order'] : Number.MAX_SAFE_INTEGER,
              }))
              .filter((e) => e.symbol.length > 0)
              .sort((a, b) => a.order - b.order)
              .map((e) => e.symbol)
          )
        );
      })
    ),
    { initialValue: null }
  );

  /** Merged view: remote wins when present, otherwise localStorage. */
  readonly symbols = computed(() => this.remoteList() ?? this.localSymbols());

  readonly isFull = computed(() => this.symbols().length >= WATCHLIST_CAP);

  async add(symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    if (!sym || this.isFull()) return;
    if (this.uid()) {
      await setDoc(doc(this.firestore, 'users', this.uid(), 'watchlist', sym), {
        symbol: sym,
        addedAt: Date.now(),
        order: this.symbols().length,
      });
    } else {
      this.localSymbols.update((list) => (list.includes(sym) ? list : [...list, sym]));
      this.writeLocal();
    }
  }

  async remove(symbol: string): Promise<void> {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    if (this.uid()) {
      await deleteDoc(doc(this.firestore, 'users', this.uid(), 'watchlist', sym));
    } else {
      this.localSymbols.update((list) => list.filter((s) => s !== sym));
      this.writeLocal();
    }
  }

  toggle(symbol: string): void {
    const sym = symbol.trim().toUpperCase();
    if (this.symbols().includes(sym)) {
      void this.remove(sym);
    } else {
      void this.add(sym);
    }
  }

  /** Persist a new order after drag-drop. */
  async reorder(ordered: string[]): Promise<void> {
    const capped = ordered.slice(0, WATCHLIST_CAP);
    const uid = this.uid();
    if (uid) {
      await Promise.all(
        capped.map((sym, i) =>
          setDoc(doc(this.firestore, 'users', uid, 'watchlist', sym), { order: i }, { merge: true })
        )
      );
    }
    this.localSymbols.set(capped);
    this.writeLocal();
  }

  private readLocal(): string[] {
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeLocal(): void {
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(this.localSymbols()));
    } catch {
      /* storage unavailable */
    }
  }
}
