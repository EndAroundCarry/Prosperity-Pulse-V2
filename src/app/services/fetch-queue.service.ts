import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from '@angular/fire/firestore';

export interface FetchQueueEntry {
  symbol: string;
  requestedAt: string;
  requestedBy: string | null;
}

/**
 * On-demand fetch queue at `system/state/fetch_queue/{symbol}`.
 *
 * When a user opens a ticker with no cached data, a request doc is written
 * here. The next scheduler tick spends one reserved on-demand call on the
 * oldest entry (highest priority, dedup by symbol via doc id).
 */
@Injectable({ providedIn: 'root' })
export class FetchQueueService {
  private readonly firestore = inject(Firestore);

  /** Idempotent — dedup happens naturally by document id. */
  async enqueue(symbol: string, requestedBy: string | null = null): Promise<void> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    await setDoc(doc(this.firestore, 'system/state/fetch_queue', normalized), {
      symbol: normalized,
      requestedAt: new Date().toISOString(),
      requestedBy,
    });
  }

  /** Oldest pending request, or null when the queue is empty. */
  async dequeueOldest(): Promise<FetchQueueEntry | null> {
    const q = query(
      collection(this.firestore, 'system/state/fetch_queue'),
      orderBy('requestedAt', 'asc'),
      limit(1)
    );
    const snap = await getDocs(q);
    const first = snap.docs[0];
    if (!first) return null;
    return first.data() as FetchQueueEntry;
  }

  async remove(symbol: string): Promise<void> {
    const ref = doc(this.firestore, 'system/state/fetch_queue', symbol.trim().toUpperCase());
    await deleteDoc(ref);
  }

  /** Whether a request for this symbol is already queued. */
  async isQueued(symbol: string): Promise<boolean> {
    const snap = await getDoc(doc(this.firestore, 'system/state/fetch_queue', symbol.trim().toUpperCase()));
    return snap.exists();
  }
}
