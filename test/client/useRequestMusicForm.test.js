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
import { useRequestMusicForm } from '../../src/client/composables/useRequestMusicForm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSummaryPayload({ scope = 'mine', total = 0 } = {}) {
  return {
    ok: true,
    scope,
    counts: { totalRequests: total, alreadyExists: 0, needsFetch: total, needsReview: 0 },
    fulfillmentCounts: { active: 0, failed: 0, satisfied: 0, underReview: 0 },
    notificationFeed: {
      checkedAt: '2026-05-11T10:00:00Z',
      counts: { byCategory: { delegated_request: 0, failure: 0, fulfillment: 0, review: 0 }, total: 0 },
      notifications: [],
    },
    summary: { message: 'ok', status: 'active' },
  };
}

function makeRequestsPayload(requests = []) {
  return { ok: true, mediaRequests: requests };
}

function makeRequest(overrides = {}) {
  return {
    id: 'req-1',
    requestKind: 'release',
    artistName: 'Daft Punk',
    releaseTitle: 'Discovery',
    trackTitle: null,
    sourceUrl: null,
    notes: '',
    requestState: 'needs_fetch',
    fulfillmentStatus: null,
    sourceProvider: null,
    existingMatch: null,
    createdAt: '2026-05-11T10:00:00Z',
    requestedByUser: { id: 'u1', username: 'alice', role: 'admin' },
    requestedForUser: { id: 'u1', username: 'alice', role: 'admin' },
    ...overrides,
  };
}

function makeUsersPayload(users = []) {
  return { ok: true, users };
}

function makeUser(overrides = {}) {
  return {
    id: 'u1',
    username: 'alice',
    role: 'admin',
    mediaRequestTarget: { eligible: true },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// loadRequestDashboard — happy path
// ---------------------------------------------------------------------------

test('useRequestMusicForm loadRequestDashboard populates summary', async (t) => {
  const summaryPayload = makeSummaryPayload({ total: 5 });
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => summaryPayload);
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { summary, loadRequestDashboard } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await loadRequestDashboard();

  assert.equal(summary.value.counts.totalRequests, 5);
});

test('useRequestMusicForm loadRequestDashboard populates mediaRequests', async (t) => {
  const requests = [makeRequest()];
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload(requests));

  const { mediaRequests, loadRequestDashboard } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await loadRequestDashboard();

  assert.equal(mediaRequests.value.length, 1);
  assert.equal(mediaRequests.value[0].id, 'req-1');
});

test('useRequestMusicForm loadRequestDashboard defaults mediaRequests to empty array on missing key', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => ({ ok: true }));

  const { mediaRequests, loadRequestDashboard } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await loadRequestDashboard();

  assert.deepEqual(mediaRequests.value, []);
});

test('useRequestMusicForm loadRequestDashboard passes scope to both fetchers', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { loadRequestDashboard } = useRequestMusicForm({
    initialScope: 'all',
    isAdmin: true,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await loadRequestDashboard();

  assert.equal(fetchMediaRequestSummaryFn.mock.calls[0].arguments[0].scope, 'all');
  assert.equal(fetchMediaRequestsFn.mock.calls[0].arguments[0].scope, 'all');
});

test('useRequestMusicForm loadRequestDashboard sets isLoading around fetch', async (t) => {
  let resolvePromise;
  const slowFetch = async () => {
    await new Promise((resolve) => { resolvePromise = resolve; });
    return makeSummaryPayload();
  };

  const { isLoading, loadRequestDashboard } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: slowFetch,
    fetchMediaRequestsFn: async () => makeRequestsPayload(),
  });

  assert.equal(isLoading.value, false, 'starts false');
  const loadPromise = loadRequestDashboard();
  assert.equal(isLoading.value, true, 'true during fetch');
  resolvePromise();
  await loadPromise;
  assert.equal(isLoading.value, false, 'false after fetch');
});

// ---------------------------------------------------------------------------
// loadRequestDashboard — error handling
// ---------------------------------------------------------------------------

