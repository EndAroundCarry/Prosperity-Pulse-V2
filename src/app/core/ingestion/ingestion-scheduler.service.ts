/**
 * Ingestion scheduler — the "cron inside Angular" the user asked for.
 *
 * Runs tick() on app bootstrap and every 60 minutes.  Each tick:
 * 1. Acquire distributed lock (if another tab has it, skip)
 * 2. Check quota (if exhausted, skip)
 * 3. Read dataset state from Firestore (lastFetchedAt per dataset)
 * 4. Compute overdue datasets (staleness = now - lastFetchedAt - ttl)
 * 5. Pick the single most overdue (with tier weighting)
 * 6. Fetch one call, persist result, stamp lastFetchedAt
 * 7. Release lock
 *
 * Skips ticks while document.visibilityState === 'hidden'.
 * Runs one immediately on becoming visible if overdue.
 * Bootstrap-on-empty: if a dataset has no lastFetchedAt, it is
 * treated as infinitely overdue and fetched immediately.
 */

import { Injectable, inject, NgZone } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  setDoc,
  DocumentReference,
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import {
  DATASET_REGISTRY,
  DatasetDefinition,
  findDataset,
} from './dataset-registry';
import { IngestLockService } from './ingest-lock.service';
import { QuotaLedgerService } from './quota-ledger.service';
import { AlphaVantageClient, PersistContext } from './alpha-vantage.client';
import { RetentionService } from './retention.service';
import { environment } from '../../../environments/environment';

const TICK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

export interface DatasetState {
  lastFetchedAt: string | null;
  lastStatus: 'ok' | 'error' | 'disabled' | null;
  lastError: string | null;
  disabled: boolean;
  rotationIndex: number;
}

@Injectable({ providedIn: 'root' })
export class IngestionSchedulerService {
  private readonly firestore = inject(Firestore);
  private readonly lockService = inject(IngestLockService);
  private readonly quota = inject(QuotaLedgerService);
  private readonly avClient = inject(AlphaVantageClient);
  private readonly retention = inject(RetentionService);
  private readonly zone = inject(NgZone);

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastRetentionRun = 0;
  private initialized = false;

  /** Expose for debug panels */
  get isRunning(): boolean {
    return this.tickTimer !== null;
  }

  /**
   * Start the scheduler.  Called from provideAppInitializer.
   * Runs one immediate tick, then every hour.
   */
  start(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Start quota listener
    this.quota.startListening();

    // Run first tick immediately (bootstrap-on-empty)
    this.zone.runOutsideAngular(() => {
      this.tick();

      // Set up hourly interval
      this.tickTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return; // Don't spend quota in background tabs
        }
        this.tick();
      }, TICK_INTERVAL_MS);

