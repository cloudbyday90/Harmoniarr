/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, h, ref } from 'vue';
import { useMissingMusicLibraryAddRecheck } from '../../src/client/composables/useMissingMusicLibraryAddRecheck.js';
import { useMissingMusicFindMatches } from '../../src/client/composables/useMissingMusicFindMatches.js';
import { useMissingMusicSearchAgain } from '../../src/client/composables/useMissingMusicSearchAgain.js';
import { useMissingMusicQualityFallback } from '../../src/client/composables/useMissingMusicQualityFallback.js';
import { useMissingMusicMatchSelection } from '../../src/client/composables/useMissingMusicMatchSelection.js';
import { useMissingMusicDownloadStart } from '../../src/client/composables/useMissingMusicDownloadStart.js';
import { createMissingMusicReleaseMutationGate } from '../../src/client/lib/missing-music-release-mutation-gate.js';
import { createRetryIdempotencyKeyStore } from '../../src/client/lib/retry-idempotency-key-store.js';

function mountCommands(options = {}) {
  const renderer = createRenderer({
    createComment: () => ({}), createElement: () => ({}), createText: () => ({}), insert() {},
    nextSibling: () => null, parentNode: () => null, patchProp() {}, remove() {}, setElementText() {}, setText() {},
  });
  let commands;
  const app = renderer.createApp({ setup() {
    const shared = { mutationGate: createMissingMusicReleaseMutationGate(), retryIntentState: {}, ...options };
    commands = { recheck: useMissingMusicLibraryAddRecheck(shared), find: useMissingMusicFindMatches(shared),
      search: useMissingMusicSearchAgain(shared), quality: useMissingMusicQualityFallback(shared),
      select: useMissingMusicMatchSelection(shared), download: useMissingMusicDownloadStart(shared) };
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

function runCommand(commands, action) {
  const input = { decisionId: 'wanted-amber' };
  if (action === 'find') return commands.find.findMatches(input);
  if (action === 'search') return commands.search.searchAgain(input);
  if (action === 'quality') return commands.quality.allowFallbackQuality(input);
  if (action === 'select') return commands.select.selectMatch({ ...input, matchId: 'match-a' });
  return commands.download.startDownload(input);
}

test('library recheck excludes every competing command for the same decision and uses its own durable scope', async (t) => {
  const pending = deferred();
  const calls = [];
  const commands = mountCommands({ recheckMissingMusicDecisionLibraryAdd: async (payload) => { calls.push(payload); return pending.promise; } });
  t.after(() => commands.app.unmount());
  const result = commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
  assert.equal(commands.recheck.isPending.value, true);
  assert.equal(commands.recheck.statusTone.value, 'info');
  assert.equal(await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' }), null);
  for (const action of ['find', 'search', 'quality', 'select', 'download']) assert.equal(await runCommand(commands, action), null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].idempotencyKey, /^missing-music-decisions-recheck-library-add-/u);
  pending.resolve({ action: { outcome: 'queued' } });
  await result;
  assert.equal(commands.recheck.statusTone.value, 'success');
  assert.match(commands.recheck.statusMessage.value, /only if the plan remains safe/u);
});

test('all other inspector commands exclude a competing library recheck until the shared gate releases', async (t) => {
  for (const action of ['find', 'search', 'quality', 'select', 'download']) {
    const pending = deferred();
    let calls = 0;
    const commands = mountCommands({ recheckMissingMusicDecisionLibraryAdd: async () => { calls += 1; return {}; },
      findMissingMusicDecisionMatches: () => pending.promise, searchMissingMusicDecisionAgain: () => pending.promise,
      allowMissingMusicDecisionFallbackQuality: () => pending.promise, selectMissingMusicDecisionMatch: () => pending.promise,
      startMissingMusicDecisionDownload: () => pending.promise });
    t.after(() => commands.app.unmount());
    const result = runCommand(commands, action);
    assert.equal(await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' }), null);
    assert.equal(calls, 0);
    pending.resolve({});
    await result;
    assert.notEqual(await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' }), null);
  }
});

test('library recheck renders all six bounded outcomes including no-write deferral without exposing private diagnostics', async (t) => {
  for (const [outcome, tone] of [['queued', 'success'], ['already_queued', 'info'], ['deferred', 'warning'], ['prerequisite_not_ready', 'warning'], ['still_needs_review', 'warning'], ['not_available', 'warning']]) {
    const commands = mountCommands({ recheckMissingMusicDecisionLibraryAdd: async () => ({ action: { outcome, message: 'Private candidate /mnt/music', runId: 'protected-run' } }) });
    t.after(() => commands.app.unmount());
    await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
    assert.equal(commands.recheck.statusTone.value, tone);
    assert.doesNotMatch(commands.recheck.statusMessage.value, /Private|\/mnt|protected-run/u);
  }
});

test('uncertain library recheck retries retain identity; another command and confirmed failure reset it', async (t) => {
  for (const error of [new Error('Private provider /mnt/music'), Object.assign(new Error('Private SQL'), { status: 500 }),
    Object.assign(new Error('Private reservation'), { status: 409, code: 'idempotency_key_in_progress' })]) {
    let nextKey = 0;
    const keys = [];
    const commands = mountCommands({ retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `recheck-${++nextKey}` }),
      recheckMissingMusicDecisionLibraryAdd: async ({ idempotencyKey }) => { keys.push(idempotencyKey); throw error; },
      findMissingMusicDecisionMatches: async () => ({}) });
    t.after(() => commands.app.unmount());
    await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
    await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
    assert.equal(keys[0], keys[1]);
    assert.doesNotMatch(commands.recheck.errorMessage.value, /Private|\/mnt/u);
    await commands.find.findMatches({ decisionId: 'wanted-amber' });
    await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
    assert.notEqual(keys[1], keys[2]);
  }
  const keys = [];
  const commands = mountCommands({ recheckMissingMusicDecisionLibraryAdd: async ({ idempotencyKey }) => {
    keys.push(idempotencyKey); throw Object.assign(new Error('Private target'), { status: 403 });
  } });
  t.after(() => commands.app.unmount());
  await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
  await commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
  assert.notEqual(keys[0], keys[1]);
  assert.equal(commands.recheck.errorMessage.value, 'You cannot change this release. Refresh its status before trying again.');
});

test('navigation and disposal suppress late recovery feedback, including its outcome tone', async () => {
  for (const finish of ['resolve', 'reject', 'unmount']) {
    const decisionId = ref('wanted-amber');
    const pending = deferred();
    const commands = mountCommands({ decisionId, recheckMissingMusicDecisionLibraryAdd: () => pending.promise });
    const result = commands.recheck.recheckLibraryAdd({ decisionId: 'wanted-amber' });
    if (finish === 'unmount') commands.app.unmount();
    else decisionId.value = 'wanted-tri-repetae';
    const status = commands.recheck.statusMessage.value;
    if (finish === 'reject') pending.reject(new Error('Private stale failure'));
    else pending.resolve({ action: { outcome: 'queued' } });
    assert.equal(await result, null);
    assert.equal(commands.recheck.statusMessage.value, status);
    assert.equal(commands.recheck.errorMessage.value, '');
    assert.equal(commands.recheck.statusTone.value, 'info');
    if (finish !== 'unmount') commands.app.unmount();
  }
});