test('useRequestMusicForm loadRequestDashboard sets loadError on failure', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => {
    throw new Error('network error');
  });
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { loadError, loadRequestDashboard } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await loadRequestDashboard();

  assert.equal(loadError.value, 'network error');
});

test('useRequestMusicForm loadRequestDashboard uses fallback message for non-Error rejections', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => {
    throw 'bad response';
  });
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { loadError, loadRequestDashboard } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await loadRequestDashboard();

  assert.equal(loadError.value, 'Music request dashboard could not be loaded');
});

// ---------------------------------------------------------------------------
// loadRequestTargets — admin path
// ---------------------------------------------------------------------------

test('useRequestMusicForm loadRequestTargets populates requestTargets for admin', async (t) => {
  const users = [
    makeUser({ id: 'u1' }),
    makeUser({ id: 'u2', username: 'bob', role: 'requester' }),
  ];
  const fetchUsersFn = t.mock.fn(async () => makeUsersPayload(users));

  const { requestTargets, loadRequestTargets } = useRequestMusicForm({
    isAdmin: true,
    currentUserId: 'u1',
    fetchUsersFn,
  });

  await loadRequestTargets();

  assert.equal(requestTargets.value.length, 2);
});

test('useRequestMusicForm loadRequestTargets filters out ineligible users', async (t) => {
  const users = [
    makeUser({ id: 'u1' }),
    makeUser({ id: 'u2', username: 'bob', mediaRequestTarget: { eligible: false } }),
  ];
  const fetchUsersFn = t.mock.fn(async () => makeUsersPayload(users));

  const { requestTargets, loadRequestTargets } = useRequestMusicForm({
    isAdmin: true,
    currentUserId: 'u1',
    fetchUsersFn,
  });

  await loadRequestTargets();

  assert.equal(requestTargets.value.length, 1);
  assert.equal(requestTargets.value[0].id, 'u1');
});

test('useRequestMusicForm loadRequestTargets sets default target to current user when eligible', async (t) => {
  const users = [
    makeUser({ id: 'u2', username: 'bob' }),
    makeUser({ id: 'u1', username: 'alice' }),
  ];
  const fetchUsersFn = t.mock.fn(async () => makeUsersPayload(users));

  const { form, loadRequestTargets } = useRequestMusicForm({
    isAdmin: true,
    currentUserId: 'u1',
    fetchUsersFn,
  });

  await loadRequestTargets();

  assert.equal(form.requestedForUserId, 'u1');
});

test('useRequestMusicForm loadRequestTargets sets default target to first user when current not found', async (t) => {
  const users = [
    makeUser({ id: 'u2', username: 'bob' }),
    makeUser({ id: 'u3', username: 'carol' }),
  ];
  const fetchUsersFn = t.mock.fn(async () => makeUsersPayload(users));

  const { form, loadRequestTargets } = useRequestMusicForm({
    isAdmin: true,
    currentUserId: 'u1',
    fetchUsersFn,
  });

  await loadRequestTargets();

  assert.equal(form.requestedForUserId, 'u2');
});

test('useRequestMusicForm loadRequestTargets is no-op for non-admin', async (t) => {
  const fetchUsersFn = t.mock.fn(async () => makeUsersPayload([makeUser()]));

  const { requestTargets, loadRequestTargets } = useRequestMusicForm({
    isAdmin: false,
    fetchUsersFn,
  });

  await loadRequestTargets();

  assert.equal(fetchUsersFn.mock.callCount(), 0);
  assert.deepEqual(requestTargets.value, []);
});

test('useRequestMusicForm loadRequestTargets sets targetErrorMessage on failure', async (t) => {
  const fetchUsersFn = t.mock.fn(async () => {
    throw new Error('could not load users');
  });

  const { targetErrorMessage, loadRequestTargets } = useRequestMusicForm({
    isAdmin: true,
    currentUserId: 'u1',
    fetchUsersFn,
  });

  await loadRequestTargets();

  assert.equal(targetErrorMessage.value, 'could not load users');
});

