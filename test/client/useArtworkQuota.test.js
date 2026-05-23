import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useArtworkQuota } from '../../src/client/composables/useArtworkQuota.js';

let origDocument;

function stubDocument() {
  const listeners = new Map();
  origDocument = globalThis.document;

  globalThis.document = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(fn);
        if (idx >= 0) arr.splice(idx, 1);
      }
    },
    get visibilityState() {
      return this._vis ?? 'visible';
    },
    _vis: 'visible',
  };

  return listeners;
}

function restoreDocument() {
  globalThis.document = origDocument;
}

const mockQuotaPayload = {
  date: '2026-06-15',
  limit: 1000,
  providers: [
    { exceeded: false, limit: 1000, provider: 'coverArtArchive', remaining: 950, used: 50 },
    { exceeded: false, limit: 1000, provider: 'fanartTv', remaining: 1000, used: 0 },
  ],
  totalUsed: 50,
};

describe('useArtworkQuota', () => {
  test('loads quota and exposes reactive state', async () => {
    const fetchFn = async () => ({ ...mockQuotaPayload });
    const { quota, isLoading, totalUsed, limit, providers, loadQuota } = useArtworkQuota({
      fetchArtworkQuota: fetchFn,
    });

    assert.equal(isLoading.value, true);
    assert.equal(quota.value, null);

    const promise = loadQuota();
    assert.equal(isLoading.value, true);
    await promise;

    assert.equal(isLoading.value, false);
    assert.equal(totalUsed.value, 50);
    assert.equal(limit.value, 1000);
    assert.equal(providers.value.length, 2);
    assert.equal(providers.value[0].provider, 'coverArtArchive');
    assert.equal(providers.value[0].used, 50);
  });

  test('sets errorMessage on failure', async () => {
    const fetchFn = async () => { throw new Error('network error'); };
    const { errorMessage, quota, loadQuota } = useArtworkQuota({
      fetchArtworkQuota: fetchFn,
    });

    await loadQuota();

    assert.equal(quota.value, null);
    assert.ok(errorMessage.value.length > 0);
  });

  test('anyExceeded is true when a provider is exceeded', async () => {
    const fetchFn = async () => ({
      date: '2026-06-15',
      limit: 100,
      providers: [
        { exceeded: true, limit: 100, provider: 'coverArtArchive', remaining: 0, used: 100 },
        { exceeded: false, limit: 100, provider: 'fanartTv', remaining: 80, used: 20 },
      ],
      totalUsed: 120,
    });

    const { anyExceeded, loadQuota } = useArtworkQuota({ fetchArtworkQuota: fetchFn });
    await loadQuota();

    assert.equal(anyExceeded.value, true);
  });

  test('anyExceeded is false when no provider is exceeded', async () => {
    const fetchFn = async () => ({ ...mockQuotaPayload });
    const { anyExceeded, loadQuota } = useArtworkQuota({ fetchArtworkQuota: fetchFn });
    await loadQuota();

    assert.equal(anyExceeded.value, false);
  });

  test('returns sane defaults before loading', () => {
    const { providers, totalUsed, limit, date, anyExceeded } = useArtworkQuota({
      fetchArtworkQuota: async () => ({}),
    });

    assert.deepEqual(providers.value, []);
    assert.equal(totalUsed.value, 0);
    assert.equal(limit.value, 0);
    assert.equal(date.value, null);
    assert.equal(anyExceeded.value, false);
  });

  test('isRevalidating is true during revalidation', async () => {
    const q = useArtworkQuota({
      fetchArtworkQuota: async () => ({ ...mockQuotaPayload }),
    });

    await q.loadQuota();
    assert.equal(q.isRevalidating.value, false);

    const p = q.revalidate();
    assert.equal(q.isRevalidating.value, true);
    await p;
    assert.equal(q.isRevalidating.value, false);
    q.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const q = useArtworkQuota({
      fetchArtworkQuota: async () => {
        callCount += 1;
        if (callCount === 1) return { ...mockQuotaPayload };
        throw new Error('refresh failed');
      },
    });

    await q.loadQuota();
    assert.equal(q.totalUsed.value, 50);

    await q.revalidate();
    assert.equal(q.totalUsed.value, 50, 'stale data preserved');
    assert.equal(q.isRevalidating.value, false);
    q.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let fetchCount = 0;
    const q = useArtworkQuota({
      fetchArtworkQuota: async () => {
        fetchCount += 1;
        return { ...mockQuotaPayload };
      },
    });

    await q.loadQuota();
    assert.equal(fetchCount, 1);
    q.destroy();

    await q.revalidate();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('loadQuota is no-op after destroy', async () => {
    let fetchCount = 0;
    const q = useArtworkQuota({
      fetchArtworkQuota: async () => {
        fetchCount += 1;
        return { ...mockQuotaPayload };
      },
    });

    await q.loadQuota();
    assert.equal(fetchCount, 1);
    q.destroy();

    await q.loadQuota();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('destroy stops polling', async () => {
    let fetchCount = 0;
    const q = useArtworkQuota({
      fetchArtworkQuota: async () => {
        fetchCount += 1;
        return { ...mockQuotaPayload };
      },
      pollIntervalMs: 50,
    });

    await q.loadQuota();
    assert.equal(fetchCount, 1);
    q.destroy();

    await new Promise((r) => { setTimeout(r, 120); });
    assert.equal(fetchCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let fetchCount = 0;
    const q = useArtworkQuota({
      fetchArtworkQuota: async () => {
        fetchCount += 1;
        return { ...mockQuotaPayload };
      },
      pollIntervalMs: 0,
    });

    await q.loadQuota();
    assert.equal(fetchCount, 1);

    await new Promise((r) => { setTimeout(r, 80); });
    assert.equal(fetchCount, 1, 'no polling when pollIntervalMs=0');
    q.destroy();
  });

  test('attachVisibilityListener triggers revalidate on visibility change', async () => {
    const listeners = stubDocument();
    let fetchCount = 0;
    const q = useArtworkQuota({
      fetchArtworkQuota: async () => {
        fetchCount += 1;
        return { ...mockQuotaPayload };
      },
    });

    await q.loadQuota();
    const countBefore = fetchCount;

    q.attachVisibilityListener();
    assert.equal(listeners.get('visibilitychange').length, 1, 'handler registered');

    globalThis.document._vis = 'visible';
    await listeners.get('visibilitychange')[0]();
    assert.equal(fetchCount, countBefore + 1, 'revalidate called on visibility change');

    q.destroy();
    assert.equal(listeners.get('visibilitychange').length, 0, 'listener removed on destroy');
    restoreDocument();
  });
});
