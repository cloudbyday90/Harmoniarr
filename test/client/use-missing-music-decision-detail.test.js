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
import { createRenderer, h, ref } from 'vue';
import {
  isMissingMusicDecisionNotFoundError,
  useMissingMusicDecisionDetail,
} from '../../src/client/composables/useMissingMusicDecisionDetail.js';
import { buildMissingMusicDecisionDetailPresentation } from '../../src/client/lib/missing-music-decision-detail-presentation.js';

function createNoopRenderer() {
  return createRenderer({
    createComment: (text) => ({ text }),
    createElement: (type) => ({ children: [], type }),
    createText: (text) => ({ text }),
    insert: (child, parent) => { parent.children.push(child); },
    nextSibling: () => null,
    parentNode: () => null,
    patchProp: (node, key, _previousValue, nextValue) => { node[key] = nextValue; },
    remove: () => {},
    setElementText: (node, text) => { node.text = text; },
    setText: (node, text) => { node.text = text; },
  });
}

function mountDecisionDetail(options) {
  const { createApp } = createNoopRenderer();
  const root = { children: [] };
  let decisionDetail;
  const app = createApp({
    setup() {
      decisionDetail = useMissingMusicDecisionDetail({ immediate: false, pollIntervalMs: 0, revalidateOnFocus: false, ...options });
      return () => h('div');
    },
  });

  app.mount(root);
  return { app, decisionDetail };
}

function createDetail(decisionId = 'wanted-amber') {
  return {
    checkedAt: '2026-08-26T16:30:00.000Z',
    decision: {
      decisionId,
      requestedFor: { username: 'Jamie' },
      release: { title: 'Amber' },
    },
    permissions: { isReadOnly: false },
    scope: 'all',
  };
}

test('match navigation replaces bounded results, retains the accepted page for polling and refreshes from the first page', async t => {
  const cursors = []; let fail = false;
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: async (_id, options) => {
    cursors.push(options.matchCursor ?? null);
    if (fail) throw new Error('Private provider payload');
    return { ...createDetail(), matchChoices: [{ id: options.matchCursor ?? 'first' }], matchChoicePage: { nextCursor: 'next', previousCursor: null } };
  } }); t.after(() => app.unmount());
  await decisionDetail.load(); await decisionDetail.loadMatchPage('page-two');
  assert.deepEqual(decisionDetail.detail.value.matchChoices, [{ id: 'page-two' }]);
  assert.equal(decisionDetail.matchPageStatus.value, 'Showing 1 match.');
  await decisionDetail.load(); fail = true; await decisionDetail.loadMatchPage('failed-page'); fail = false;
  assert.equal(decisionDetail.matchPageStatus.value, 'Matches could not be loaded. Try again.');
  await decisionDetail.load(); assert.equal(decisionDetail.detail.value.matchChoices[0].id, 'page-two');
  await decisionDetail.refresh(); assert.equal(decisionDetail.detail.value.matchChoices[0].id, 'first');
  assert.deepEqual(cursors, [null, 'page-two', 'page-two', 'failed-page', 'page-two', null]);
});

test('superseded match navigation cannot replace results or announce failure during a newer read', async t => {
  const requests = [];
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: (_id, options) => {
    const pending = deferred(); requests.push({ ...pending, ...options }); return pending.promise;
  } }); t.after(() => app.unmount());
  const old = decisionDetail.loadMatchPage('old'); await Promise.resolve();
  assert.equal(decisionDetail.isNavigatingMatches.value, true);
  const current = decisionDetail.loadMatchPage('current'); await Promise.resolve();
  assert.equal(requests[0].signal.aborted, true); requests[0].reject(new Error('old private failure')); await old;
  assert.equal(decisionDetail.matchPageStatus.value, 'Loading matches…');
  requests[1].resolve({ ...createDetail(), matchChoices: [{ id: 'current' }] }); await current;
  assert.equal(decisionDetail.detail.value.matchChoices[0].id, 'current');
  assert.equal(decisionDetail.matchPageStatus.value, 'Showing 1 match.');
  assert.equal(decisionDetail.isNavigatingMatches.value, false);
  const background = decisionDetail.load(); await Promise.resolve();
  assert.equal(decisionDetail.isRevalidating.value, true);
  assert.equal(decisionDetail.isNavigatingMatches.value, false);
  requests[2].resolve({ ...createDetail(), matchChoices: [{ id: 'current' }] }); await background;
});