// ---------------------------------------------------------------------------
// canSubmit
// ---------------------------------------------------------------------------

test('useRequestMusicForm canSubmit is false for empty release form', () => {
  const { canSubmit } = useRequestMusicForm();
  assert.equal(canSubmit.value, false);
});

test('useRequestMusicForm canSubmit is true when release has artist and release title', () => {
  const { form, canSubmit } = useRequestMusicForm();
  form.requestKind = 'release';
  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';
  assert.equal(canSubmit.value, true);
});

test('useRequestMusicForm canSubmit is false when release missing release title', () => {
  const { form, canSubmit } = useRequestMusicForm();
  form.requestKind = 'release';
  form.artistName = 'Daft Punk';
  assert.equal(canSubmit.value, false);
});

test('useRequestMusicForm canSubmit is true when track has artist and track title', () => {
  const { form, canSubmit } = useRequestMusicForm();
  form.requestKind = 'track';
  form.artistName = 'Daft Punk';
  form.trackTitle = 'One More Time';
  assert.equal(canSubmit.value, true);
});

test('useRequestMusicForm canSubmit is false when track missing track title', () => {
  const { form, canSubmit } = useRequestMusicForm();
  form.requestKind = 'track';
  form.artistName = 'Daft Punk';
  assert.equal(canSubmit.value, false);
});

test('useRequestMusicForm canSubmit is true when external_url has source URL', () => {
  const { form, canSubmit } = useRequestMusicForm();
  form.requestKind = 'external_url';
  form.sourceUrl = 'https://open.spotify.com/playlist/abc';
  assert.equal(canSubmit.value, true);
});

test('useRequestMusicForm canSubmit is false when external_url has only whitespace URL', () => {
  const { form, canSubmit } = useRequestMusicForm();
  form.requestKind = 'external_url';
  form.sourceUrl = '   ';
  assert.equal(canSubmit.value, false);
});

// ---------------------------------------------------------------------------
// submitRequest
// ---------------------------------------------------------------------------

