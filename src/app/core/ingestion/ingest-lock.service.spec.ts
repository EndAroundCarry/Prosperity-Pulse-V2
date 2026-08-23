import { lockHeld, IngestLock, LOCK_LEASE_MS } from './ingest-lock.service';

describe('ingest lock', () => {
  const now = 1_000_000;

  it('is not held when the lock doc is absent', () => {
    expect(lockHeld(null, now)).toBeFalse();
    expect(lockHeld(undefined, now)).toBeFalse();
  });

  it('is held while the lease is live', () => {
    const lock: IngestLock = {
      holder: 'tab-1',
      acquiredAt: now - 1000,
      leaseExpiresAt: now + LOCK_LEASE_MS - 1000,
    };
    expect(lockHeld(lock, now)).toBeTrue();
  });

  it('releases automatically when the lease expires', () => {
    const lock: IngestLock = {
      holder: 'tab-1',
      acquiredAt: now - LOCK_LEASE_MS - 1000,
      leaseExpiresAt: now - 1,
    };
    expect(lockHeld(lock, now)).toBeFalse();
  });

  it('treats a malformed lock as not held', () => {
    expect(lockHeld({ holder: 'x', acquiredAt: 0 } as IngestLock, now)).toBeFalse();
  });
});
