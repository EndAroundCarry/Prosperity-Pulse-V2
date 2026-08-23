/**
 * Firestore-backed distributed lock that prevents multiple browser
 * tabs (or visitors) from each spending API calls simultaneously.
 *
 * Uses `system/ingest_lock` with a 5-minute lease.  Acquired inside
 * a Firestore transaction — only one writer wins.  Released in
 * `finally` so the lock is always freed even on errors.
 */

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  runTransaction,
  Timestamp,
  DocumentReference,
} from '@angular/fire/firestore';

const LOCK_PATH = 'system/ingest_lock';
const LEASE_MS = 5 * 60 * 1000; // 5 minutes

export interface IngestLockData {
  holder: string;
  acquiredAt: Timestamp;
  leaseExpiresAt: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class IngestLockService {
  private readonly firestore = inject(Firestore);
  private readonly tabId: string =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  /**
   * Try to acquire the ingest lock.  Returns `true` if this tab
   * now holds the lock, `false` if another tab has it.
   *
   * The lock is automatically released after LEASE_MS or when
   * `releaseLock()` is called.
   */
  async tryAcquire(): Promise<boolean> {
    const lockRef = doc(this.firestore, LOCK_PATH) as DocumentReference<IngestLockData>;
    const now = Date.now();

    try {
      await runTransaction(this.firestore, async (tx) => {
        const snap = await tx.get(lockRef);
        const data = snap.data();
        const leaseExpired =
          !data || !data.leaseExpiresAt || data.leaseExpiresAt.toMillis() < now;

        if (!snap.exists() || leaseExpired) {
          const lockData: IngestLockData = {
            holder: this.tabId,
            acquiredAt: Timestamp.fromMillis(now),
            leaseExpiresAt: Timestamp.fromMillis(now + LEASE_MS),
          };
          tx.set(lockRef, lockData);
        } else if (data.holder === this.tabId) {
          // Already hold the lock — extend it
          const updated: IngestLockData = {
            ...data,
            leaseExpiresAt: Timestamp.fromMillis(now + LEASE_MS),
          };
          tx.set(lockRef, updated);
        } else {
          // Another tab holds a valid lease — throw to abort
          throw new Error(
            `Lock held by ${data.holder} until ${new Date(data.leaseExpiresAt.toMillis()).toISOString()}`
          );
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Release the lock early.  Safe to call even if we don't hold it —
   * the transaction checks the holder field.
   */
  async releaseLock(): Promise<void> {
    const lockRef = doc(this.firestore, LOCK_PATH) as DocumentReference<IngestLockData>;
    try {
      await runTransaction(this.firestore, async (tx) => {
        const snap = await tx.get(lockRef);
        if (snap.exists() && snap.data()?.holder === this.tabId) {
          tx.delete(lockRef);
        }
      });
    } catch {
      // Best-effort — lease will expire naturally
    }
  }

  /**
   * Check whether this tab currently holds the lock (read-only,
   * no transaction).  Useful for diagnostic panels.
   */
  async isHolder(): Promise<boolean> {
    const lockRef = doc(this.firestore, LOCK_PATH) as DocumentReference<IngestLockData>;
    try {
      const snap = await import('@angular/fire/firestore').then((m) =>
        m.getDoc(lockRef)
      );
      const data = snap.data();
      return !!data && data.holder === this.tabId;
    } catch {
      return false;
    }
  }
}