test('useRequestMusicForm submitRequest calls createMediaRequestFn with correct payload', async (t) => {
  const createdRequest = makeRequest({ requestState: 'needs_fetch' });
  const createMediaRequestFn = t.mock.fn(async () => ({ ok: true, mediaRequest: createdRequest }));
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { form, submitRequest } = useRequestMusicForm({
    createMediaRequestFn,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  form.requestKind = 'release';
  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';
  form.notes = '';

  await submitRequest();

  assert.equal(createMediaRequestFn.mock.callCount(), 1);
  const payload = createMediaRequestFn.mock.calls[0].arguments[0];
  assert.equal(payload.requestKind, 'release');
  assert.equal(payload.artistName, 'Daft Punk');
  assert.equal(payload.releaseTitle, 'Discovery');
});

test('useRequestMusicForm submitRequest sets successMessage on success', async (t) => {
  const createdRequest = makeRequest({
    requestState: 'needs_fetch',
    requestedForUser: { id: 'u1', username: 'alice' },
  });
  const createMediaRequestFn = t.mock.fn(async () => ({ ok: true, mediaRequest: createdRequest }));
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { form, successMessage, submitRequest } = useRequestMusicForm({
    currentUserId: 'u1',
    createMediaRequestFn,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  form.requestKind = 'release';
  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';

  await submitRequest();

  assert.equal(successMessage.value, 'Music request submitted and added to your request profile.');
});

test('useRequestMusicForm submitRequest resets form after success', async (t) => {
  const createdRequest = makeRequest();
  const createMediaRequestFn = t.mock.fn(async () => ({ ok: true, mediaRequest: createdRequest }));
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { form, submitRequest } = useRequestMusicForm({
    createMediaRequestFn,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  form.requestKind = 'release';
  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';
  form.notes = 'please add';

  await submitRequest();

  assert.equal(form.artistName, '');
  assert.equal(form.releaseTitle, '');
  assert.equal(form.notes, '');
  assert.equal(form.requestKind, 'release');
});

test('useRequestMusicForm submitRequest sets errorMessage on failure', async (t) => {
  const createMediaRequestFn = t.mock.fn(async () => {
    throw new Error('submission failed');
  });

  const { form, errorMessage, submitRequest } = useRequestMusicForm({
    createMediaRequestFn,
  });

  form.requestKind = 'release';
  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';

  await submitRequest();

  assert.equal(errorMessage.value, 'submission failed');
});

test('useRequestMusicForm submitRequest clears errorMessage before attempting', async (t) => {
  let callCount = 0;
  const createMediaRequestFn = t.mock.fn(async () => {
    callCount++;
    if (callCount === 1) throw new Error('first attempt failed');
    return { ok: true, mediaRequest: makeRequest() };
  });
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { form, errorMessage, submitRequest } = useRequestMusicForm({
    createMediaRequestFn,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  form.requestKind = 'release';
  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';

  await submitRequest();
  assert.equal(errorMessage.value, 'first attempt failed');

  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';
  await submitRequest();
  assert.equal(errorMessage.value, '');
});

// ---------------------------------------------------------------------------
// switchScope
// ---------------------------------------------------------------------------

test('useRequestMusicForm switchScope changes selectedScope and reloads dashboard', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { selectedScope, switchScope } = useRequestMusicForm({
    initialScope: 'mine',
    isAdmin: true,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  assert.equal(selectedScope.value, 'mine');

  await switchScope('all');

  assert.equal(selectedScope.value, 'all');
  assert.equal(fetchMediaRequestsFn.mock.callCount(), 1);
});

test('useRequestMusicForm switchScope is no-op when switching to current scope', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { switchScope } = useRequestMusicForm({
    initialScope: 'mine',
    isAdmin: true,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await switchScope('mine');

  assert.equal(fetchMediaRequestsFn.mock.callCount(), 0);
});

test('useRequestMusicForm switchScope is no-op for non-admin', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { selectedScope, switchScope } = useRequestMusicForm({
    initialScope: 'mine',
    isAdmin: false,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  await switchScope('all');

  assert.equal(selectedScope.value, 'mine');
  assert.equal(fetchMediaRequestsFn.mock.callCount(), 0);
});

// ---------------------------------------------------------------------------
// resetForm
// ---------------------------------------------------------------------------

test('useRequestMusicForm resetForm clears all form fields', () => {
  const { form, resetForm } = useRequestMusicForm();

  form.artistName = 'Daft Punk';
  form.releaseTitle = 'Discovery';
  form.trackTitle = 'One More Time';
  form.sourceUrl = 'https://spotify.com';
  form.notes = 'important';
  form.requestKind = 'track';

  resetForm();

  assert.equal(form.artistName, '');
  assert.equal(form.releaseTitle, '');
  assert.equal(form.trackTitle, '');
  assert.equal(form.sourceUrl, '');
  assert.equal(form.notes, '');
  assert.equal(form.requestKind, 'release');
});

// ---------------------------------------------------------------------------
// revalidate
// ---------------------------------------------------------------------------

test('useRequestMusicForm revalidate refreshes summary and requests', async (t) => {
  const summaryPayload = makeSummaryPayload({ total: 3 });
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => summaryPayload);
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload([makeRequest()]));

  const { summary, mediaRequests, loadRequestDashboard, revalidate, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
    pollIntervalMs: 0,
  });

  try {
    await loadRequestDashboard();
    assert.equal(summary.value.counts.totalRequests, 3);
    assert.equal(mediaRequests.value.length, 1);

    await revalidate();
    assert.equal(fetchMediaRequestSummaryFn.mock.callCount(), 2);
    assert.equal(fetchMediaRequestsFn.mock.callCount(), 2);
  } finally {
    destroy();
  }
});

test('useRequestMusicForm revalidate preserves stale data on error', async (t) => {
  let callCount = 0;
  const fetchMediaRequestSummaryFn = async () => {
    callCount += 1;
    if (callCount === 1) return makeSummaryPayload({ total: 1 });
    throw new Error('refresh failed');
  };
  const fetchMediaRequestsFn = async () => makeRequestsPayload();

  const { summary, loadRequestDashboard, revalidate, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
    pollIntervalMs: 0,
  });

  try {
    await loadRequestDashboard();
    assert.equal(summary.value.counts.totalRequests, 1);

    await revalidate();
    assert.equal(summary.value.counts.totalRequests, 1, 'stale summary preserved');
  } finally {
    destroy();
  }
});

test('useRequestMusicForm revalidate is no-op after destroy', async (t) => {
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());

  const { loadRequestDashboard, revalidate, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
    pollIntervalMs: 0,
  });

  await loadRequestDashboard();
  assert.equal(fetchMediaRequestSummaryFn.mock.callCount(), 1);
  destroy();

  await revalidate();
  assert.equal(fetchMediaRequestSummaryFn.mock.callCount(), 1, 'no fetch after destroy');
});

test('useRequestMusicForm destroy removes visibility listener', async () => {
  const listeners = [];
  const origDocAdd = globalThis.document?.addEventListener;
  const origDocRemove = globalThis.document?.removeEventListener;

  globalThis.document = globalThis.document ?? {};
  globalThis.document.addEventListener = (event, fn) => {
    if (event === 'visibilitychange') listeners.push(fn);
  };
  globalThis.document.removeEventListener = (event, fn) => {
    if (event === 'visibilitychange') {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    }
  };

  const fetchMediaRequestSummaryFn = async () => makeSummaryPayload();
  const fetchMediaRequestsFn = async () => makeRequestsPayload();

  const { attachVisibilityListener, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
    pollIntervalMs: 0,
    revalidateOnFocus: true,
  });

  try {
    attachVisibilityListener();
    assert.equal(listeners.length, 1);

    destroy();
    assert.equal(listeners.length, 0, 'listener removed after destroy');
  } finally {
    globalThis.document.addEventListener = origDocAdd;
    globalThis.document.removeEventListener = origDocRemove;
    if (origDocAdd === undefined) delete globalThis.document;
  }
});

// ---------------------------------------------------------------------------
// loadMoreRequests — cursor pagination edge cases
// ---------------------------------------------------------------------------

test('useRequestMusicForm loadMoreRequests appends results and advances cursor', async (t) => {
  const page1 = [makeRequest({ id: 'r1' }), makeRequest({ id: 'r2' })];
  const page2 = [makeRequest({ id: 'r3' })];
  let fetchCallCount = 0;
  const fetchMediaRequestsFn = t.mock.fn(async (params) => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      return { ok: true, mediaRequests: page1, nextCursor: 'cursor2', totalCount: 3 };
    }
    return { ok: true, mediaRequests: page2, nextCursor: null, totalCount: 3 };
  });

  const { mediaRequests, hasMore, loadRequestDashboard, loadMoreRequests, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard();
    assert.equal(mediaRequests.value.length, 2);
    assert.equal(hasMore.value, true);

    await loadMoreRequests();
    assert.equal(mediaRequests.value.length, 3);
    assert.equal(mediaRequests.value[2].id, 'r3');
    assert.equal(hasMore.value, false);
  } finally {
    destroy();
  }
});

test('useRequestMusicForm loadMoreRequests sets loadMoreError on failure', async (t) => {
  const page1 = [makeRequest({ id: 'r1' })];
  let fetchCallCount = 0;
  const fetchMediaRequestsFn = t.mock.fn(async () => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      return { ok: true, mediaRequests: page1, nextCursor: 'cursor2' };
    }
    throw new Error('loadMore network failure');
  });

  const { mediaRequests, loadMoreError, loadRequestDashboard, loadMoreRequests, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard();
    assert.equal(mediaRequests.value.length, 1);

    await loadMoreRequests();
    assert.equal(loadMoreError.value, 'loadMore network failure');
    assert.equal(mediaRequests.value.length, 1, 'accumulated results preserved');
  } finally {
    destroy();
  }
});