      // Run a tick when tab becomes visible after being hidden
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.tick(); // tick() will check if anything is overdue
          }
        });
      }
    });
  }

  /**
   * Main tick — the single orchestration loop.
   */
  private async tick(): Promise<void> {
    // 1. Try to acquire the distributed lock
    const acquired = await this.lockService.tryAcquire();
    if (!acquired) {
      return; // Another tab is handling this tick
    }

    try {
      // 2. Check quota
      if (this.quota.current.exhausted) {
        return;
      }

      // 3. Run retention once per day (within the lock)
      const now = Date.now();
      if (now - this.lastRetentionRun > RETENTION_INTERVAL_MS) {
        try {
          await this.retention.runCleanup();
          this.lastRetentionRun = now;
        } catch (err) {
          console.error('[Ingestion] Retention cleanup failed:', err);
        }
      }

      // 4. Read all dataset states from Firestore
      const states = await this.getAllDatasetStates();

      // 5. Compute overdue datasets
      const candidates = this.findMostOverdue(states);

      if (candidates.length === 0) {
        return; // Nothing to fetch
      }

      // 6. Pick the winner (most overdue, tier-weighted)
      const winner = candidates[0];

      // 7. Reserve a quota call
      const isOnDemand = winner.dataset.tier === 'ondemand';
      const reserved = await this.quota.reserveCall(isOnDemand);
      if (!reserved) {
        return; // Budget exhausted
      }

      // 8. Fetch
      const result = await this.avClient.fetch(winner.dataset, environment.alphaVantageKey);

      // 9. Handle result
      if (result.ok) {
        // Persist data
        const ctx: PersistContext = { dataset: winner.dataset };
        try {
          await winner.dataset.persist(result.data, ctx);
        } catch (err) {
          console.error(`[Ingestion] Persist failed for ${winner.dataset.id}:`, err);
        }

        // Stamp success
        await this.stampDatasetState(winner.dataset.id, {
          lastFetchedAt: new Date().toISOString(),
          lastStatus: 'ok',
          lastError: null,
          disabled: false,
        });
      } else {
        // Handle errors
        switch (result.error) {
          case 'rate_limited':
            await this.quota.markExhausted();
            await this.stampDatasetState(winner.dataset.id, {
              lastFetchedAt: new Date().toISOString(),
              lastStatus: 'error',
              lastError: result.detail ?? 'Rate limited',
              disabled: false,
            });
            break;

          case 'premium_gated':
            // Auto-disable permanently
            await this.stampDatasetState(winner.dataset.id, {
              lastFetchedAt: new Date().toISOString(),
              lastStatus: 'disabled',
              lastError: result.detail ?? 'Premium endpoint',
              disabled: true,
            });
            console.warn(
              `[Ingestion] Dataset ${winner.dataset.id} is premium-gated, auto-disabled.`
            );
            break;

          case 'bad_params':
            // Disable permanently (likely a removed or misconfigured endpoint)
            await this.stampDatasetState(winner.dataset.id, {
              lastFetchedAt: new Date().toISOString(),
              lastStatus: 'disabled',
              lastError: result.detail ?? 'Bad params',
              disabled: true,
            });
            break;

          case 'http_error':
            await this.stampDatasetState(winner.dataset.id, {
              lastFetchedAt: new Date().toISOString(),
              lastStatus: 'error',
              lastError: result.detail ?? 'HTTP error',
              disabled: false,
            });
            break;
        }
      }
    } catch (err) {
      console.error('[Ingestion] Tick error:', err);
    } finally {
      await this.lockService.releaseLock();
    }
  }

  /**
   * Read all dataset states from Firestore in one batch.
   */
  private async getAllDatasetStates(): Promise<Map<string, DatasetState>> {
    const statesRef = collection(this.firestore, 'system/state/datasets');
    const docs = await firstValueFrom(
      collectionData(statesRef, { idField: 'firestoreId' })
    );

    const map = new Map<string, DatasetState>();
    for (const doc of docs as any[]) {
      const id = doc.firestoreId;
      map.set(id, {
        lastFetchedAt: doc.lastFetchedAt ?? null,
        lastStatus: doc.lastStatus ?? null,
        lastError: doc.lastError ?? null,
        disabled: doc.disabled ?? false,
        rotationIndex: doc.rotationIndex ?? 0,
      });
    }
    return map;
  }

  /**
   * Find the most overdue dataset.
   *
   * A dataset is overdue if:
   * - It has no lastFetchedAt (bootstrap-on-empty → infinite staleness)
   * - now > lastFetchedAt + ttlMs
   *
   * Tier weighting: news > A > B > C > ondemand (news and A win ties).
   */
  private findMostOverdue(
    states: Map<string, DatasetState>
  ): { dataset: DatasetDefinition; staleness: number }[] {
    const now = Date.now();
    const TIER_WEIGHT: Record<string, number> = {
      news: 5,
      A: 4,
      B: 2,
      C: 1,
      ondemand: 3,
    };

    const candidates: { dataset: DatasetDefinition; staleness: number }[] = [];

    for (const dataset of DATASET_REGISTRY) {
      const state = states.get(dataset.id);

      // Skip disabled datasets
      if (state?.disabled) continue;

      // Handle rotation groups — only one member per group per tick
      if (dataset.rotationGroup) {
        const groupMembers = DATASET_REGISTRY.filter(
          (d) => d.rotationGroup === dataset.rotationGroup
        );
        const rotationIndex = state?.rotationIndex ?? 0;
        const expectedIndex = rotationIndex % groupMembers.length;
        if (groupMembers[expectedIndex]?.id !== dataset.id) continue;
      }

      // Compute staleness
      let staleness: number;
      if (!state?.lastFetchedAt) {
        // Bootstrap-on-empty: infinite staleness
        staleness = Infinity;
      } else {
        const fetchedAt = new Date(state.lastFetchedAt).getTime();
        staleness = now - fetchedAt - dataset.ttlMs;
      }

      if (staleness > 0) {
        // Weight by tier so news and A win ties
        const weight = TIER_WEIGHT[dataset.tier] ?? 1;
        candidates.push({
          dataset,
          staleness: staleness * weight,
        });
      }
    }

    // Sort by staleness descending (most overdue first)
    candidates.sort((a, b) => b.staleness - a.staleness);
    return candidates;
  }

  /**
   * Stamp a dataset's state in Firestore after a fetch attempt.
   */
  private async stampDatasetState(
    datasetId: string,
    state: Partial<DatasetState>
  ): Promise<void> {
    const ref = doc(
      this.firestore,
      `system/state/datasets/${datasetId}`
    ) as DocumentReference;

    // Merge with existing state
    const existing = state.lastFetchedAt ? {} : {};
    await setDoc(ref, { ...existing, ...state }, { merge: true });

    // If this was a rotation group member, advance the rotation index
    const dataset = findDataset(datasetId);
    if (dataset?.rotationGroup) {
      const groupMembers = DATASET_REGISTRY.filter(
        (d) => d.rotationGroup === dataset.rotationGroup
      );
      const currentIndex = groupMembers.findIndex((d) => d.id === datasetId);
      if (currentIndex >= 0) {
        await setDoc(
          ref,
          { rotationIndex: (currentIndex + 1) % groupMembers.length },
          { merge: true }
        );
      }
    }
  }

  /**
   * Manually trigger a tick (for debug/test).
   */
  async forceTick(): Promise<void> {
    await this.tick();
  }
}
