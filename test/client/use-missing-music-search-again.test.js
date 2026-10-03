/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, h, ref } from 'vue';
import { useMissingMusicSearchAgain } from '../../src/client/composables/useMissingMusicSearchAgain.js';
import { useMissingMusicMatchSelection } from '../../src/client/composables/useMissingMusicMatchSelection.js';
import { useMissingMusicDownloadStart } from '../../src/client/composables/useMissingMusicDownloadStart.js';
import { createMissingMusicReleaseMutationGate } from '../../src/client/lib/missing-music-release-mutation-gate.js';
import { createRetryIdempotencyKeyStore } from '../../src/client/lib/retry-idempotency-key-store.js';

function mountCommands(options = {}) {
  const renderer = createRenderer({
    createComment: () => ({}), createElement: () => ({}), createText: () => ({}),
    insert() {}, nextSibling: () => null, parentNode: () => null,
    patchProp() {}, remove() {}, setElementText() {}, setText() {},
  });
  let commands;
  const app = renderer.createApp({ setup() {
    const shared = { mutationGate: createMissingMusicReleaseMutationGate(), retryIntentState: {}, ...options };
    commands = {
      search: useMissingMusicSearchAgain(shared),
      select: useMissingMusicMatchSelection(shared),
      download: useMissingMusicDownloadStart(shared),
    };
    return () => h('div');
  } });
  app.mount({});
  return { app, ...commands };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('Search again submits one scoped command and reports preparation using saved automation', async (t) => {
  const calls = [];
  const pending = deferred();
  const { app, search, select, download } = mountCommands({
    searchMissingMusicDecisionAgain: async (payload) => { calls.push(payload); return pending.promise; },
    selectMissingMusicDecisionMatch: async () => { throw new Error('Competing selection reached the API'); },
    startMissingMusicDecisionDownload: async () => { throw new Error('Competing download reached the API'); },
  });
  t.after(() => app.unmount());
  const result = search.searchAgain({ decisionId: 'wanted-amber' });
  assert.equal(search.isPending.value, true);
  assert.equal(await search.searchAgain({ decisionId: 'wanted-amber' }), null);
  assert.equal(await select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-1' }), null);
  assert.equal(await download.startDownload({ decisionId: 'wanted-amber' }), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].decisionId, 'wanted-amber');
  assert.match(calls[0].idempotencyKey, /.+/u);
  pending.resolve({ action: { searchPreparationStarted: true } });
  assert.deepEqual(await result, { action: { searchPreparationStarted: true } });
  assert.equal(search.isPending.value, false);
  assert.equal(search.statusMessage.value, 'A new search is queued. Acquisition will follow the saved automation policy.');
});

test('select and download also exclude competing Search again commands through the shared gate', async (t) => {
  for (const action of ['select', 'download']) {
    const pending = deferred();
    let searches = 0;
    const { app, search, select, download } = mountCommands({
      selectMissingMusicDecisionMatch: () => pending.promise,
      startMissingMusicDecisionDownload: () => pending.promise,
      searchMissingMusicDecisionAgain: async () => { searches += 1; return {}; },
    });
    t.after(() => app.unmount());
    const result = action === 'select'
      ? select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-1' })
      : download.startDownload({ decisionId: 'wanted-amber' });
    assert.equal(await search.searchAgain({ decisionId: 'wanted-amber' }), null);
    assert.equal(searches, 0);
    pending.resolve({});
    await result;
    assert.notEqual(await search.searchAgain({ decisionId: 'wanted-amber' }), null);
  }
});

test('uncertain network, server, and reserved retries retain the same idempotency key without exposing raw errors', async (t) => {
  for (const failure of [new Error('private peer /mnt/downloads'),
    Object.assign(new Error('private database error'), { status: 500 }),
    Object.assign(new Error('private reservation'), { status: 409, code: 'idempotency_key_in_progress' })]) {
    let nextKey = 0;
    const keys = [];
    let fail = true;
    const { app, search } = mountCommands({
      retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `retry-${++nextKey}` }),
      searchMissingMusicDecisionAgain: async ({ idempotencyKey }) => {
        keys.push(idempotencyKey);
        if (fail) { fail = false; throw failure; }
        return { action: { restartAlreadyQueued: true } };
      },
    });
    t.after(() => app.unmount());
    assert.equal(await search.searchAgain({ decisionId: 'wanted-amber' }), null);
    assert.doesNotMatch(search.errorMessage.value, /private|\/mnt/u);
    await search.searchAgain({ decisionId: 'wanted-amber' });
    assert.equal(keys[0], keys[1]);
    assert.equal(search.statusMessage.value, 'A new search is already queued for this release.');
    await search.searchAgain({ decisionId: 'wanted-amber' });
    assert.notEqual(keys[1], keys[2], 'A confirmed result clears the retry key');
  }
});