test('useRequestMusicForm loadMoreRequests preserves accumulated data on error', async (t) => {
  const page1 = [makeRequest({ id: 'r1' }), makeRequest({ id: 'r2' })];
  let fetchCallCount = 0;
  const fetchMediaRequestsFn = t.mock.fn(async () => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      return { ok: true, mediaRequests: page1, nextCursor: 'cursor2' };
    }
    throw new Error('transient error');
  });

  const { mediaRequests, loadMoreError, hasMore, loadRequestDashboard, loadMoreRequests, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard();

    await loadMoreRequests();
    assert.equal(mediaRequests.value.length, 2, 'page 1 results still present');
    assert.equal(loadMoreError.value, 'transient error');
    assert.equal(hasMore.value, true, 'cursor unchanged — retry possible');
  } finally {
    destroy();
  }
});

test('useRequestMusicForm loadMoreRequests is no-op when hasMore is false', async (t) => {
  const fetchMediaRequestsFn = t.mock.fn(async () => ({
    ok: true,
    mediaRequests: [makeRequest()],
    nextCursor: null,
  }));

  const { loadRequestDashboard, loadMoreRequests, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard();
    assert.equal(fetchMediaRequestsFn.mock.callCount(), 1);

    await loadMoreRequests();
    assert.equal(fetchMediaRequestsFn.mock.callCount(), 1, 'no additional fetch');
  } finally {
    destroy();
  }
});

