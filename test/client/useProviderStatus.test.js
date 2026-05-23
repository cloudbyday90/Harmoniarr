import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useProviderStatus } from '../../src/client/composables/useProviderStatus.js';

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

describe('useProviderStatus', () => {
  test('loads provider status with linked providers', async () => {
    const workflow = useProviderStatus({
      fetchStatus: async () => ({
        spotify: { linked: true, username: 'user1' },
        youtube: { linked: false },
        appleMusic: { configured: true },
      }),
    });

    await workflow.loadStatus();

    assert.equal(workflow.spotifyLinked.value, true);
    assert.equal(workflow.youtubeLinked.value, false);
    assert.equal(workflow.appleMusicConfigured.value, true);
    assert.equal(workflow.isLoading.value, false);
    assert.equal(workflow.errorMessage.value, '');
    workflow.destroy();
  });

  test('surfaces fetch errors in errorMessage', async () => {
    const workflow = useProviderStatus({
      fetchStatus: async () => { throw new Error('provider status unavailable'); },
    });

    await workflow.loadStatus();

    assert.equal(workflow.errorMessage.value, 'provider status unavailable');
    assert.equal(workflow.status.value, null);
    assert.equal(workflow.isLoading.value, false);
    workflow.destroy();
  });

  test('computed properties return null before load', () => {
    const workflow = useProviderStatus({
      fetchStatus: async () => ({}),
    });

    assert.equal(workflow.spotify.value, null);
    assert.equal(workflow.youtube.value, null);
    assert.equal(workflow.appleMusic.value, null);
    assert.equal(workflow.spotifyLinked.value, false);
    assert.equal(workflow.youtubeLinked.value, false);
    assert.equal(workflow.appleMusicConfigured.value, false);
    workflow.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const workflow = useProviderStatus({
      fetchStatus: async () => ({ spotify: { linked: true } }),
    });

    await workflow.loadStatus();
    assert.equal(workflow.isRevalidating.value, false);

    const p = workflow.revalidate();
    assert.equal(workflow.isRevalidating.value, true);
    await p;
    assert.equal(workflow.isRevalidating.value, false);
    workflow.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    let callCount = 0;
    const workflow = useProviderStatus({
      fetchStatus: async () => {
        callCount += 1;
        if (callCount === 1) return { spotify: { linked: true } };
        throw new Error('refresh failed');
      },
    });

    await workflow.loadStatus();
    assert.equal(workflow.spotifyLinked.value, true);

    await workflow.revalidate();
    assert.equal(workflow.spotifyLinked.value, true, 'stale data preserved');
    assert.equal(workflow.isRevalidating.value, false);
    workflow.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let fetchCount = 0;
    const workflow = useProviderStatus({
      fetchStatus: async () => {
        fetchCount += 1;
        return {};
      },
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);
    workflow.destroy();

    await workflow.revalidate();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('loadStatus is no-op after destroy', async () => {
    let fetchCount = 0;
    const workflow = useProviderStatus({
      fetchStatus: async () => {
        fetchCount += 1;
        return {};
      },
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);
    workflow.destroy();

    await workflow.loadStatus();
    assert.equal(fetchCount, 1, 'no fetch after destroy');
  });

  test('destroy stops polling', async () => {
    let fetchCount = 0;
    const workflow = useProviderStatus({
      fetchStatus: async () => {
        fetchCount += 1;
        return {};
      },
      pollIntervalMs: 50,
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);
    workflow.destroy();

    await new Promise((r) => { setTimeout(r, 120); });
    assert.equal(fetchCount, 1, 'no additional fetch after destroy');
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    let fetchCount = 0;
    const workflow = useProviderStatus({
      fetchStatus: async () => {
        fetchCount += 1;
        return {};
      },
      pollIntervalMs: 0,
    });

    await workflow.loadStatus();
    assert.equal(fetchCount, 1);

    await new Promise((r) => { setTimeout(r, 80); });
    assert.equal(fetchCount, 1, 'no polling when pollIntervalMs=0');
    workflow.destroy();
  });

  test('attachVisibilityListener triggers revalidate on visibility change', async () => {
    const listeners = stubDocument();
    let fetchCount = 0;
    const workflow = useProviderStatus({
      fetchStatus: async () => {
        fetchCount += 1;
        return {};
      },
    });

    await workflow.loadStatus();
    const countBefore = fetchCount;

    workflow.attachVisibilityListener();
    assert.equal(listeners.get('visibilitychange').length, 1, 'handler registered');

    globalThis.document._vis = 'visible';
    await listeners.get('visibilitychange')[0]();
    assert.equal(fetchCount, countBefore + 1, 'revalidate called on visibility change');

    workflow.destroy();
    assert.equal(listeners.get('visibilitychange').length, 0, 'listener removed on destroy');
    restoreDocument();
  });
});