test('definitive permission rejection clears the key and gives fixed public guidance', async (t) => {
  let nextKey = 0;
  const keys = [];
  const { app, search } = mountCommands({
    retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `retry-${++nextKey}` }),
    searchMissingMusicDecisionAgain: async ({ idempotencyKey }) => {
      keys.push(idempotencyKey);
      throw Object.assign(new Error('private disabled identity'), { status: 403 });
    },
  });
  t.after(() => app.unmount());
  await search.searchAgain({ decisionId: 'wanted-amber' });
  await search.searchAgain({ decisionId: 'wanted-amber' });
  assert.notEqual(keys[0], keys[1]);
  assert.equal(search.errorMessage.value, 'You cannot change this release. Refresh its status before trying again.');
});

test('navigation and unmount suppress late command results and feedback', async () => {
  for (const finish of ['resolve', 'reject']) {
    const decisionId = ref('wanted-amber');
    const pending = deferred();
    const { app, search } = mountCommands({ decisionId, searchMissingMusicDecisionAgain: () => pending.promise });
    const result = search.searchAgain({ decisionId: 'wanted-amber' });
    decisionId.value = 'wanted-tri-repetae';
    if (finish === 'resolve') pending.resolve({ action: { searchPreparationStarted: true } });
    else pending.reject(new Error('private stale failure'));
    assert.equal(await result, null);
    assert.equal(search.errorMessage.value, '');
    assert.equal(search.statusMessage.value, '');
    app.unmount();
  }
  const pending = deferred();
  const { app, search } = mountCommands({ searchMissingMusicDecisionAgain: () => pending.promise });
  const result = search.searchAgain({ decisionId: 'wanted-amber' });
  app.unmount();
  const previousStatus = search.statusMessage.value;
  pending.resolve({});
  assert.equal(await result, null);
  assert.equal(search.statusMessage.value, previousStatus);
});

test('shared dispatch success does not claim this release is already being searched', async (t) => {
  const { app, search } = mountCommands({ searchMissingMusicDecisionAgain: async () => ({ action: { dispatchAlreadyActive: true } }) });
  t.after(() => app.unmount());
  await search.searchAgain({ decisionId: 'wanted-amber' });
  assert.equal(search.statusMessage.value, 'Search work is already running. This release is queued for evaluation.');
});

test('changing match intent clears an uncertain old key before returning to that match', async (t) => {
  const calls = [];
  let nextKey = 0;
  const { app, select } = mountCommands({
    retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `retry-${++nextKey}` }),
    selectMissingMusicDecisionMatch: async (payload) => {
      calls.push(payload);
      if (calls.length === 1) throw new Error('Response lost after selection');
      return {};
    },
  });
  t.after(() => app.unmount());
  await select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-a' });
  await select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-b' });
  await select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-a' });
  assert.notEqual(calls[0].idempotencyKey, calls[2].idempotencyKey);
});

test('changing command intent also resets an uncertain key shared by inspector actions', async (t) => {
  const searchKeys = [];
  let nextKey = 0;
  const { app, search, select } = mountCommands({
    retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `retry-${++nextKey}` }),
    searchMissingMusicDecisionAgain: async ({ idempotencyKey }) => { searchKeys.push(idempotencyKey); throw new Error('Response lost'); },
    selectMissingMusicDecisionMatch: async () => ({}),
  });
  t.after(() => app.unmount());
  await search.searchAgain({ decisionId: 'wanted-amber' });
  await select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-a' });
  await search.searchAgain({ decisionId: 'wanted-amber' });
  assert.notEqual(searchKeys[0], searchKeys[1]);
});