// ---------------------------------------------------------------------------
// switchScope — aborts inflight loadMore
// ---------------------------------------------------------------------------

test('useRequestMusicForm switchScope aborts inflight loadMore and reloads', async (t) => {
  let loadMoreResolve;
  const fetchMediaRequestsFn = t.mock.fn(async (params) => {
    if (params.cursor) {
      return new Promise((resolve) => { loadMoreResolve = resolve; });
    }
    return { ok: true, mediaRequests: [makeRequest({ id: 'r1' })], nextCursor: 'cursor2' };
  });

  const { mediaRequests, isLoadingMore, selectedScope, loadRequestDashboard, loadMoreRequests, switchScope, destroy } = useRequestMusicForm({
    initialScope: 'mine',
    isAdmin: true,
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard();

    const loadMorePromise = loadMoreRequests();
    assert.equal(isLoadingMore.value, true);

    const switchPromise = switchScope('all');
    assert.equal(selectedScope.value, 'all');

    loadMoreResolve({ ok: true, mediaRequests: [makeRequest({ id: 'r2' })], nextCursor: null });
    await loadMorePromise;
    await switchPromise;

    assert.equal(mediaRequests.value.length, 1, 'stale loadMore results discarded after scope switch');
    assert.equal(mediaRequests.value[0].id, 'r1', 'fresh dashboard results from new scope');
  } finally {
    destroy();
  }
});

// ---------------------------------------------------------------------------
// submitRequest — preserves filter params
// ---------------------------------------------------------------------------

test('useRequestMusicForm submitRequest reloads dashboard with lastFilterParams', async (t) => {
  const createdRequest = makeRequest({ requestState: 'needs_fetch' });
  const createMediaRequestFn = t.mock.fn(async () => ({ ok: true, mediaRequest: createdRequest }));
  const fetchMediaRequestsFn = t.mock.fn(async () => makeRequestsPayload());
  const fetchMediaRequestSummaryFn = t.mock.fn(async () => makeSummaryPayload());

  const { form, loadRequestDashboard, submitRequest, destroy } = useRequestMusicForm({
    currentUserId: 'u1',
    createMediaRequestFn,
    fetchMediaRequestSummaryFn,
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard({ requestState: 'needs_fetch', requestKind: 'release' });
    const initialCalls = fetchMediaRequestsFn.mock.callCount();

    form.requestKind = 'release';
    form.artistName = 'Daft Punk';
    form.releaseTitle = 'Discovery';

    await submitRequest();

    assert.ok(fetchMediaRequestsFn.mock.callCount() > initialCalls, 'dashboard reloaded after submit');
    const lastCall = fetchMediaRequestsFn.mock.calls[fetchMediaRequestsFn.mock.callCount() - 1].arguments[0];
    assert.equal(lastCall.requestState, 'needs_fetch', 'filter params preserved');
    assert.equal(lastCall.requestKind, 'release', 'filter params preserved');
  } finally {
    destroy();
  }
});

// ---------------------------------------------------------------------------
// loadRequestDashboard — resets loadMoreError
// ---------------------------------------------------------------------------

test('useRequestMusicForm loadRequestDashboard clears loadMoreError', async (t) => {
  let fetchCallCount = 0;
  const fetchMediaRequestsFn = t.mock.fn(async () => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      return { ok: true, mediaRequests: [makeRequest()], nextCursor: 'cursor2' };
    }
    if (fetchCallCount === 2) {
      throw new Error('loadMore failed');
    }
    return { ok: true, mediaRequests: [makeRequest()], nextCursor: null };
  });

  const { loadMoreError, loadRequestDashboard, loadMoreRequests, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard();
    await loadMoreRequests();
    assert.equal(loadMoreError.value, 'loadMore failed');

    await loadRequestDashboard();
    assert.equal(loadMoreError.value, '', 'loadMoreError cleared on fresh dashboard load');
  } finally {
    destroy();
  }
});

