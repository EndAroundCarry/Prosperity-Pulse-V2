import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, runTransaction, setDoc } from '@angular/fire/firestore';

export interface IngestLock {
  holder: string;
  acquiredAt: number;
  leaseExpiresAt: number;
}

export const LOCK_PATH = 'system/ingest_lock';
export const LOCK_LEASE_MS = 5 * 60 * 1000;

/**
 * Pure decision: is the lock currently held by a live lease?
 * Exported for unit testing without Firestore.
 */
export function lockHeld(lock: Partial<IngestLock> | null | undefined, now: number): boolean {
  return Boolean(lock && typeof lock.leaseExpiresAt === 'number' && lock.leaseExpiresAt > now);
}

/**
 * Distributed lock for ingestion, backed by Firestore `system/ingest_lock`.
 *
 * Acquire claims the lock only if it is absent or the lease has expired.
 * The 5-minute lease means a crashed tab releases the lock automatically
 * after 5 minutes; `release()` in a `finally` releases it immediately on
 * the happy path. This is what stops N open tabs from making N API calls.
 */
@Injectable({ providedIn: 'root' })
export class IngestLockService {
  private readonly firestore = inject(Firestore);

  /**
   * Try to acquire the lock. Returns the holder id on success, null if held.
   */
  async acquire(): Promise<string | null> {
    const holder = generateHolderId();
    const firestore = this.firestore;

    try {
      await runTransaction(firestore, async (tx) => {
        const ref = doc(firestore, LOCK_PATH);
        const snap = await tx.get(ref);
        const now = Date.now();

        const existing = snap.exists() ? (snap.data() as Partial<IngestLock>) : null;
        if (lockHeld(existing, now)) {
          // Another tab/visitor holds a live lease — abort the transaction.
          throw new Error('INGEST_LOCK_HELD');
        }

        tx.set(ref, {
          holder,
          acquiredAt: now,
          leaseExpiresAt: now + LOCK_LEASE_MS,
        });
      });
      return holder;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'INGEST_LOCK_HELD') {
        return null;
      }
      // Unknown failure — treat as not acquired (be conservative).
      return null;
    }
  }

  /**
   * Release the lock if we still hold it. Safe to call unconditionally.
   */
  async release(holder: string | null): Promise<void> {
    if (!holder) return;

    try {
      const ref = doc(this.firestore, LOCK_PATH);
      const snap = await getDoc(ref);
      if (snap.exists() && (snap.data() as Partial<IngestLock>).holder === holder) {
        await setDoc(ref, { holder: '', acquiredAt: 0, leaseExpiresAt: 0 });
      }
    } catch {
      // Best-effort release; the lease will expire anyway.
    }
  }
}

export function generateHolderId(): string {
  if (typeof self !== 'undefined' && self.crypto?.randomUUID) {
    return self.crypto.randomUUID();
  }
  // Deterministic fallback for non-secure contexts (tests, SSR).
  return `holder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
