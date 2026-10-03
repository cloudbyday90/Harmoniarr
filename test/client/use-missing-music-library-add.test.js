import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, h, ref } from 'vue';
import { useMissingMusicLibraryAdd } from '../../src/client/composables/useMissingMusicLibraryAdd.js';
import { useMissingMusicLibraryAddRecheck } from '../../src/client/composables/useMissingMusicLibraryAddRecheck.js';
import { useMissingMusicFindMatches } from '../../src/client/composables/useMissingMusicFindMatches.js';
import { useMissingMusicSearchAgain } from '../../src/client/composables/useMissingMusicSearchAgain.js';
import { useMissingMusicQualityFallback } from '../../src/client/composables/useMissingMusicQualityFallback.js';
import { useMissingMusicMatchSelection } from '../../src/client/composables/useMissingMusicMatchSelection.js';
import { useMissingMusicDownloadStart } from '../../src/client/composables/useMissingMusicDownloadStart.js';
import { createMissingMusicReleaseMutationGate } from '../../src/client/lib/missing-music-release-mutation-gate.js';
import { createRetryIdempotencyKeyStore } from '../../src/client/lib/retry-idempotency-key-store.js';

function mountCommands(options = {}) {
  const renderer = createRenderer({ createComment: () => ({}), createElement: () => ({}), createText: () => ({}), insert() {},
    nextSibling: () => null, parentNode: () => null, patchProp() {}, remove() {}, setElementText() {}, setText() {} });
  let commands;
  const app = renderer.createApp({ setup() {
    const shared = { mutationGate: createMissingMusicReleaseMutationGate(), retryIntentState: {}, ...options };
    commands = { add: useMissingMusicLibraryAdd(shared), recheck: useMissingMusicLibraryAddRecheck(shared),
      find: useMissingMusicFindMatches(shared), search: useMissingMusicSearchAgain(shared), quality: useMissingMusicQualityFallback(shared),
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
  if (action === 'recheck') return commands.recheck.recheckLibraryAdd(input);
  if (action === 'find') return commands.find.findMatches(input);
  if (action === 'search') return commands.search.searchAgain(input);
  if (action === 'quality') return commands.quality.allowFallbackQuality(input);
  if (action === 'select') return commands.select.selectMatch({ ...input, matchId: 'match-a' });
  return commands.download.startDownload(input);
}

test('prepared add and every other inspector command exclude each other for the same decision', async (t) => {
  const pending = deferred();
  const calls = [];
  const commands = mountCommands({ addMissingMusicDecisionToLibrary: async (payload) => { calls.push(payload); return pending.promise; } });
  t.after(() => commands.app.unmount());
  const result = commands.add.addToLibrary({ decisionId: 'wanted-amber' });
  assert.equal(await commands.add.addToLibrary({ decisionId: 'wanted-amber' }), null);
  for (const action of ['recheck', 'find', 'search', 'quality', 'select', 'download']) assert.equal(await runCommand(commands, action), null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].idempotencyKey, /^missing-music-decisions-add-to-library-/u);
  pending.resolve({ action: { outcome: 'queued' } });
  await result;
  for (const action of ['recheck', 'find', 'search', 'quality', 'select', 'download']) {
    const competing = deferred();
    let addCalls = 0;
    const other = mountCommands({ addMissingMusicDecisionToLibrary: async () => { addCalls += 1; return {}; },
      recheckMissingMusicDecisionLibraryAdd: () => competing.promise, findMissingMusicDecisionMatches: () => competing.promise,
      searchMissingMusicDecisionAgain: () => competing.promise, allowMissingMusicDecisionFallbackQuality: () => competing.promise,
      selectMissingMusicDecisionMatch: () => competing.promise, startMissingMusicDecisionDownload: () => competing.promise });
    t.after(() => other.app.unmount());
    const running = runCommand(other, action);
    assert.equal(await other.add.addToLibrary({ decisionId: 'wanted-amber' }), null);
    assert.equal(addCalls, 0);
    competing.resolve({});
    await running;
    assert.notEqual(await other.add.addToLibrary({ decisionId: 'wanted-amber' }), null);
  }
});

test('prepared add retains uncertain retries and clears identity on another command or a definitive rejection', async (t) => {
  for (const error of [new Error('Private network'), Object.assign(new Error('/private/download'), { status: 500 }),
    Object.assign(new Error('Private reservation'), { status: 409, code: 'idempotency_key_in_progress' })]) {
    let nextKey = 0;
    const keys = [];
    const commands = mountCommands({ retryIdempotencyKeyStore: createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `add-${++nextKey}` }),
      addMissingMusicDecisionToLibrary: async ({ idempotencyKey }) => { keys.push(idempotencyKey); throw error; },
      findMissingMusicDecisionMatches: async () => ({}) });
    t.after(() => commands.app.unmount());
    await commands.add.addToLibrary({ decisionId: 'wanted-amber' });
    await commands.add.addToLibrary({ decisionId: 'wanted-amber' });
    assert.equal(keys[0], keys[1]);
    assert.doesNotMatch(commands.add.errorMessage.value, /Private|private\/download/u);
    await commands.find.findMatches({ decisionId: 'wanted-amber' });
    await commands.add.addToLibrary({ decisionId: 'wanted-amber' });
    assert.notEqual(keys[1], keys[2]);
  }
  const keys = [];
  const commands = mountCommands({ addMissingMusicDecisionToLibrary: async ({ idempotencyKey }) => {
    keys.push(idempotencyKey); throw Object.assign(new Error('Private authority'), { status: 403 });
  } });
  t.after(() => commands.app.unmount());
  await commands.add.addToLibrary({ decisionId: 'wanted-amber' });
  await commands.add.addToLibrary({ decisionId: 'wanted-amber' });
  assert.notEqual(keys[0], keys[1]);
  assert.equal(commands.add.errorMessage.value, 'You cannot change this release. Refresh its status before trying again.');
});

test('prepared add reports bounded outcomes and suppresses late route or disposed feedback', async (t) => {
  for (const [outcome, tone] of [['queued', 'success'], ['already_queued', 'info'], ['still_needs_review', 'warning'], ['not_available', 'warning'], ['deferred', 'warning']]) {
    const commands = mountCommands({ addMissingMusicDecisionToLibrary: async () => ({ action: { outcome, message: '/private/download' } }) });
    t.after(() => commands.app.unmount());
    await commands.add.addToLibrary({ decisionId: 'wanted-amber' });
    assert.equal(commands.add.statusTone.value, tone);
    assert.doesNotMatch(commands.add.statusMessage.value, /private\/download/u);
  }
  for (const finish of ['resolve', 'reject', 'unmount']) {
    const decisionId = ref('wanted-amber');
    const pending = deferred();
    const commands = mountCommands({ decisionId, addMissingMusicDecisionToLibrary: () => pending.promise });
    const result = commands.add.addToLibrary({ decisionId: 'wanted-amber' });
    if (finish === 'unmount') commands.app.unmount();
    else decisionId.value = 'wanted-other';
    const status = commands.add.statusMessage.value;
    if (finish === 'reject') pending.reject(new Error('Private stale failure'));
    else pending.resolve({ action: { outcome: 'queued' } });
    assert.equal(await result, null);
    assert.equal(commands.add.statusMessage.value, status);
    assert.equal(commands.add.errorMessage.value, '');
    assert.equal(commands.add.statusTone.value, 'info');
    if (finish !== 'unmount') commands.app.unmount();
  }
});