// ---------------------------------------------------------------------------
// destroy — aborts inflight loadMore
// ---------------------------------------------------------------------------

test('useRequestMusicForm destroy aborts inflight loadMore', async (t) => {
  let loadMoreResolve;
  const fetchMediaRequestsFn = t.mock.fn(async (params) => {
    if (params.cursor) {
      return new Promise((resolve) => { loadMoreResolve = resolve; });
    }
    return { ok: true, mediaRequests: [makeRequest()], nextCursor: 'cursor2' };
  });

  const { mediaRequests, loadRequestDashboard, loadMoreRequests, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard();

    const loadMorePromise = loadMoreRequests();
    destroy();

    loadMoreResolve({ ok: true, mediaRequests: [makeRequest({ id: 'r2' })], nextCursor: null });
    await loadMorePromise;

    assert.equal(mediaRequests.value.length, 1, 'aborted loadMore did not append');
  } finally {
    // already destroyed
  }
});

test('useRequestMusicForm loadMoreRequests uses frozen lastFilterParams instead of caller args', async (t) => {
  const page1 = [makeRequest({ id: 'r1' })];
  const page2 = [makeRequest({ id: 'r2' })];
  const fetchMediaRequestsFn = t.mock.fn(async (params) => {
    if (!params.cursor) {
      return { ok: true, mediaRequests: page1, nextCursor: 'cursor2', totalCount: 2 };
    }
    assert.equal(params.requestState, 'needs_fetch', 'loadMore uses lastFilterParams.requestState');
    assert.equal(params.requestKind, 'release', 'loadMore uses lastFilterParams.requestKind');
    assert.equal(params.search, 'autechre', 'loadMore uses lastFilterParams.search');
    assert.equal(params.cursor, 'cursor2', 'loadMore passes cursor from initial load');
    return { ok: true, mediaRequests: page2, nextCursor: null, totalCount: 2 };
  });

  const { mediaRequests, loadRequestDashboard, loadMoreRequests, destroy } = useRequestMusicForm({
    fetchMediaRequestSummaryFn: async () => makeSummaryPayload(),
    fetchMediaRequestsFn,
  });

  try {
    await loadRequestDashboard({ requestState: 'needs_fetch', requestKind: 'release', search: 'autechre' });
    assert.equal(mediaRequests.value.length, 1);

    await loadMoreRequests();
    assert.equal(mediaRequests.value.length, 2);
    assert.equal(fetchMediaRequestsFn.mock.callCount(), 2);
  } finally {
    destroy();
  }
});
