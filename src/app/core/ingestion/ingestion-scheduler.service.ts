import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { AlphaVantageClient, AlphaVantageError } from './alpha-vantage.client';
import { IngestLockService } from './ingest-lock.service';
import { QuotaLedgerService } from './quota-ledger.service';
import { FirestorePersistAdapter } from './firestore-persist.adapter';
import {
  DatasetDefinition,
  DatasetState,
  buildDatasetRegistry,
  buildOnDemandSeriesDataset,
} from './dataset-registry';
import { FetchQueueService } from '../../services/fetch-queue.service';

export const TICK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export interface DatasetRuntime {
  definition: DatasetDefinition;
  state: DatasetState | null;
}

/**
 * Pure selection logic: given dataset states and now, pick the single most
 * overdue dataset. Tier weighting makes news and Tier A win ties (they are
 * the most-scanned parts of the dashboard).
 *
 * Returns the dataset id to fetch, or null when nothing is due.
 */
export function selectDatasetToFetch(
  definitions: DatasetDefinition[],
  stateById: Map<string, DatasetState | null>,
  now: number
): DatasetDefinition | null {
  const tierWeight: Record<string, number> = {
    news: 0,
    A: 1,
    B: 2,
    C: 3,
    ondemand: 4,
  };

  let best: DatasetDefinition | null = null;
  let bestOverdue = -Infinity;

  for (const def of definitions) {
    const state = stateById.get(def.id);
    if (state?.disabled) continue;

    const lastFetchedAt = state?.lastFetchedAt;
    const overdue = lastFetchedAt ? now - Date.parse(lastFetchedAt) - def.ttlMs : Infinity;

    // Only datasets actually past their TTL are due; a fresh dataset must
    // not be selected just because it is the "least stale".
    if (overdue <= 0) continue;

    // Tie-break: lower tier weight wins.
    if (best === null || overdue > bestOverdue || (overdue === bestOverdue && tierWeight[def.tier] < tierWeight[best.tier])) {
      best = def;
      bestOverdue = overdue;
    }
  }

  return best;
}

/**
 * The "cron inside Angular" the user asked for, hardened.
 *
 * - Runs a tick on bootstrap and every 60 minutes.
 * - Skips ticks while the tab is hidden; runs immediately on becoming
 *   visible if a tick is overdue.
 * - tick(): acquire lock → read dataset states → pick most overdue →
 *   check quota → fetch → persist → stamp lastFetchedAt → release lock.
 * - Bootstrap-on-empty: a dataset with no lastFetchedAt or an empty target
 *   collection is infinitely overdue, so the first tick fires immediately.
 */
@Injectable({ providedIn: 'root' })
export class IngestionSchedulerService {
  private readonly firestore = inject(Firestore);
  private readonly alphaVantage = inject(AlphaVantageClient);
  private readonly lockService = inject(IngestLockService);
  private readonly quotaService = inject(QuotaLedgerService);
  private readonly persistAdapter = inject(FirestorePersistAdapter);
  private readonly fetchQueue = inject(FetchQueueService);

  private readonly definitions = buildDatasetRegistry();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  private tickInFlight = false;

  /** Start the hourly scheduler. Called from the app initializer. */
  start(): void {
    if (this.timer) return;
    this.tick().catch(() => undefined);

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_INTERVAL_MS);

    // Run immediately when the tab becomes visible if overdue.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isTickOverdue()) {
        void this.tick();
      }
    });
  }

  /** One scheduler cycle. Exposed for tests. */
  async tick(): Promise<void> {
    if (this.tickInFlight) return;
    if (document.visibilityState === 'hidden') return;
    this.tickInFlight = true;
    this.lastTickAt = Date.now();

    try {
      const holder = await this.lockService.acquire();
      if (!holder) return;

      try {
        // On-demand requests outrank every background dataset.
        const queued = await this.fetchQueue.dequeueOldest().catch(() => null);
        if (queued) {
          const onDemandDef = buildOnDemandSeriesDataset(queued.symbol);
          try {
            await this.quotaService.reserve(true);
            const raw = await this.alphaVantage.fetchDataset(onDemandDef);
            await onDemandDef.persist(raw, this.persistAdapter);
            await this.stampDatasetState(onDemandDef.id, 'ok');
          } catch (err) {
            await this.handleFetchError(onDemandDef, err);
          } finally {
            await this.fetchQueue.remove(queued.symbol);
          }
          return;
        }

        const stateById = await this.readDatasetStates();
        const dataset = selectDatasetToFetch(this.definitions, stateById, Date.now());
        if (!dataset) return;

        // Reserve BEFORE the HTTP call. reserve() itself validates the
        // budget (including the on-demand reserve and exhaustedAt backoff).
        const isOnDemand = dataset.tier === 'ondemand';
        try {
          await this.quotaService.reserve(isOnDemand);
          const raw = await this.alphaVantage.fetchDataset(dataset);
          await dataset.persist(raw, this.persistAdapter);
          await this.stampDatasetState(dataset.id, 'ok');
        } catch (err) {
          await this.handleFetchError(dataset, err);
        }
      } finally {
        await this.lockService.release(holder);
      }
    } finally {
      this.tickInFlight = false;
    }
  }

  private isTickOverdue(): boolean {
    return Date.now() - this.lastTickAt >= TICK_INTERVAL_MS;
  }

  private async readDatasetStates(): Promise<Map<string, DatasetState | null>> {
    const map = new Map<string, DatasetState | null>();
    for (const def of this.definitions) {
      const ref = doc(this.firestore, 'system/state/datasets', def.id);
      const snap = await getDoc(ref);
      map.set(def.id, snap.exists() ? (snap.data() as DatasetState) : null);
    }
    return map;
  }

  private async stampDatasetState(id: string, status: DatasetState['lastStatus']): Promise<void> {
    const ref = doc(this.firestore, 'system/state/datasets', id);
    await setDoc(ref, {
      lastFetchedAt: new Date().toISOString(),
      lastStatus: status,
      lastError: null,
      disabled: false,
    });
  }

  private async handleFetchError(dataset: DatasetDefinition, err: unknown): Promise<void> {
    const error = err as AlphaVantageError;
    const ref = doc(this.firestore, 'system/state/datasets', dataset.id);

    if (error?.kind === 'rate-limited') {
      // Exhausted for the day — back off until Eastern midnight.
      await this.quotaService.markExhausted();
      await setDoc(ref, {
        lastStatus: 'error',
        lastError: error.message,
      });
    } else if (error?.kind === 'premium-gated') {
      await setDoc(ref, {
        lastStatus: 'disabled',
        lastError: error.message,
        disabled: true,
      });
    } else if (error?.kind === 'bad-request') {
      await setDoc(ref, {
        lastStatus: 'disabled',
        lastError: error.message,
        disabled: true,
      });
    } else {
      // Network / unknown — leave enabled, retry next tick.
      await setDoc(ref, {
        lastStatus: 'error',
        lastError: error?.message ?? String(err),
      });
    }
  }
}
