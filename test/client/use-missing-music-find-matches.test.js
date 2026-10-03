/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, h, ref } from 'vue';
import { useMissingMusicFindMatches } from '../../src/client/composables/useMissingMusicFindMatches.js';
import { useMissingMusicSearchAgain } from '../../src/client/composables/useMissingMusicSearchAgain.js';
import { useMissingMusicQualityFallback } from '../../src/client/composables/useMissingMusicQualityFallback.js';
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
      find: useMissingMusicFindMatches(shared), search: useMissingMusicSearchAgain(shared),
      quality: useMissingMusicQualityFallback(shared), select: useMissingMusicMatchSelection(shared),
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

function runCompeting(commands, action) {
  return action === 'search' ? commands.search.searchAgain({ decisionId: 'wanted-amber' })
    : action === 'quality' ? commands.quality.allowFallbackQuality({ decisionId: 'wanted-amber' })
      : action === 'select' ? commands.select.selectMatch({ decisionId: 'wanted-amber', matchId: 'match-a' })
        : commands.download.startDownload({ decisionId: 'wanted-amber' });
}

test('Find matches joins existing ready work and excludes all other commands for this decision', async (t) => {
  const pending = deferred();
  const calls = [];
  const commands = mountCommands({ findMissingMusicDecisionMatches: async (payload) => { calls.push(payload); return pending.promise; } });
  t.after(() => commands.app.unmount());
  const result = commands.find.findMatches({ decisionId: 'wanted-amber' });
  assert.equal(commands.find.statusMessage.value, 'Requesting matches…');
  assert.equal(await commands.find.findMatches({ decisionId: 'wanted-amber' }), null);
  for (const action of ['search', 'quality', 'select', 'download']) assert.equal(await runCompeting(commands, action), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].decisionId, 'wanted-amber');
  assert.match(calls[0].idempotencyKey, /^missing-music-decisions-find-matches-/u);
  pending.resolve({ action: { searchPreparationStarted: true, searchAlreadyQueued: true } });
  await result;
  assert.equal(commands.find.statusMessage.value, 'Find matches requested for this recipient. This release is queued using saved automation.');
});

test('each competing command excludes Find matches until the decision gate releases', async (t) => {
  for (const action of ['search', 'quality', 'select', 'download']) {
    const pending = deferred();
    let calls = 0;
    const commands = mountCommands({
      findMissingMusicDecisionMatches: async () => { calls += 1; return {}; },
      searchMissingMusicDecisionAgain: () => pending.promise,
      allowMissingMusicDecisionFallbackQuality: () => pending.promise,
      selectMissingMusicDecisionMatch: () => pending.promise,
      startMissingMusicDecisionDownload: () => pending.promise,
    });
    t.after(() => commands.app.unmount());
    const result = runCompeting(commands, action);
    assert.equal(await commands.find.findMatches({ decisionId: 'wanted-amber' }), null);
    assert.equal(calls, 0);
    pending.resolve({});
    await result;
    assert.notEqual(await commands.find.findMatches({ decisionId: 'wanted-amber' }), null);
  }
});

test('Find matches describes first intent, shared dispatch, and historical no-op without promising a new search', async (t) => {
  for (const [action, expected] of [
    [{ searchPreparationStarted: true, searchAlreadyQueued: true, dispatchAlreadyActive: true }, 'Find matches requested for this recipient. Search work is already running; this release is queued for evaluation.'],
    [{ searchPreparationStarted: false, intentAlreadyRecorded: true, searchAlreadyQueued: true }, 'Find matches was already requested for this recipient. This release is queued using saved automation.'],
    [{ searchPreparationStarted: false, intentAlreadyRecorded: true, searchAlreadyQueued: false, dispatchAlreadyActive: true }, 'Find matches was already requested for this recipient. Check the current release status.'],
    [{ searchPreparationStarted: false }, 'The search request was accepted. Check the current release status.'],
  ]) {
    const commands = mountCommands({ findMissingMusicDecisionMatches: async () => ({ action }) });
    t.after(() => commands.app.unmount());
    await commands.find.findMatches({ decisionId: 'wanted-amber' });
    assert.equal(commands.find.statusMessage.value, expected);
  }
});

test('uncertain initial-search retries keep the key while changed command intent and confirmed rejection clear it', async (t) => {
  for (const error of [new Error('Private provider /mnt/music'),
    Object.assign(new Error('Private SQL'), { status: 500 }),
    Object.assign(new Error('Private reservation'), { status: 409, code: 'idempotency_key_in_progress' })]) {
    const keys = [];
    let nextKey = 0;
    const commands = mountCommands({
      retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `find-${++nextKey}` }),
      findMissingMusicDecisionMatches: async ({ idempotencyKey }) => { keys.push(idempotencyKey); throw error; },
      searchMissingMusicDecisionAgain: async () => ({}),
    });
    t.after(() => commands.app.unmount());
    await commands.find.findMatches({ decisionId: 'wanted-amber' });
    await commands.find.findMatches({ decisionId: 'wanted-amber' });
    assert.equal(keys[0], keys[1]);
    assert.doesNotMatch(commands.find.errorMessage.value, /Private|\/mnt/u);
    await commands.search.searchAgain({ decisionId: 'wanted-amber' });
    await commands.find.findMatches({ decisionId: 'wanted-amber' });
    assert.notEqual(keys[1], keys[2]);
  }
  const keys = [];
  const commands = mountCommands({ findMissingMusicDecisionMatches: async ({ idempotencyKey }) => {
    keys.push(idempotencyKey); throw Object.assign(new Error('Private target'), { status: 403 });
  } });
  t.after(() => commands.app.unmount());
  await commands.find.findMatches({ decisionId: 'wanted-amber' });
  await commands.find.findMatches({ decisionId: 'wanted-amber' });
  assert.notEqual(keys[0], keys[1]);
  assert.equal(commands.find.errorMessage.value, 'You cannot change this release. Refresh its status before trying again.');
});

test('late Find matches success and failure cannot populate another route or disposed inspector', async () => {
  for (const finish of ['resolve', 'reject', 'unmount']) {
    const decisionId = ref('wanted-amber');
    const pending = deferred();
    const commands = mountCommands({ decisionId, findMissingMusicDecisionMatches: () => pending.promise });
    const result = commands.find.findMatches({ decisionId: 'wanted-amber' });
    if (finish === 'unmount') commands.app.unmount();
    else decisionId.value = 'wanted-tri-repetae';
    const previousStatus = commands.find.statusMessage.value;
    if (finish === 'reject') pending.reject(new Error('Private stale failure'));
    else pending.resolve({ action: { searchPreparationStarted: true } });
    assert.equal(await result, null);
    assert.equal(commands.find.statusMessage.value, previousStatus);
    assert.equal(commands.find.errorMessage.value, '');
    if (finish !== 'unmount') commands.app.unmount();
  }
});
