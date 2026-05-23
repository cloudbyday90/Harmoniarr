import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { useNetworkSearchWorkflow } from '../../src/client/composables/useNetworkSearchWorkflow.js';

function makeMocks({ stateSequence = ['completed'] } = {}) {
  let stateIndex = 0;
  const fetchStatus = async () => ({ state: 'connected' });
  const startSearch = async () => ({ searchId: 'search-1', state: 'inprogress' });
  const fetchResponses = async () => ([
    {
      fileCount: 4,
      hasFreeUploadSlot: true,
      queueLength: 0,
      totalSize: 4096,
      uploadSpeed: 2048,
      username: 'peer-1',
    },
  ]);
  const fetchSearchState = async () => {
    const state = stateSequence[stateIndex] ?? 'completed';
    stateIndex += 1;
    return { isComplete: state === 'completed', state };
  };
  return { fetchResponses, fetchSearchState, fetchStatus, startSearch };
}

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

describe('useNetworkSearchWorkflow', () => {
  test('refreshes status and completes a search', async () => {
    const mocks = makeMocks();
    const wf = useNetworkSearchWorkflow({ ...mocks, pollIntervalMs: 0 });

    await wf.refreshStatus();
    assert.equal(wf.slskdStatus.value.state, 'connected');

    wf.networkQuery.value = '  Boards of Canada  ';
    await wf.runNetworkSearch();

    assert.equal(wf.hasNetworkSearched.value, true);
    assert.equal(wf.isNetworkSearching.value, false);
    assert.equal(wf.totalFiles.value, 4);
    assert.equal(wf.totalResultBytes.value, 4096);
    wf.destroy();
  });

  test('surfaces missing search identifiers as start failures', async () => {
    const wf = useNetworkSearchWorkflow({
      startSearch: async () => ({}),
      pollIntervalMs: 0,
    });

    wf.networkQuery.value = 'Autechre';
    await wf.runNetworkSearch();

    assert.equal(wf.networkErrorMessage.value, 'slskd did not return a search identifier');
    assert.equal(wf.isNetworkSearching.value, false);
    wf.destroy();
  });

  test('captures polling failures', async () => {
    const wf = useNetworkSearchWorkflow({
      fetchResponses: async () => { throw new Error('poll exploded'); },
      fetchSearchState: async () => ({ state: 'inprogress' }),
      startSearch: async () => ({ searchId: 'search-1' }),
      pollIntervalMs: 0,
    });

    wf.networkQuery.value = 'Tycho';
    await wf.runNetworkSearch();

    assert.equal(wf.networkErrorMessage.value, 'poll exploded');
    assert.equal(wf.isNetworkSearching.value, false);
    wf.destroy();
  });

  test('isRevalidating is true during revalidation', async () => {
    const mocks = makeMocks({ stateSequence: ['inprogress', 'completed'] });
    const wf = useNetworkSearchWorkflow({ ...mocks, pollIntervalMs: 0 });

    wf.networkQuery.value = 'Test';
    await wf.runNetworkSearch();

    const p = wf.revalidate();
    assert.equal(wf.isRevalidating.value, true);
    await p;
    assert.equal(wf.isRevalidating.value, false);
    wf.destroy();
  });

  test('revalidate is no-op before first search', async () => {
    let fetchCount = 0;
    const wf = useNetworkSearchWorkflow({
      fetchResponses: async () => { fetchCount += 1; return []; },
      fetchSearchState: async () => { fetchCount += 1; return { state: 'completed' }; },
      pollIntervalMs: 0,
    });

    await wf.revalidate();
    assert.equal(fetchCount, 0);
    wf.destroy();
  });

  test('revalidate preserves stale data on error', async () => {
    const mocks = makeMocks();
    let callCount = 0;
    const wf = useNetworkSearchWorkflow({
      ...mocks,
      fetchResponses: async () => {
        callCount += 1;
        if (callCount === 1) return [{ fileCount: 4, username: 'peer-1' }];
        throw new Error('refresh failed');
      },
      fetchSearchState: async () => ({ state: 'completed', isComplete: true }),
      pollIntervalMs: 0,
    });

    wf.networkQuery.value = 'Test';
    await wf.runNetworkSearch();
    assert.equal(wf.responses.value.length, 1);

    await wf.revalidate();
    assert.equal(wf.responses.value.length, 1, 'stale data preserved');
    assert.equal(wf.isRevalidating.value, false);
    wf.destroy();
  });

  test('revalidate is no-op after destroy', async () => {
    let fetchCount = 0;
    const mocks = makeMocks();
    const wf = useNetworkSearchWorkflow({
      ...mocks,
      fetchResponses: async () => { fetchCount += 1; return []; },
      fetchSearchState: async () => { fetchCount += 1; return { state: 'completed' }; },
      pollIntervalMs: 0,
    });

    wf.networkQuery.value = 'Test';
    await wf.runNetworkSearch();
    assert.ok(fetchCount > 0);
    const countBefore = fetchCount;

    wf.destroy();
    await wf.revalidate();
    assert.equal(fetchCount, countBefore, 'no fetch after destroy');
  });

  test('destroy stops polling', async () => {
    let fetchCount = 0;
    const wf = useNetworkSearchWorkflow({
      fetchResponses: async () => { fetchCount += 1; return []; },
      fetchSearchState: async () => ({ state: 'inprogress' }),
      startSearch: async () => ({ searchId: 'search-1' }),
      pollIntervalMs: 50,
    });

    wf.networkQuery.value = 'Test';
    const searchPromise = wf.runNetworkSearch();
    await new Promise((r) => { setTimeout(r, 30); });
    wf.destroy();
    await searchPromise.catch(() => {});

    const countAtDestroy = fetchCount;
    await new Promise((r) => { setTimeout(r, 120); });
    assert.equal(fetchCount, countAtDestroy, 'no additional fetches after destroy');
  });

  test('runNetworkSearch is no-op after destroy', async () => {
    let startCount = 0;
    const wf = useNetworkSearchWorkflow({
      startSearch: async () => { startCount += 1; return { searchId: 's1' }; },
      fetchResponses: async () => [],
      fetchSearchState: async () => ({ state: 'completed', isComplete: true }),
      pollIntervalMs: 0,
    });

    wf.networkQuery.value = 'First';
    await wf.runNetworkSearch();
    assert.equal(startCount, 1);

    wf.destroy();
    wf.networkQuery.value = 'Second';
    await wf.runNetworkSearch();
    assert.equal(startCount, 1, 'no new search after destroy');
  });

  test('attachVisibilityListener triggers revalidate on visibility change', async () => {
    const listeners = stubDocument();
    let fetchCount = 0;
    const wf = useNetworkSearchWorkflow({
      fetchResponses: async () => { fetchCount += 1; return []; },
      fetchSearchState: async () => { fetchCount += 1; return { state: 'completed', isComplete: true }; },
      startSearch: async () => ({ searchId: 's1' }),
      pollIntervalMs: 0,
    });

    wf.networkQuery.value = 'Test';
    await wf.runNetworkSearch();
    const countBefore = fetchCount;

    wf.attachVisibilityListener();
    assert.equal(listeners.get('visibilitychange').length, 1, 'visibility handler registered');

    globalThis.document._vis = 'visible';
    await listeners.get('visibilitychange')[0]();
    assert.equal(fetchCount, countBefore + 2, 'revalidate called on visibility change');

    wf.destroy();
    assert.equal(listeners.get('visibilitychange').length, 0, 'listener removed on destroy');

    restoreDocument();
  });

  test('pollIntervalMs=0 does not schedule polling for incomplete search', async () => {
    let pollCount = 0;
    const wf = useNetworkSearchWorkflow({
      fetchResponses: async () => { pollCount += 1; return []; },
      fetchSearchState: async () => ({ state: 'inprogress' }),
      startSearch: async () => ({ searchId: 'search-1' }),
      pollIntervalMs: 0,
    });

    wf.networkQuery.value = 'Test';
    await wf.runNetworkSearch();

    assert.equal(pollCount, 1, 'only initial fetch, no scheduled polls');
    assert.equal(wf.isNetworkSearching.value, true, 'still searching (no completion detected)');
    wf.destroy();
  });

  test('runNetworkSearch is no-op when query is empty', async () => {
    let startCount = 0;
    const wf = useNetworkSearchWorkflow({
      startSearch: async () => { startCount += 1; return { searchId: 's1' }; },
      pollIntervalMs: 0,
    });

    await wf.runNetworkSearch();
    assert.equal(startCount, 0);
    wf.destroy();
  });

  test('runNetworkSearch is no-op when already searching', async () => {
    let startCount = 0;
    const wf = useNetworkSearchWorkflow({
      startSearch: async () => {
        startCount += 1;
        return { searchId: `s${startCount}` };
      },
      fetchResponses: async () => [],
      fetchSearchState: async () => ({ state: 'inprogress' }),
      pollIntervalMs: 100,
    });

    wf.networkQuery.value = 'First';
    const p1 = wf.runNetworkSearch();
    assert.equal(wf.isNetworkSearching.value, true);

    wf.networkQuery.value = 'Second';
    await wf.runNetworkSearch();
    assert.equal(startCount, 1, 'second call skipped while searching');

    wf.destroy();
    await p1.catch(() => {});
  });

  test('computed properties return defaults before search', () => {
    const wf = useNetworkSearchWorkflow({ pollIntervalMs: 0 });
    assert.equal(wf.sortedResponses.value.length, 0);
    assert.equal(wf.totalFiles.value, 0);
    assert.equal(wf.totalResultBytes.value, 0);
    wf.destroy();
  });
});