test('a refused continuation retries the current first page once and permission loss clears the old choices', async t => {
  const cursors = []; let denied = false;
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: async (_id, options) => {
    cursors.push(options.matchCursor ?? null);
    if (denied) throw Object.assign(new Error('private'), { status: 403 });
    if (options.matchCursor) throw Object.assign(new Error('private policy'), { code: 'missing_music_match_page_changed', status: 409 });
    return { ...createDetail(), matchChoices: [] };
  } }); t.after(() => app.unmount());
  await decisionDetail.loadMatchPage('expired'); assert.deepEqual(cursors, ['expired', null]);
  assert.equal(decisionDetail.matchPageStatus.value, 'Matches changed. Showing the first page.');
  denied = true; await decisionDetail.loadMatchPage('foreign');
  assert.equal(decisionDetail.detail.value, null); assert.equal(cursors.length, 3);
});

test('durable audio-review guidance survives detail normalization and a fresh read', async () => {
  const payload = { ...createDetail(), libraryAddReview: { reasonCode: 'suspicious_lossless', title: 'Lossless audio needs review',
    detail: 'The completed file was not added.', nextStep: 'Review the audio check.' } };
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: ref('wanted-amber'), fetchMissingMusicDecisionDetail: async () => payload });
  try {
    await decisionDetail.refresh(); assert.deepEqual(decisionDetail.detail.value.libraryAddReview, payload.libraryAddReview);
    await decisionDetail.refresh(); assert.deepEqual(decisionDetail.detail.value.libraryAddReview, payload.libraryAddReview);
  } finally { app.unmount(); }
});

test('decision detail retains only the strict server prepared-add permission', async (t) => {
  const payload = createDetail();
  payload.permissions.canAddToLibrary = 'true';
  payload.decision.status = { nextAction: 'add_to_library' };
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: async () => payload });
  t.after(() => app.unmount());
  await decisionDetail.load();
  assert.equal(decisionDetail.detail.value.permissions.canAddToLibrary, false);
  payload.permissions.canAddToLibrary = true;
  await decisionDetail.refresh();
  assert.equal(decisionDetail.detail.value.permissions.canAddToLibrary, true);
});

test('server-authorized operator review survives normalized detail reads and disappears when permission is withdrawn', async (t) => {
  let permission = true;
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber',
    fetchMissingMusicDecisionDetail: async () => ({ ...createDetail(), permissions: { canReviewDownloadHandoff: permission } }) });
  t.after(() => app.unmount()); await decisionDetail.load();
  assert.equal(buildMissingMusicDecisionDetailPresentation(decisionDetail.detail.value).canReviewDownloadHandoff, true);
  permission = 'true'; await decisionDetail.refresh();
  assert.equal(buildMissingMusicDecisionDetailPresentation(decisionDetail.detail.value).canReviewDownloadHandoff, false);
  permission = undefined; await decisionDetail.refresh();
  assert.equal(decisionDetail.detail.value.permissions.canReviewDownloadHandoff, false);
});

test('useMissingMusicDecisionDetail reads a scoped release projection by route identifier', async (t) => {
  const decisionId = ref('wanted-amber');
  const fetchMissingMusicDecisionDetail = t.mock.fn(async (id) => createDetail(id));
  const { app, decisionDetail } = mountDecisionDetail({
    decisionId,
    fetchMissingMusicDecisionDetail,
  });

  await decisionDetail.load();

  assert.equal(fetchMissingMusicDecisionDetail.mock.callCount(), 1);
  assert.equal(fetchMissingMusicDecisionDetail.mock.calls[0].arguments[0], 'wanted-amber');
  assert.equal(decisionDetail.detail.value.decision.decisionId, 'wanted-amber');
  assert.equal(decisionDetail.detailDecisionId.value, 'wanted-amber');
  assert.equal(decisionDetail.isNotFound.value, false);
  app.unmount();
});

