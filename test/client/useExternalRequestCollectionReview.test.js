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

const album = { id: 'p1', collectionItemId: 'c1', title: 'Album', artistName: 'Artist', reviewable: true, decision: 'pending' };
const unsupported = { id: 'u1', collectionItemId: 'c2', title: 'Unavailable entry', reviewable: false, decision: 'pending', itemKind: 'unsupported' };
const ready = { status: 'ready', revision: 3, targetMatches: true, canFinalize: false, canRestart: false };
function payload(overrides = {}) {
  return { items: [album], collection: ready, intents: [], preparation: { canRecover: false },
    pagination: { nextCursor: 'cursor-two', hasMore: true, limit: 25 }, ...overrides };
}
function stateWith(overrides = {}) {
  return useExternalRequestReview({
    fetchReviewFn: async () => payload(), searchReleasesFn: async () => ({ releases: [{ id: 'release1' }] }),
    ...overrides,
  });
}

test('review pagination preserves drafts and uses server cursors without assuming item positions', async () => {
  const reads = [];
  const state = stateWith({ fetchReviewFn: async ({ cursor, limit }) => {
    reads.push({ cursor, limit });
    return cursor ? payload({ items: [unsupported], pagination: { nextCursor: null, hasMore: false, limit: 25 } }) : payload();
  } });
  await state.load({ mediaRequestId: 'r1' });
  state.drafts.value.p1.releaseTitle = 'Edited title';
  await state.nextPage();
  assert.equal(state.pageNumber.value, 2);
  assert.equal(state.items.value[0].id, 'u1');
  state.drafts.value.u1.exclusionReason = 'Unavailable in this storefront';
  await state.nextPage();
  assert.equal(reads.length, 2);
  await state.previousPage();
  assert.equal(state.pageNumber.value, 1);
  assert.equal(state.canGoPrevious.value, false);
  assert.equal(state.drafts.value.p1.releaseTitle, 'Edited title');
  await state.nextPage();
  assert.equal(state.drafts.value.u1.exclusionReason, 'Unavailable in this storefront');
  assert.deepEqual(reads, [{ cursor: null, limit: 25 }, { cursor: 'cursor-two', limit: 25 },
    { cursor: null, limit: 25 }, { cursor: 'cursor-two', limit: 25 }]);
});

test('failed page navigation preserves the visible page and history', async () => {
  const state = stateWith({ fetchReviewFn: async ({ cursor }) => {
    if (cursor) throw new Error('Page unavailable');
    return payload();
  } });
  await state.load({ mediaRequestId: 'r1' });
  await state.nextPage();
  assert.equal(state.pageNumber.value, 1);
  assert.equal(state.items.value[0].id, 'p1');
  assert.equal(state.errorMessage.value, 'Page unavailable');
});

test('tracked inclusion sends the captured revision and requires a ready collection', async () => {
  let collection = { ...ready, status: 'preparing' };
  const calls = [];
  const state = stateWith({
    fetchReviewFn: async () => payload({ collection }),
    approveReleaseFn: async (args) => { calls.push(args); return { accepted: true }; },
  });
  await state.load({ mediaRequestId: 'r1' });
  await state.search('p1');
  state.drafts.value.p1.selectedReleaseId = 'release1';
  assert.equal(await state.approve('p1'), null);
  collection = ready;
  await state.load({ mediaRequestId: 'r1' });
  await state.approve('p1');
  assert.deepEqual(calls, [{ mediaRequestId: 'r1', providerIngestRequestId: 'p1', metadataReleaseId: 'release1', expectedRevision: 3 }]);
});

test('failed exclusion retains its reason and page; success resets to the first page', async () => {
  let reject = true;
  const calls = [];
  const state = stateWith({
    fetchReviewFn: async ({ cursor }) => cursor ? payload({ items: [unsupported] }) : payload(),
    excludeItemFn: async (args) => {
      calls.push(args);
      if (reject) throw new Error('Review changed. Refresh before retrying.');
      return { accepted: true };
    },
  });
  await state.load({ mediaRequestId: 'r1' });
  await state.nextPage();
  assert.equal(await state.exclude('u1'), null);
  assert.equal(calls.length, 0);
  state.drafts.value.u1.exclusionReason = '  Unavailable in this storefront  ';
  assert.equal(await state.exclude('u1'), null);
  assert.equal(state.pageNumber.value, 2);
  assert.equal(state.drafts.value.u1.exclusionReason, '  Unavailable in this storefront  ');
  reject = false;
  await state.exclude('u1');
  assert.equal(state.pageNumber.value, 1);
  assert.equal(state.canGoPrevious.value, false);
  assert.deepEqual(calls[0], { mediaRequestId: 'r1', collectionItemId: 'c2', reason: 'Unavailable in this storefront', expectedRevision: 3 });
});

test('finalization is unavailable for incomplete, reassigned, or already reviewed collections', async () => {
  let collection = ready;
  const calls = [];
  const state = stateWith({ fetchReviewFn: async () => payload({ collection }),
    finalizeCollectionFn: async (args) => { calls.push(args); return { accepted: true }; },
  });
  for (const scenario of [ready, { ...ready, status: 'blocked', canFinalize: true },
    { ...ready, targetMatches: false, canFinalize: true }, { ...ready, reviewedAt: '2026-09-11', canFinalize: true }]) {
    collection = scenario;
    await state.load({ mediaRequestId: 'r1' });
    assert.equal(await state.finalizeCollection(), null);
  }
  assert.equal(calls.length, 0);
  collection = { ...ready, canFinalize: true };
  await state.load({ mediaRequestId: 'r1' });
  await state.finalizeCollection();
  assert.deepEqual(calls, [{ mediaRequestId: 'r1', expectedRevision: 3 }]);
  assert.match(state.statusMessage.value, /successful import before fulfillment/u);
});

test('legacy start and blocked restart require an explicit offered action', async () => {
  let response = payload({ collection: null, canStartCollection: false });
  const calls = [];
  const state = stateWith({ fetchReviewFn: async () => response,
    startCollectionFn: async (args) => { calls.push(args); return { accepted: true }; },
  });
  await state.load({ mediaRequestId: 'r1' });
  assert.equal(await state.startCollection(), null);
  response = payload({ collection: null, canStartCollection: true });
  await state.load({ mediaRequestId: 'r1' });
  assert.equal(calls.length, 0);
  await state.startCollection();
  assert.equal(await state.startCollection(true), null);
  response = payload({ collection: { ...ready, status: 'blocked', canRestart: true } });
  await state.load({ mediaRequestId: 'r1' });
  await state.startCollection(true);
  assert.deepEqual(calls, [{ mediaRequestId: 'r1', restart: false }, { mediaRequestId: 'r1', restart: true }]);
});
