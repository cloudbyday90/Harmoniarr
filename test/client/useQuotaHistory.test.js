import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useQuotaHistory } from '../../src/client/composables/useQuotaHistory.js';

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

const mockHistoryPayload = {
  history: {
    coverArtArchive: [
      { date: '2026-06-14', requestCount: 45 },
      { date: '2026-06-15', requestCount: 50 },
    ],
    fanartTv: [
      { date: '2026-06-14', requestCount: 0 },
      { date: '2026-06-15', requestCount: 3 },
    ],
  },
  limit: 1000,
};

describe('useQuotaHistory', () => {
  test('loads history and exposes reactive state', async () => {
    const fetchFn = async () => ({ ...mockHistoryPayload });
    const qh = useQuotaHistory({ fetchArtworkQuotaHistory: fetchFn });

    assert.equal(qh.isLoading.value, true);
    assert.equal(qh.history.value, null);

    await qh.load();

    assert.equal(qh.isLoading.value, false);
    assert.equal(qh.history.value.limit, 1000);
    assert.equal(Object.keys(qh.history.value.history).length, 2);
    assert.deepEqual(qh.history.value.history.coverArtArchive[0], {
      date: '2026-06-14',
      requestCount: 45,
    });
    qh.destroy();
  });

  test('passes days parameter to fetcher', async () => {
    let capturedDays;
    const fetchFn = async ({ days }) => {
      capturedDays = days;
      return mockHistoryPayload;
    };
    const qh = useQuotaHistory({ days: 14, fetchArtworkQuotaHistory: fetchFn });

    await qh.load();

    assert.equal(capturedDays, 14);
    qh.destroy();
  });

  test('defaults days to 30', async () => {
    let capturedDays;
    const fetchFn = async ({ days }) => {
      capturedDays = days;
      return mockHistoryPayload;
    };
    const qh = useQuotaHistory({ fetchArtworkQuotaHistory: fetchFn });

    await qh.load();

    assert.equal(capturedDays, 30);
    qh.destroy();
  });

  test('sets history to null on failure', async () => {
    const fetchFn = async () => { throw new Error('network error'); };
    const qh = useQuotaHistory({ fetchArtworkQuotaHistory: fetchFn });

    await qh.load();

    assert.equal(qh.history.value, null);
    assert.equal(qh.isLoading.value, false);
    qh.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const qh = useQuotaHistory({
      fetchArtworkQuotaHistory: async () => ({ ...mockHistoryPayload }),
    });

    await qh.load();
    assert.equal(qh.isRevalidating.value, false);

    const p = qh.revalidate();
    assert.equal(qh.isRevalidating.value, true);
    await p;
    assert.equal(qh.isRevalidating.value, false);
    qh.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const qh = useQuotaHistory({
      fetchArtworkQuotaHistory: async () => {
        callCount += 1;
        if (callCount === 1) return { ...mockHistoryPayload };
        throw new Error('refresh failed');
      },
    });

    await qh.load();
    assert.equal(qh.history.value.limit, 1000);

    await qh.revalidate();
    assert.equal(qh.history.value.limit, 1000, 'stale data preserved');
    assert.equal(qh.isRevalidating.value, false);
    qh.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let fetchCount = 0;
    const qh = useQuotaHistory({
      fetchArtworkQuotaHistory: async () => {
        fetchCount += 1;
        return { ...mockHistoryPayload };
      },
    });

    await qh.load();
    assert.equal(fetchCount, 1);
    qh.destroy();

    await qh.revalidate();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('load is no-op after destroy', async () => {
    let fetchCount = 0;
    const qh = useQuotaHistory({
      fetchArtworkQuotaHistory: async () => {
        fetchCount += 1;
        return { ...mockHistoryPayload };
      },
    });

    await qh.load();
    assert.equal(fetchCount, 1);
    qh.destroy();

    await qh.load();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('destroy stops polling', async () => {
    let fetchCount = 0;
    const qh = useQuotaHistory({
      fetchArtworkQuotaHistory: async () => {
        fetchCount += 1;
        return { ...mockHistoryPayload };
      },
      pollIntervalMs: 50,
    });

    await qh.load();
    assert.equal(fetchCount, 1);
    qh.destroy();

    await new Promise((r) => { setTimeout(r, 120); });
    assert.equal(fetchCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let fetchCount = 0;
    const qh = useQuotaHistory({
      fetchArtworkQuotaHistory: async () => {
        fetchCount += 1;
        return { ...mockHistoryPayload };
      },
      pollIntervalMs: 0,
    });

    await qh.load();
    assert.equal(fetchCount, 1);

    await new Promise((r) => { setTimeout(r, 80); });
    assert.equal(fetchCount, 1, 'no polling when pollIntervalMs=0');
    qh.destroy();
  });

  test('attachVisibilityListener triggers revalidate on visibility change', async () => {
    const listeners = stubDocument();
    let fetchCount = 0;
    const qh = useQuotaHistory({
      fetchArtworkQuotaHistory: async () => {
        fetchCount += 1;
        return { ...mockHistoryPayload };
      },
    });

    await qh.load();
    const countBefore = fetchCount;

    qh.attachVisibilityListener();
    assert.equal(listeners.get('visibilitychange').length, 1, 'handler registered');

    globalThis.document._vis = 'visible';
    await listeners.get('visibilitychange')[0]();
    assert.equal(fetchCount, countBefore + 1, 'revalidate called on visibility change');

    qh.destroy();
    assert.equal(listeners.get('visibilitychange').length, 0, 'listener removed on destroy');
    restoreDocument();
  });
});