test('useMissingMusicDecisionDetail turns a scoped not-found response into an unavailable state', async () => {
  const decisionId = ref('wanted-other-user');
  const fetchMissingMusicDecisionDetail = async () => {
    const error = new Error('Missing Music release was not found');
    error.code = 'missing_music_decision_not_found';
    error.status = 404;
    throw error;
  };
  const { app, decisionDetail } = mountDecisionDetail({
    decisionId,
    fetchMissingMusicDecisionDetail,
  });

  await decisionDetail.load();

  assert.equal(decisionDetail.detail.value, null);
  assert.equal(decisionDetail.detailDecisionId.value, 'wanted-other-user');
  assert.equal(decisionDetail.isNotFound.value, true);
  assert.equal(decisionDetail.errorMessage.value, '');
  assert.equal(
    isMissingMusicDecisionNotFoundError({ code: 'missing_music_decision_not_found', status: 404 }),
    true,
  );
  app.unmount();
});

test('decision detail retains bounded search counts, clears stale reads and does not infer command permissions', async t => {
  const payload = createDetail();
  const counts = { provider: 'slskd', candidateCount: 0, responseCount: 2, responseFileCount: 4, ignoredUserResponseCount: 1 };
  payload.searchDiagnostics = { ...counts, reasonCodes: ['private'], username: 'private-peer' };
  payload.permissions.canSearchAgain = false;
  payload.permissions.canReviewIgnoredSources = true;
  payload.permissions.canReviewProviderConnection = 'true';
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: async () => payload });
  t.after(() => app.unmount()); await decisionDetail.load();
  assert.equal(decisionDetail.detail.value.searchDiagnostics.ignoredUserResponseCount, 1);
  assert.doesNotMatch(JSON.stringify(decisionDetail.detail.value.searchDiagnostics), /private/);
  assert.equal(decisionDetail.detail.value.permissions.canSearchAgain, false);
  assert.equal(decisionDetail.detail.value.permissions.canReviewIgnoredSources, true);
  assert.equal(decisionDetail.detail.value.permissions.canReviewProviderConnection, false);
  payload.permissions.canReviewIgnoredSources = false;
  payload.searchDiagnostics = null; await decisionDetail.load();
  assert.equal(decisionDetail.detail.value.searchDiagnostics, null);
  assert.equal(decisionDetail.detail.value.permissions.canReviewIgnoredSources, false);
});

test('decision detail retains the bounded quality projection and server fallback permission', async (t) => {
  const payload = createDetail();
  payload.qualityEvidence = { code: 'below_minimum', profileCode: 'lossless_archive', formats: ['mp3'], bitrateKbps: 128 };
  payload.permissions.canAllowFallbackQuality = true;
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: async () => payload });
  t.after(() => app.unmount());
  await decisionDetail.load();
  assert.deepEqual(decisionDetail.detail.value.qualityEvidence, payload.qualityEvidence);
  assert.equal(decisionDetail.detail.value.permissions.canAllowFallbackQuality, true);
});

test('decision detail normalizes initial search permission strictly without deriving it from a status', async (t) => {
  let permission = true;
  const { app, decisionDetail } = mountDecisionDetail({
    decisionId: 'wanted-amber',
    fetchMissingMusicDecisionDetail: async () => ({ ...createDetail(), permissions: { canFindMatches: permission } }),
  });
  t.after(() => app.unmount());
  await decisionDetail.load();
  assert.equal(decisionDetail.detail.value.permissions.canFindMatches, true);
  permission = 'true';
  await decisionDetail.load();
  assert.equal(decisionDetail.detail.value.permissions.canFindMatches, false);
  permission = undefined;
  await decisionDetail.load();
  assert.equal(decisionDetail.detail.value.permissions.canFindMatches, false);
});

