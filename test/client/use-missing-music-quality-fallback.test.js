/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, h, ref } from 'vue';
import { useMissingMusicQualityFallback } from '../../src/client/composables/useMissingMusicQualityFallback.js';
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
      quality: useMissingMusicQualityFallback(shared), search: useMissingMusicSearchAgain(shared),
      select: useMissingMusicMatchSelection(shared), download: useMissingMusicDownloadStart(shared),
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

test('fallback quality shares a decision gate with search, selection, and download commands', async (t) => {
  const pending = deferred();
  const calls = [];
  const { app, quality, search, select, download } = mountCommands({
    allowMissingMusicDecisionFallbackQuality: async (payload) => { calls.push(payload); return pending.promise; },
    searchMissingMusicDecisionAgain: async () => { throw new Error('Competing search reached the API'); },
    selectMissingMusicDecisionMatch: async () => { throw new Error('Competing selection reached the API'); },
    startMissingMusicDecisionDownload: async () => { throw new Error('Competing download reached the API'); },
  });
  t.after(() => app.unmount());
  const result = quality.allowFallbackQuality({ decisionId: 'wanted-amber' });
  assert.equal(quality.isPending.value, true);
  assert.equal(await quality.allowFallbackQuality({ decisionId: 'wanted-amber' }), null);
  assert.equal(await search.searchAgain({ decisionId: 'wanted-amber' }), null);
  assert.equal(await select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-1' }), null);
  assert.equal(await download.startDownload({ decisionId: 'wanted-amber' }), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].decisionId, 'wanted-amber');
  pending.resolve({ action: { searchPreparationStarted: true } });
  await result;
  assert.equal(quality.statusMessage.value, 'Fallback quality is allowed for this recipient. A new search is queued using saved automation. Other household quality requirements still apply.');
});

test('all competing inspector commands also block fallback while they are pending', async (t) => {
  for (const action of ['search', 'select', 'download']) {
    const pending = deferred();
    let fallbackCalls = 0;
    const commands = mountCommands({
      allowMissingMusicDecisionFallbackQuality: async () => { fallbackCalls += 1; return {}; },
      searchMissingMusicDecisionAgain: () => pending.promise,
      selectMissingMusicDecisionMatch: () => pending.promise,
      startMissingMusicDecisionDownload: () => pending.promise,
    });
    t.after(() => commands.app.unmount());
    const command = action === 'search' ? commands.search.searchAgain({ decisionId: 'wanted-amber' })
      : action === 'select' ? commands.select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-1' })
        : commands.download.startDownload({ decisionId: 'wanted-amber' });
    assert.equal(await commands.quality.allowFallbackQuality({ decisionId: 'wanted-amber' }), null);
    assert.equal(fallbackCalls, 0);
    pending.resolve({});
    await command;
    assert.notEqual(await commands.quality.allowFallbackQuality({ decisionId: 'wanted-amber' }), null);
  }
});

test('uncertain fallback retries preserve identity until intent changes and never expose private errors', async (t) => {
  let nextKey = 0;
  const keys = [];
  const { app, quality, search } = mountCommands({
    retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `quality-${++nextKey}` }),
    allowMissingMusicDecisionFallbackQuality: async ({ idempotencyKey }) => {
      keys.push(idempotencyKey);
      throw Object.assign(new Error('Private database /mnt/music'), { status: 500 });
    },
    searchMissingMusicDecisionAgain: async () => ({}),
  });
  t.after(() => app.unmount());
  await quality.allowFallbackQuality({ decisionId: 'wanted-amber' });
  await quality.allowFallbackQuality({ decisionId: 'wanted-amber' });
  assert.equal(keys[0], keys[1]);
  assert.equal(quality.errorMessage.value, 'The quality choice could not be saved. Refresh this release and try again.');
  await search.searchAgain({ decisionId: 'wanted-amber' });
  await quality.allowFallbackQuality({ decisionId: 'wanted-amber' });
  assert.notEqual(keys[1], keys[2]);
});

test('confirmed consent and shared dispatch are described without promising acquisition or upgrades', async (t) => {
  for (const action of [
    { overrideAlreadyAllowed: true, searchPreparationStarted: false, restartAlreadyQueued: false },
    { overrideAlreadyAllowed: true, searchPreparationStarted: true, restartAlreadyQueued: true },
    { searchPreparationStarted: true, dispatchAlreadyActive: true },
  ]) {
    const { app, quality } = mountCommands({ allowMissingMusicDecisionFallbackQuality: async () => ({ action }) });
    t.after(() => app.unmount());
    await quality.allowFallbackQuality({ decisionId: 'wanted-amber' });
    assert.match(quality.statusMessage.value, /Other household quality requirements still apply/u);
    assert.doesNotMatch(quality.statusMessage.value, /upgrade|download completed|searching this release/iu);
    if (action.overrideAlreadyAllowed) {
      assert.match(quality.statusMessage.value, /already allowed/u);
      assert.doesNotMatch(quality.statusMessage.value, /new search/u);
      if (action.restartAlreadyQueued) assert.match(quality.statusMessage.value, /A search is already queued/u);
      else assert.doesNotMatch(quality.statusMessage.value, /queued/u);
    } else assert.match(quality.statusMessage.value, /Search work is already running\. This release is queued for evaluation/u);
  }
});

test('route changes and disposal suppress late fallback success and failure', async () => {
  for (const completion of ['resolve', 'reject', 'unmount']) {
    const decisionId = ref('wanted-amber');
    const pending = deferred();
    const { app, quality } = mountCommands({ decisionId, allowMissingMusicDecisionFallbackQuality: () => pending.promise });
    const result = quality.allowFallbackQuality({ decisionId: 'wanted-amber' });
    if (completion === 'unmount') app.unmount();
    else decisionId.value = 'wanted-tri-repetae';
    const previousStatus = quality.statusMessage.value;
    if (completion === 'reject') pending.reject(new Error('private stale error'));
    else pending.resolve({ action: { searchPreparationStarted: true } });
    assert.equal(await result, null);
    assert.equal(quality.errorMessage.value, '');
    assert.equal(quality.statusMessage.value, previousStatus);
    if (completion !== 'unmount') app.unmount();
  }
});
