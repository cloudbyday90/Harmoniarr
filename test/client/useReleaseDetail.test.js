/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { useReleaseDetail } from '../../src/client/composables/useReleaseDetail.js';

function makeTracklistResponse(overrides = {}) {
  return {
    release: { id: 'release-1', title: 'Substrata', isCanonical: true },
    media: [{ position: 1, format: 'CD', tracks: [] }],
    ownership: null,
    allReleases: [{ id: 'release-1', title: 'Substrata', isCanonical: true }],
    requestState: null,
    source: 'local',
    ...overrides,
  };
}

test('useReleaseDetail load populates reactive state from fetchTracklist', async (t) => {
  const fetchTracklist = t.mock.fn(async () => makeTracklistResponse());
  const { release, media, allReleases, source, loading, error, load } = useReleaseDetail({ fetchTracklist });

  assert.equal(loading.value, false);
  assert.equal(release.value, null);

  await load('mb-rg-1');

  assert.equal(loading.value, false);
  assert.equal(error.value, null);
  assert.deepEqual(release.value, { id: 'release-1', title: 'Substrata', isCanonical: true });
  assert.equal(media.value.length, 1);
  assert.equal(allReleases.value.length, 1);
  assert.equal(source.value, 'local');
});

test('useReleaseDetail load forwards preferReleaseMbid to fetchTracklist', async (t) => {
  const fetchTracklist = t.mock.fn(async () => makeTracklistResponse());
  const { load } = useReleaseDetail({ fetchTracklist });

  await load('mb-rg-1', { preferReleaseMbid: 'mb-r-2' });

  assert.equal(fetchTracklist.mock.callCount(), 1);
  assert.equal(fetchTracklist.mock.calls[0].arguments[0], 'mb-rg-1');
  assert.equal(fetchTracklist.mock.calls[0].arguments[1].preferReleaseMbid, 'mb-r-2');
});

test('useReleaseDetail load sets error when fetchTracklist rejects', async (t) => {
  const fetchTracklist = t.mock.fn(async () => {
    throw Object.assign(new Error('Failed to load'), { code: 'server_error' });
  });
  const { loading, error, load } = useReleaseDetail({ fetchTracklist });

  await load('mb-rg-1');

  assert.equal(loading.value, false);
  assert.ok(typeof error.value === 'string');
  assert.match(error.value, /Failed to load/);
});

test('useReleaseDetail load is a no-op when called without releaseGroupMbid', async (t) => {
  const fetchTracklist = t.mock.fn(async () => makeTracklistResponse());
  const { load } = useReleaseDetail({ fetchTracklist });

  await load(null);
  await load('');
  await load(undefined);

  assert.equal(fetchTracklist.mock.callCount(), 0);
});

test('useReleaseDetail switchEdition calls load with preferReleaseId', async (t) => {
  const fetchTracklist = t.mock.fn(async () => makeTracklistResponse());
  const { switchEdition } = useReleaseDetail({ fetchTracklist });

  await switchEdition('mb-rg-1', 'release-2');

  assert.equal(fetchTracklist.mock.callCount(), 1);
  assert.equal(fetchTracklist.mock.calls[0].arguments[1].preferReleaseId, 'release-2');
});

test('useReleaseDetail setDefaultEdition calls setCanonical then reloads', async (t) => {
  const fetchTracklist = t.mock.fn(async () => makeTracklistResponse());
  const setCanonical = t.mock.fn(async () => ({ ok: true, releaseId: 'release-2', releaseGroupId: 'rg-1' }));
  const { isSavingCanonical, canonicalError, setDefaultEdition } = useReleaseDetail({ fetchTracklist, setCanonical });

  await setDefaultEdition('mb-rg-1', 'release-2');

  assert.equal(isSavingCanonical.value, false);
  assert.equal(canonicalError.value, null);
  assert.equal(setCanonical.mock.callCount(), 1);
  assert.equal(setCanonical.mock.calls[0].arguments[0], 'release-2');
  assert.equal(fetchTracklist.mock.callCount(), 1);
  assert.equal(fetchTracklist.mock.calls[0].arguments[1].preferReleaseId, 'release-2');
});

