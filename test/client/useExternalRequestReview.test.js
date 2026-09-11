/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { useExternalRequestReview } from '../../src/client/composables/useExternalRequestReview.js';

const album = { id: 'p1', title: 'Album', artistName: 'Artist', reviewable: true };
const edition = { id: 'm1', title: 'Album', artistName: 'Artist' };
function review(overrides = {}) {
  return { items: [album], intents: [], preparation: { canRecover: false, action: null }, ...overrides };
}
function createState(overrides = {}) {
  return useExternalRequestReview({
    fetchReviewFn: async () => review(),
    searchReleasesFn: async () => ({ releases: [edition] }),
    approveReleaseFn: async () => ({ accepted: true }),
    recoverPreparationFn: async () => ({ accepted: true }),
    ...overrides,
  });
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
async function selectEdition(state) {
  await state.load({ mediaRequestId: 'r1' });
  await state.search('p1');
  state.drafts.value.p1.selectedReleaseId = 'm1';
}

test('prepared albums seed editable search text but never preselect an edition', async () => {
  const state = createState();
  await state.load({ mediaRequestId: 'r1' });
  assert.equal(state.drafts.value.p1.artistName, 'Artist');
  await state.search('p1');
  assert.equal(state.drafts.value.p1.selectedReleaseId, '');
  assert.equal(state.drafts.value.p1.statusMessage, '1 local release found.');
});

test('approval requires a reviewable item and an explicit edition in current results', async () => {
  const calls = [];
  const state = createState({ approveReleaseFn: async (...args) => calls.push(args) });
  await state.load({ mediaRequestId: 'r1' });
  assert.equal(await state.approve('p1'), null);
  state.drafts.value.p1.selectedReleaseId = 'unlisted-edition';
  assert.equal(await state.approve('p1'), null);
  assert.equal(calls.length, 0);
});

test('local catalog search requires both artist and release text', async () => {
  let searches = 0;
  const state = createState({ searchReleasesFn: async () => { searches += 1; return { releases: [] }; } });
  await state.load({ mediaRequestId: 'r1' });
  state.drafts.value.p1.artistName = ' ';
  await state.search('p1');
  state.drafts.value.p1.artistName = 'Artist';
  state.drafts.value.p1.releaseTitle = '';
  await state.search('p1');
  assert.equal(searches, 0);
});

test('approval refreshes accepted state and reports queued search without claiming import', async () => {
  let accepted = false;
  const calls = [];
  const state = createState({
    fetchReviewFn: async () => review({ intents: accepted ? [{ id: 'i1' }] : [] }),
    approveReleaseFn: async (payload) => { calls.push(payload); accepted = true; return { accepted: true }; },
  });
  await selectEdition(state);
  assert.equal((await state.approve('p1')).accepted, true);
  assert.deepEqual(calls, [{ mediaRequestId: 'r1', providerIngestRequestId: 'p1', metadataReleaseId: 'm1' }]);
  assert.equal(state.intents.value[0].id, 'i1');
  assert.match(state.statusMessage.value, /search queued.*require review before download or import/u);
});

test('failed approval preserves selection and search text for correction', async () => {
  const state = createState({ approveReleaseFn: async () => { throw new Error('Selection changed. Refresh the request.'); } });
  await selectEdition(state);
  state.drafts.value.p1.releaseTitle = 'My adjusted search';
  assert.equal(await state.approve('p1'), null);
  assert.equal(state.drafts.value.p1.selectedReleaseId, 'm1');
  assert.equal(state.drafts.value.p1.releaseTitle, 'My adjusted search');
  assert.equal(state.errorMessage.value, 'Selection changed. Refresh the request.');
  assert.equal(state.isMutating.value, false);
});

test('successful approval followed by refresh failure retains the saved outcome', async () => {
  let accepted = false;
  const state = createState({
    fetchReviewFn: async () => { if (accepted) throw new Error('Refresh failed'); return review(); },
    approveReleaseFn: async () => { accepted = true; return { accepted: true }; },
  });
  await selectEdition(state);
  assert.equal((await state.approve('p1')).accepted, true);
  assert.match(state.statusMessage.value, /search queued/u);
  assert.equal(state.errorMessage.value, 'Refresh failed');
});

test('duplicate clicks are suppressed while approval is pending', async () => {
  const pending = deferred();
  let count = 0;
  const state = createState({ approveReleaseFn: async () => { count += 1; return pending.promise; } });
  await selectEdition(state);
  const first = state.approve('p1');
  assert.equal(await state.approve('p1'), null);
  pending.resolve({ accepted: true, reusedExistingIntent: true });
  await first;
  assert.equal(count, 1);
  assert.match(state.statusMessage.value, /already has an accepted search/u);
});

test('an older catalog search cannot replace newer results even if cancellation is ignored', async () => {
  const old = deferred();
  let count = 0;
  const state = createState({ searchReleasesFn: async () => ++count === 1 ? old.promise : { releases: [{ id: 'new' }] } });
  await state.load({ mediaRequestId: 'r1' });
  const first = state.search('p1');
  await state.search('p1');
  old.resolve({ releases: [{ id: 'old' }] });
  await first;
  assert.equal(state.drafts.value.p1.releases[0].id, 'new');
});

test('request navigation discards an obsolete review response', async () => {
  const old = deferred();
  const state = createState({ fetchReviewFn: async ({ mediaRequestId }) => mediaRequestId === 'r1' ? old.promise : review({ items: [{ ...album, id: 'p2' }] }) });
  const first = state.load({ mediaRequestId: 'r1' });
  await state.load({ mediaRequestId: 'r2' });
  old.resolve(review());
  await first;
  assert.deepEqual(state.items.value.map((item) => item.id), ['p2']);
  assert.equal(state.drafts.value.p1, undefined);
});

test('request navigation discards approval feedback and does not refresh the previous request', async () => {
  const pending = deferred();
  const reads = [];
  const state = createState({
    fetchReviewFn: async ({ mediaRequestId }) => { reads.push(mediaRequestId); return review(); },
    approveReleaseFn: async () => pending.promise,
  });
  await selectEdition(state);
  const first = state.approve('p1');
  await state.load({ mediaRequestId: 'r2' });
  pending.resolve({ accepted: true });
  assert.equal(await first, null);
  assert.deepEqual(reads, ['r1', 'r2']);
  assert.equal(state.statusMessage.value, 'External request review updated.');
});

test('preparation recovery only runs when offered and refreshes after explicit execution', async () => {
  let recoverable = false;
  const calls = [];
  const state = createState({
    fetchReviewFn: async () => review({ preparation: { canRecover: recoverable, action: 'execute' } }),
    recoverPreparationFn: async (payload) => { calls.push(payload); recoverable = false; return { accepted: true }; },
  });
  await state.load({ mediaRequestId: 'r1' });
  assert.equal(await state.recover(), null);
  recoverable = true;
  await state.load({ mediaRequestId: 'r1' });
  await state.recover();
  assert.deepEqual(calls, [{ mediaRequestId: 'r1' }]);
  assert.equal(state.preparation.value.canRecover, false);
  assert.equal(state.statusMessage.value, 'Provider metadata preparation queued.');
});

test('reset invalidates pending catalog work and clears all transient state', async () => {
  const pending = deferred();
  const state = createState({ searchReleasesFn: async () => pending.promise });
  await state.load({ mediaRequestId: 'r1' });
  const work = state.search('p1');
  state.reset();
  pending.reject(new Error('Obsolete failure'));
  await work;
  assert.deepEqual(state.drafts.value, {});
  assert.equal(state.errorMessage.value, '');
  assert.equal(state.statusMessage.value, '');
});
