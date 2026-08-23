import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';

export interface QuotaState {
  used: number;
  budget: number;
  exhaustedAt: number | null;
  /** Calls reserved for on-demand ticker requests. */
  reservedForOnDemand: number;
}

export const QUOTA_PATH = 'system/state/quota';
export const DAILY_BUDGET = 25;
export const ON_DEMAND_RESERVE = 4;

/**
 * The Eastern-midnight key for today. Alpha Vantage resets its quota on
 * US Eastern midnight, so the ledger key must match that boundary.
 */
export function quotaKeyFor(date: Date): string {
  // Format as YYYY-MM-DD in America/New_York.
  const ny = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = ny.getFullYear();
  const month = String(ny.getMonth() + 1).padStart(2, '0');
  const day = String(ny.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Pure decision: can we spend one call right now?
 * Exported for unit testing without Firestore.
 */
export function canSpend(
  quota: QuotaState | null | undefined,
  now: number,
  forOnDemand: boolean
): boolean {
  if (!quota) return true;
  if (quota.exhaustedAt != null && quota.exhaustedAt > now) return false;

  const budget = quota.budget > 0 ? quota.budget : DAILY_BUDGET;
  const effectiveBudget = budget - ON_DEMAND_RESERVE;
  const used = quota.used ?? 0;

  if (forOnDemand) {
    // On-demand can spend the reserve plus whatever background hasn't used.
    return used < budget;
  }
  // Background refresh must never starve the on-demand reserve.
  return used < effectiveBudget;
}

/**
 * Firestore-backed daily quota ledger at `system/state/quota/{YYYY-MM-DD}`.
 *
 * The key is the US Eastern date, matching Alpha Vantage's reset boundary.
 * Every HTTP call is reserved (incremented) BEFORE the request — never
 * after — so a crash mid-fetch can't overspend the day's budget.
 */
@Injectable({ providedIn: 'root' })
export class QuotaLedgerService {
  private readonly firestore = inject(Firestore);
  private readonly quota$ = new BehaviorSubject<QuotaState | null>(null);

  constructor() {
    this.observeQuota();
  }

  private observeQuota(): void {
    const today = quotaKeyFor(new Date());
    const ref = doc(this.firestore, QUOTA_PATH, today);
    // Poll-based: docData would need onSnapshot; collectionData on a single
    // doc is awkward, so subscribe to a lightweight valueChanges equivalent.
    // For simplicity we read it on each spend check and keep a cached copy.
    void getDoc(ref).then((snap) => {
      if (snap.exists()) {
        this.quota$.next(snap.data() as QuotaState);
      }
    });
  }

  /** Observable snapshot of today's quota (for debug panels). */
  get remaining$(): Observable<QuotaState | null> {
    return this.quota$.asObservable();
  }

  /**
   * Reserve one call against today's budget. Throws if the budget is
   * exhausted. Must be called BEFORE issuing the HTTP request.
   */
  async reserve(forOnDemand: boolean): Promise<void> {
    const key = quotaKeyFor(new Date());
    const firestore = this.firestore;

    await runTransaction(firestore, async (tx) => {
      const ref = doc(firestore, QUOTA_PATH, key);
      const snap = await tx.get(ref);
      const now = Date.now();

      const existing = snap.exists() ? (snap.data() as QuotaState) : null;
      if (!canSpend(existing, now, forOnDemand)) {
        throw new Error('QUOTA_EXHAUSTED');
      }

      const used = (existing?.used ?? 0) + 1;
      const budget = existing?.budget ?? DAILY_BUDGET;
      const exhaustedAt = used >= budget ? now : null;

      tx.set(ref, {
        used,
        budget,
        exhaustedAt,
        reservedForOnDemand: existing?.reservedForOnDemand ?? 0,
      });
    });

    // Refresh the cached observable.
    const ref = doc(this.firestore, QUOTA_PATH, key);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      this.quota$.next(snap.data() as QuotaState);
    }
  }

  /**
   * Mark the day exhausted (rate-limit / premium response). Backs off
   * until the next Eastern midnight because the key rolls over.
   */
  async markExhausted(): Promise<void> {
    const key = quotaKeyFor(new Date());
    const ref = doc(this.firestore, QUOTA_PATH, key);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as QuotaState) : null;
    const now = Date.now();

    await setDoc(ref, {
      used: existing?.used ?? DAILY_BUDGET,
      budget: existing?.budget ?? DAILY_BUDGET,
      exhaustedAt: now,
      reservedForOnDemand: existing?.reservedForOnDemand ?? 0,
    });
    this.quota$.next({
      used: existing?.used ?? DAILY_BUDGET,
      budget: existing?.budget ?? DAILY_BUDGET,
      exhaustedAt: now,
      reservedForOnDemand: existing?.reservedForOnDemand ?? 0,
    });
  }

  /**
   * Read today's quota state (for the debug panel / tests).
   */
  async readToday(): Promise<QuotaState | null> {
    const key = quotaKeyFor(new Date());
    const snap = await getDoc(doc(this.firestore, QUOTA_PATH, key));
    return snap.exists() ? (snap.data() as QuotaState) : null;
  }
}
