import { selectDatasetToFetch } from './ingestion-scheduler.service';
import { DatasetState, buildDatasetRegistry } from './dataset-registry';

describe('scheduler dataset selection', () => {
  const now = Date.now();
  const registry = buildDatasetRegistry();
  const emptyState = (): DatasetState | null => null;

  it('picks an infinitely-overdue dataset (no state yet) on cold start', () => {
    const states = new Map<string, DatasetState | null>(registry.map((d) => [d.id, emptyState()]));
    const picked = selectDatasetToFetch(registry, states, now);
    // Cold start: news core should be picked first (tier weight).
    expect(picked?.id).toBe('news.core');
  });

  it('picks the single most-overdue dataset once some are fresh', () => {
    const states = new Map<string, DatasetState | null>();
    for (const d of registry) {
      if (d.id === 'series.SPY') {
        // Very overdue.
        states.set(d.id, { lastFetchedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), lastStatus: 'ok' });
      } else {
        // Everything else fresh.
        states.set(d.id, { lastFetchedAt: new Date(now - 1000).toISOString(), lastStatus: 'ok' });
      }
    }
    const picked = selectDatasetToFetch(registry, states, now);
    expect(picked?.id).toBe('series.SPY');
  });

  it('never picks a disabled dataset', () => {
    const states = new Map<string, DatasetState | null>(registry.map((d) => [d.id, emptyState()]));
    states.set('news.core', { lastFetchedAt: null, lastStatus: 'disabled', disabled: true });
    const picked = selectDatasetToFetch(registry, states, now);
    expect(picked?.id).not.toBe('news.core');
    expect(picked).not.toBeNull();
  });

  it('returns null when everything is within TTL', () => {
    const states = new Map<string, DatasetState | null>();
    for (const d of registry) {
      states.set(d.id, { lastFetchedAt: new Date(now - 1000).toISOString(), lastStatus: 'ok' });
    }
    expect(selectDatasetToFetch(registry, states, now)).toBeNull();
  });

  it('treats a dataset older than its TTL as due', () => {
    const states = new Map<string, DatasetState | null>(registry.map((d) => [d.id, emptyState()]));
    // Mark everything fresh except news.core, which is older than its 6h TTL.
    for (const d of registry) {
      states.set(d.id, { lastFetchedAt: new Date(now - 1000).toISOString(), lastStatus: 'ok' });
    }
    const newsCore = registry.find((d) => d.id === 'news.core')!;
    states.set('news.core', {
      lastFetchedAt: new Date(now - newsCore.ttlMs - 1000).toISOString(),
      lastStatus: 'ok',
    });
    const picked = selectDatasetToFetch(registry, states, now);
    expect(picked?.id).toBe('news.core');
  });
});