test('useReleaseDetail setDefaultEdition is a no-op when releaseId is falsy', async (t) => {
  const fetchTracklist = t.mock.fn(async () => makeTracklistResponse());
  const setCanonical = t.mock.fn(async () => {});
  const { setDefaultEdition } = useReleaseDetail({ fetchTracklist, setCanonical });

  await setDefaultEdition('mb-rg-1', null);
  await setDefaultEdition('mb-rg-1', '');

  assert.equal(setCanonical.mock.callCount(), 0);
  assert.equal(fetchTracklist.mock.callCount(), 0);
});

test('useReleaseDetail setDefaultEdition sets canonicalError when setCanonical rejects', async (t) => {
  const fetchTracklist = t.mock.fn(async () => makeTracklistResponse());
  const setCanonical = t.mock.fn(async () => {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  });
  const { canonicalError, isSavingCanonical, setDefaultEdition } = useReleaseDetail({ fetchTracklist, setCanonical });

  await setDefaultEdition('mb-rg-1', 'release-2');

  assert.equal(isSavingCanonical.value, false);
  assert.ok(typeof canonicalError.value === 'string');
  assert.match(canonicalError.value, /Forbidden/);
});

test('useReleaseDetail load aborts in-flight request when called again', async (t) => {
  let capturedSignal = null;
  const fetchTracklist = t.mock.fn(async (_mbid, options) => {
    capturedSignal = options?.signal;
    // Simulate a slow request that resolves after the abort check
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    if (capturedSignal?.aborted) {
      const err = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }
    return makeTracklistResponse();
  });

  const { load } = useReleaseDetail({ fetchTracklist });

  // Fire two loads concurrently — second aborts the first
  const first = load('mb-rg-1');
  const second = load('mb-rg-2');

  await Promise.allSettled([first, second]);

  assert.equal(fetchTracklist.mock.callCount(), 2);
  // The first signal should have been aborted
  assert.equal(capturedSignal?.aborted, false); // last signal (from second call) is not aborted
});

function deferred() {
  const result = {};
  result.promise = new Promise((resolve, reject) => { Object.assign(result, { resolve, reject }); });
  return result;
}

for (const outcome of ['resolve', 'reject']) {
  test(`release detail ignores stale ${outcome} and its finalizer while newer load is pending`, async () => {
    const old = deferred();
    const current = deferred();
    const signals = [];
    const detail = useReleaseDetail({ fetchTracklist: (_group, { signal }) => {
      signals.push(signal);
      return signals.length === 1 ? old.promise : current.promise;
    } });
    const first = detail.load('old');
    const second = detail.load('current');
    assert.equal(signals[0].aborted, true);
    old[outcome](outcome === 'resolve' ? makeTracklistResponse() : new Error('stale failure'));
    await first;
    assert.equal(detail.loading.value, true);
    assert.equal(detail.error.value, null);
    assert.equal(detail.release.value, null);
    current.resolve(makeTracklistResponse({ release: { id: 'current' } }));
    await second;
    assert.equal(detail.release.value.id, 'current');
  });
}

test('closing and reopening ignores an abort-ignoring old response and invalid identifiers clear data', async () => {
  const old = deferred();
  let calls = 0;
  const detail = useReleaseDetail({ fetchTracklist: () => ++calls === 1 ? old.promise : Promise.resolve(makeTracklistResponse()) });
  const first = detail.load('old');
  detail.cancel();
  assert.equal(detail.loading.value, false);
  await detail.load('new');
  old.resolve(makeTracklistResponse({ release: { id: 'stale' } }));
  await first;
  assert.equal(detail.release.value.id, 'release-1');
  await detail.load('');
  assert.equal(detail.release.value, null);
  assert.deepEqual(detail.media.value, []);
  assert.deepEqual(detail.allReleases.value, []);
  assert.equal(detail.source.value, null);
});

for (const transition of ['close', 'edition']) {
  for (const outcome of ['resolve', 'reject']) {
    test(`canonical ${outcome} after ${transition} cannot reload or change current state`, async () => {
      const mutation = deferred();
      const reads = [];
      const detail = useReleaseDetail({
        fetchTracklist: async (group) => { reads.push(group); return makeTracklistResponse({ release: { id: group } }); },
        setCanonical: () => mutation.promise,
      });
      await detail.load('old');
      const saving = detail.setDefaultEdition('old', 'release-old');
      if (transition === 'close') detail.cancel();
      else await detail.switchEdition('new', 'release-new');
      mutation[outcome](outcome === 'resolve' ? {} : new Error('stale canonical failure'));
      await saving;
      assert.deepEqual(reads, transition === 'close' ? ['old'] : ['old', 'new']);
      assert.equal(detail.canonicalError.value, null);
      assert.equal(detail.isSavingCanonical.value, false);
      assert.equal(detail.release.value?.id ?? null, transition === 'close' ? null : 'new');
    });
  }
}