test('decision detail retains current bounded library recovery and requires boolean permissions', async (t) => {
  const recovery = { reasonCode: 'audio_check_failed', queued: false, runId: null };
  let permissions = { canRecheckLibraryAdd: true, canRepairFolders: true };
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber',
    fetchMissingMusicDecisionDetail: async () => ({ ...createDetail(), libraryAddRecovery: recovery, permissions }),
  });
  t.after(() => app.unmount());
  await decisionDetail.load();
  assert.deepEqual(decisionDetail.detail.value.libraryAddRecovery, recovery);
  assert.equal(decisionDetail.detail.value.permissions.canRecheckLibraryAdd, true);
  assert.equal(decisionDetail.detail.value.permissions.canRepairFolders, true);
  permissions = { canRecheckLibraryAdd: 'true', canRepairFolders: 1 };
  await decisionDetail.load();
  assert.equal(decisionDetail.detail.value.permissions.canRecheckLibraryAdd, false);
  assert.equal(decisionDetail.detail.value.permissions.canRepairFolders, false);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('refresh deduplicates reads and keeps the previous snapshot through a transient safe error', async (t) => {
  const pending = deferred();
  let count = 0;
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: () => {
    count += 1;
    return count === 1 ? createDetail() : pending.promise;
  } });
  t.after(() => app.unmount());
  await decisionDetail.load();
  const originalSnapshot = decisionDetail.detail.value;
  const refreshing = decisionDetail.refresh();
  assert.equal(decisionDetail.refresh(), refreshing);
  assert.equal(decisionDetail.isLoading.value, false);
  assert.equal(decisionDetail.isRevalidating.value, true);
  assert.equal(decisionDetail.detail.value, originalSnapshot);
  pending.reject(new Error('Private source path /mnt/music'));
  await refreshing;
  assert.equal(count, 2);
  assert.equal(decisionDetail.detail.value, originalSnapshot);
  assert.equal(decisionDetail.detail.value.checkedAt, '2026-08-26T16:30:00.000Z');
  assert.equal(decisionDetail.errorMessage.value, 'Missing Music release details could not be refreshed. Try again.');
  assert.equal(decisionDetail.isRevalidating.value, false);
});

test('navigation aborts old reads and neither late success nor late failure changes the newer decision', async (t) => {
  const decisionId = ref('wanted-amber');
  const requests = [];
  const { app, decisionDetail } = mountDecisionDetail({ decisionId, fetchMissingMusicDecisionDetail: (id, { signal }) => {
    const pending = deferred();
    requests.push({ id, signal, ...pending });
    return pending.promise;
  } });
  t.after(() => app.unmount());
  const first = decisionDetail.load();
  await Promise.resolve();
  decisionId.value = 'wanted-tri-repetae';
  const second = decisionDetail.refresh();
  await Promise.resolve();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(decisionDetail.detail.value, null);
  requests[0].resolve(createDetail('wanted-amber'));
  await first;
  assert.equal(decisionDetail.isLoading.value, true);
  requests[1].resolve(createDetail('wanted-tri-repetae'));
  await second;
  const oldRefresh = decisionDetail.refresh();
  await Promise.resolve();
  decisionId.value = 'wanted-confield';
  const third = decisionDetail.refresh();
  await Promise.resolve();
  requests[3].resolve(createDetail('wanted-confield'));
  await third;
  requests[2].reject(new Error('Private stale failure'));
  await oldRefresh;
  assert.equal(decisionDetail.errorMessage.value, '');
  assert.equal(decisionDetail.detail.value.decision.decisionId, 'wanted-confield');
  assert.equal(decisionDetail.isLoading.value, false);
});

test('permission loss and unavailable responses remove retained detail instead of leaving editable stale history', async (t) => {
  for (const error of [Object.assign(new Error('private identity'), { status: 403 }),
    Object.assign(new Error('private identity'), { status: 404, code: 'missing_music_decision_not_found' })]) {
    let fail = false;
    const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: async () => {
      if (fail) throw error;
      return createDetail();
    } });
    t.after(() => app.unmount());
    await decisionDetail.load();
    fail = true;
    await decisionDetail.refresh();
    assert.equal(decisionDetail.detail.value, null);
    assert.equal(decisionDetail.isNotFound.value, error.status === 404);
    assert.doesNotMatch(decisionDetail.errorMessage.value, /private/u);
  }
});

