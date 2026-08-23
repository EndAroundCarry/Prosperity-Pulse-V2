/**
 * Daily quota ledger backed by Firestore.
 *
 * Alpha Vantage resets its 25-call budget on US Eastern midnight.
 * This service tracks how many calls have been used today so that
 * across all tabs and all visitors the app never exceeds the budget.
 *
 * The increment happens *before* each HTTP call (transactional reserve)
 * so we never overshoot.  A 4-call reserve is kept for on-demand
 * user-initiated ticker lookups so background refresh cannot starve them.
 */

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  runTransaction,
  onSnapshot,
  DocumentReference,
  Unsubscribe,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

const BUDGET = 25;
const ON_DEMAND_RESERVE = 4;
const BACKGROUND_BUDGET = BUDGET - ON_DEMAND_RESERVE;

export interface QuotaDoc {
  used: number;
  budget: number;
  exhaustedAt: string | null;
}

export interface QuotaState {
  used: number;
  budget: number;
  remaining: number;
  exhausted: boolean;
  exhaustedAt: string | null;
}

function easternDateKey(): string {
  // Alpha Vantage resets on US Eastern midnight
  const now = new Date();
  const eastern = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const y = eastern.getFullYear();
  const m = String(eastern.getMonth() + 1).padStart(2, '0');
  const d = String(eastern.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable({ providedIn: 'root' })
export class QuotaLedgerService {
  private readonly firestore = inject(Firestore);

  private readonly _state$ = new BehaviorSubject<QuotaState>({
    used: 0,
    budget: BUDGET,
    remaining: BUDGET,
    exhausted: false,
    exhaustedAt: null,
  });

  /** Observable quota state for debug panels */
  readonly state$: Observable<QuotaState> = this._state$.asObservable();

  private unsubscribe: Unsubscribe | null = null;

  /** The Firestore doc for today's quota */
  private quotaRef(): DocumentReference<QuotaDoc> {
    const dateKey = easternDateKey();
    return doc(this.firestore, `system/state/quota/${dateKey}`) as DocumentReference<QuotaDoc>;
  }

  /**
   * Start listening to the quota doc in real-time.
   * Call once at app startup (e.g. in the scheduler initializer).
   */
  startListening(): void {
    this.stopListening();
    this.unsubscribe = onSnapshot(
      this.quotaRef(),
      (snap) => {
        const data = snap.data();
        if (!data) {
          this._state$.next({
            used: 0,
            budget: BUDGET,
            remaining: BUDGET,
            exhausted: false,
            exhaustedAt: null,
          });
          return;
        }
        const used = typeof data.used === 'number' ? data.used : 0;
        this._state$.next({
          used,
          budget: BUDGET,
          remaining: Math.max(0, BUDGET - used),
          exhausted: used >= BUDGET || !!data.exhaustedAt,
          exhaustedAt: data.exhaustedAt ?? null,
        });
      },
      () => {
        // On error (e.g. permissions), keep default state
      }
    );
  }

  stopListening(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /**
   * Transactionally increment the quota counter.  Returns `true`
   * if the call was reserved (caller should proceed with the HTTP
   * request), `false` if the budget is exhausted.
   *
   * `isOnDemand` — if true, draws from the on-demand reserve;
   * otherwise draws from the background budget.
   */
  async reserveCall(isOnDemand = false): Promise<boolean> {
    const ref = this.quotaRef();
    let reserved = false;

    try {
      await runTransaction(this.firestore, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        const used = data?.used ?? 0;
        const exhausted = data?.exhaustedAt != null || used >= BUDGET;

        if (exhausted) {
          return; // budget spent
        }

        // Enforce on-demand reserve: background calls cannot consume
        // the last ON_DEMAND_RESERVE slots
        if (!isOnDemand && used >= BACKGROUND_BUDGET) {
          return;
        }

        const newUsed = used + 1;
        const docData: QuotaDoc = {
          used: newUsed,
          budget: BUDGET,
          exhaustedAt: newUsed >= BUDGET ? new Date().toISOString() : null,
        };
        tx.set(ref, docData);
        reserved = true;
      });
    } catch {
      reserved = false;
    }

    return reserved;
  }

  /**
   * Mark the quota as exhausted (e.g. when Alpha Vantage returns
   * a `Note` or `Information` indicating rate limit / premium gate).
   * Does not increment the counter — just prevents further calls.
   */
  async markExhausted(): Promise<void> {
    const ref = this.quotaRef();
    try {
      await runTransaction(this.firestore, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        tx.set(ref, {
          used: data?.used ?? 0,
          budget: BUDGET,
          exhaustedAt: new Date().toISOString(),
        });
      });
    } catch {
      // Best-effort
    }
  }

  /** Current synchronous state (for non-reactive checks) */
  get current(): QuotaState {
    return this._state$.getValue();
  }

  /** How many background calls remain today */
  get backgroundRemaining(): number {
    return Math.max(0, BACKGROUND_BUDGET - this.current.used);
  }
}