test('retry replays the exact failed edition read, blocks concurrent clicks and clears after success', async () => {
  const pending = deferred();
  const calls = [];
  const detail = useReleaseDetail({ fetchTracklist: async (group, options) => {
    calls.push({ group, ...options });
    if (calls.length === 1) throw new Error('Unavailable');
    return pending.promise;
  } });
  await detail.load('group', { preferReleaseMbid: 'mbid-edition', preferReleaseId: 'local-edition' });
  assert.equal(detail.canRetry.value, true);
  const retrying = detail.retry();
  assert.equal(detail.canRetry.value, false);
  assert.equal(detail.retry(), undefined);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(({ group, preferReleaseMbid, preferReleaseId }) => ({ group, preferReleaseMbid, preferReleaseId })), [
    { group: 'group', preferReleaseMbid: 'mbid-edition', preferReleaseId: 'local-edition' },
    { group: 'group', preferReleaseMbid: 'mbid-edition', preferReleaseId: 'local-edition' },
  ]);
  assert.notEqual(calls[0].signal, calls[1].signal);
  pending.resolve(makeTracklistResponse());
  await retrying;
  assert.equal(detail.canRetry.value, false);
  assert.equal(detail.retry(), undefined);
});

test('repeated read failures remain retryable until cancel invalidates the target', async () => {
  let calls = 0;
  const detail = useReleaseDetail({ fetchTracklist: async () => { calls += 1; throw new Error('Unavailable'); } });
  await detail.load('group');
  await detail.retry();
  assert.equal(calls, 2);
  assert.equal(detail.canRetry.value, true);
  detail.cancel();
  assert.equal(detail.canRetry.value, false);
  assert.equal(detail.retry(), undefined);
  assert.equal(calls, 2);
});

test('stale failure cannot replace the current retry target after a new group opens', async () => {
  const old = deferred();
  const calls = [];
  const detail = useReleaseDetail({ fetchTracklist: async (group, options) => {
    calls.push({ group, preferReleaseId: options.preferReleaseId });
    if (group === 'old') return old.promise;
    throw new Error('Current unavailable');
  } });
  const obsolete = detail.load('old', { preferReleaseId: 'old-edition' });
  await detail.load('current', { preferReleaseId: 'current-edition' });
  old.reject(new Error('Old unavailable'));
  await obsolete;
  await detail.retry();
  assert.deepEqual(calls.at(-1), { group: 'current', preferReleaseId: 'current-edition' });
});

test('retry after a successful canonical mutation only repeats its failed read, never the write', async () => {
  let mutations = 0;
  const reads = [];
  const detail = useReleaseDetail({
    setCanonical: async () => { mutations += 1; },
    fetchTracklist: async (group, options) => {
      reads.push({ group, preferReleaseId: options.preferReleaseId });
      if (reads.length === 1) throw new Error('Read failed after save');
      return makeTracklistResponse();
    },
  });
  await detail.setDefaultEdition('group', 'canonical-edition');
  assert.equal(detail.canRetry.value, true);
  await detail.retry();
  assert.equal(mutations, 1);
  assert.deepEqual(reads, [
    { group: 'group', preferReleaseId: 'canonical-edition' },
    { group: 'group', preferReleaseId: 'canonical-edition' },
  ]);
});


for (const message of ['', '   ']) {
  test(`blank read error ${JSON.stringify(message)} retains visible failure and retry`, async () => {
    let calls = 0;
    const detail = useReleaseDetail({ fetchTracklist: async () => {
      calls += 1;
      if (calls === 1) throw new Error(message);
      return makeTracklistResponse();
    } });
    await detail.load('group');
    assert.equal(detail.error.value, 'Could not load release details.');
    assert.equal(detail.canRetry.value, true);
    await detail.retry();
    assert.equal(calls, 2);
    assert.equal(detail.error.value, null);
  });
}