test('mutation pauses abort reads and prevent stale data from replacing the command refresh', async (t) => {
  const pending = deferred();
  let count = 0;
  let signal;
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', fetchMissingMusicDecisionDetail: (_id, options) => {
    count += 1;
    signal = options.signal;
    return count === 1 ? pending.promise : { ...createDetail(), permissions: { canSearchAgain: true } };
  } });
  t.after(() => app.unmount());
  const first = decisionDetail.load();
  await Promise.resolve();
  decisionDetail.setPaused(true);
  assert.equal(signal.aborted, true);
  assert.equal(await decisionDetail.refresh(), null);
  decisionDetail.setPaused(false);
  await decisionDetail.refresh();
  pending.resolve(createDetail());
  await first;
  assert.equal(decisionDetail.detail.value.permissions.canSearchAgain, true);
  assert.equal(count, 2);
});

test('polls schedule after completion, hidden tabs pause, focus deduplicates, and disposal removes all work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const documentTarget = new EventTarget();
  documentTarget.hidden = false;
  globalThis.document = documentTarget;
  globalThis.window = new EventTarget();
  t.after(() => { globalThis.document = originalDocument; globalThis.window = originalWindow; });
  let count = 0;
  let pending = null;
  let signal;
  const { app, decisionDetail } = mountDecisionDetail({ decisionId: 'wanted-amber', pollIntervalMs: 100,
    revalidateOnFocus: true, fetchMissingMusicDecisionDetail: (_id, options) => {
      count += 1;
      signal = options.signal;
      return pending ? pending.promise : createDetail();
    } });
  t.after(() => app.unmount());
  await decisionDetail.load();
  pending = deferred();
  t.mock.timers.tick(100);
  await Promise.resolve();
  assert.equal(count, 2);
  t.mock.timers.tick(1000);
  globalThis.window.dispatchEvent(new Event('focus'));
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(count, 2, 'An in-flight poll owns the only read');
  const refreshed = decisionDetail.refresh();
  pending.resolve(createDetail());
  await refreshed;
  pending = null;
  documentTarget.hidden = true;
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(1000);
  globalThis.window.dispatchEvent(new Event('focus'));
  assert.equal(count, 2);
  documentTarget.hidden = false;
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  globalThis.window.dispatchEvent(new Event('focus'));
  await decisionDetail.refresh();
  assert.equal(count, 3);
  pending = deferred();
  t.mock.timers.tick(100);
  await Promise.resolve();
  const finishing = decisionDetail.refresh();
  const snapshot = decisionDetail.detail.value;
  app.unmount();
  assert.equal(signal.aborted, true);
  pending.resolve({ ...createDetail(), checkedAt: '2026-10-03T12:00:00.000Z' });
  await finishing;
  t.mock.timers.tick(1000);
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  globalThis.window.dispatchEvent(new Event('focus'));
  assert.equal(count, 4);
  assert.equal(decisionDetail.detail.value, snapshot);
});

test('navigation during a paused command immediately loads the new decision when the command finishes', async (t) => {
  const decisionId = ref('wanted-amber');
  const calls = [];
  const { app, decisionDetail } = mountDecisionDetail({ decisionId, fetchMissingMusicDecisionDetail: async (id) => {
    calls.push(id);
    return createDetail(id);
  } });
  t.after(() => app.unmount());
  await decisionDetail.load();
  decisionDetail.setPaused(true);
  decisionId.value = 'wanted-tri-repetae';
  assert.equal(decisionDetail.detail.value, null);
  assert.equal(calls.length, 1);
  decisionDetail.setPaused(false);
  assert.equal(decisionDetail.isLoading.value, true);
  await decisionDetail.refresh();
  assert.deepEqual(calls, ['wanted-amber', 'wanted-tri-repetae']);
  assert.equal(decisionDetail.detail.value.decision.decisionId, 'wanted-tri-repetae');
});
