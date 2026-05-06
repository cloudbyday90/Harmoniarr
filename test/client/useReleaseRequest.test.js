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
import { useReleaseRequest } from '../../src/client/composables/useReleaseRequest.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createToastDouble(t) {
  return {
    success: t.mock.fn(),
    error: t.mock.fn(),
    info: t.mock.fn(),
    warning: t.mock.fn(),
    dismiss: t.mock.fn(),
  };
}

function makeRelease(overrides = {}) {
  return {
    id: 'mbid-release-99',
    title: 'Test Album',
    artistCredit: 'Test Artist',
    date: '2024',
    ...overrides,
  };
}

function makeSubmitDouble({ throws } = {}) {
  return async () => {
    if (throws) throw throws;
    return { ok: true, mediaRequest: { id: 'req-1' } };
  };
}

// ---------------------------------------------------------------------------
// Happy path: successful request
// ---------------------------------------------------------------------------

test('useReleaseRequest requestRelease calls submitRequest with normalized payload', async (t) => {
  const submitRequest = t.mock.fn(makeSubmitDouble());
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({ submitRequest, toast });
  const release = makeRelease();

  await requestRelease(release);

  assert.equal(submitRequest.mock.callCount(), 1);
  const payload = submitRequest.mock.calls[0].arguments[0];
  assert.equal(payload.artistName, 'Test Artist');
  assert.equal(payload.releaseTitle, 'Test Album');
  assert.equal(payload.requestKind, 'release');
});

test('useReleaseRequest requestRelease marks release as requested after success', async (t) => {
  const submitRequest = makeSubmitDouble();
  const toast = createToastDouble(t);
  const { isRequested, isRequesting, requestRelease } = useReleaseRequest({ submitRequest, toast });
  const release = makeRelease();

  await requestRelease(release);

  assert.equal(isRequested(release), true);
  assert.equal(isRequesting(release), false);
});

test('useReleaseRequest requestRelease returns { ok: true } on success', async (t) => {
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({ submitRequest: makeSubmitDouble(), toast });
  const result = await requestRelease(makeRelease());

  assert.equal(result.ok, true);
  assert.equal(result.skipped, undefined);
});

test('useReleaseRequest requestRelease shows success toast', async (t) => {
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({ submitRequest: makeSubmitDouble(), toast });

  await requestRelease(makeRelease({ title: 'Great Album', artistCredit: 'Great Artist' }));

  assert.equal(toast.success.mock.callCount(), 1);
  const msg = toast.success.mock.calls[0].arguments[0];
  assert.match(msg, /Great Album/);
  assert.match(msg, /Great Artist/);
});

// ---------------------------------------------------------------------------
// Failure path
// ---------------------------------------------------------------------------

test('useReleaseRequest requestRelease does not mark as requested on failure', async (t) => {
  const toast = createToastDouble(t);
  const { isRequested, isRequesting, requestRelease } = useReleaseRequest({
    submitRequest: makeSubmitDouble({ throws: new Error('network error') }),
    toast,
  });
  const release = makeRelease();

  const result = await requestRelease(release);

  assert.equal(result.ok, false);
  assert.equal(isRequested(release), false);
  assert.equal(isRequesting(release), false);
});

test('useReleaseRequest requestRelease removes requesting state on failure', async (t) => {
  const toast = createToastDouble(t);
  const { isRequesting, requestRelease } = useReleaseRequest({
    submitRequest: makeSubmitDouble({ throws: new Error('timeout') }),
    toast,
  });
  const release = makeRelease();

  await requestRelease(release);

  assert.equal(isRequesting(release), false);
});

test('useReleaseRequest requestRelease shows error toast on failure', async (t) => {
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({
    submitRequest: makeSubmitDouble({ throws: new Error('server error') }),
    toast,
  });

  await requestRelease(makeRelease());

  assert.equal(toast.error.mock.callCount(), 1);
});

test('useReleaseRequest requestRelease returns { ok: false, error } on failure', async (t) => {
  const toast = createToastDouble(t);
  const err = new Error('server error');
  const { requestRelease } = useReleaseRequest({
    submitRequest: makeSubmitDouble({ throws: err }),
    toast,
  });

  const result = await requestRelease(makeRelease());

  assert.equal(result.ok, false);
  assert.equal(result.error, err);
});

// ---------------------------------------------------------------------------
// Duplicate / double-click protection
// ---------------------------------------------------------------------------

test('useReleaseRequest requestRelease skips when already in requesting state', async (t) => {
  const submitRequest = t.mock.fn(makeSubmitDouble());
  const toast = createToastDouble(t);
  const { isRequesting, requestingIds, requestRelease } = useReleaseRequest({ submitRequest, toast });
  const release = makeRelease();

  // Manually seed requestingIds to simulate an in-flight request.
  requestingIds.value = new Set(['release:mbid-release-99']);

  const result = await requestRelease(release);

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'requesting');
  assert.equal(submitRequest.mock.callCount(), 0);
  assert.equal(isRequesting(release), true);
});

test('useReleaseRequest requestRelease skips when already in requested state', async (t) => {
  const submitRequest = t.mock.fn(makeSubmitDouble());
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({
    initialRequestedIds: ['release:mbid-release-99'],
    submitRequest,
    toast,
  });

  const result = await requestRelease(makeRelease());

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'requested');
  assert.equal(submitRequest.mock.callCount(), 0);
});

test('useReleaseRequest double call while requesting sends only one API call', async (t) => {
  const submitRequest = t.mock.fn();
  let resolve;
  const pendingPromise = new Promise((r) => { resolve = r; });
  submitRequest.mock.mockImplementation(() => pendingPromise);

  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({ submitRequest, toast });
  const release = makeRelease();

  const first = requestRelease(release);
  const second = requestRelease(release); // should be skipped

  resolve({ ok: true });

  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult.ok, true);
  assert.equal(secondResult.ok, false);
  assert.equal(secondResult.skipped, true);
  assert.equal(secondResult.reason, 'requesting');
  assert.equal(submitRequest.mock.callCount(), 1);
});

// ---------------------------------------------------------------------------
// Missing required fields
// ---------------------------------------------------------------------------

test('useReleaseRequest requestRelease returns error for release with no artist name', async (t) => {
  const submitRequest = t.mock.fn(makeSubmitDouble());
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({ submitRequest, toast });

  const release = { title: 'Some Album' }; // no artist
  const result = await requestRelease(release);

  assert.equal(result.ok, false);
  assert.equal(submitRequest.mock.callCount(), 0);
});

test('useReleaseRequest requestRelease returns error for release with no title', async (t) => {
  const submitRequest = t.mock.fn(makeSubmitDouble());
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({ submitRequest, toast });

  const release = { artistCredit: 'Some Artist' }; // no title
  const result = await requestRelease(release);

  assert.equal(result.ok, false);
  assert.equal(submitRequest.mock.callCount(), 0);
});

// ---------------------------------------------------------------------------
// showToasts: false
// ---------------------------------------------------------------------------

test('useReleaseRequest does not call toast.success when showToasts is false', async (t) => {
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({
    submitRequest: makeSubmitDouble(),
    showToasts: false,
    toast,
  });

  await requestRelease(makeRelease());

  assert.equal(toast.success.mock.callCount(), 0);
});

test('useReleaseRequest does not call toast.error when showToasts is false', async (t) => {
  const toast = createToastDouble(t);
  const { requestRelease } = useReleaseRequest({
    submitRequest: makeSubmitDouble({ throws: new Error('boom') }),
    showToasts: false,
    toast,
  });

  await requestRelease(makeRelease());

  assert.equal(toast.error.mock.callCount(), 0);
});

// ---------------------------------------------------------------------------
// initialRequestedIds
// ---------------------------------------------------------------------------

test('useReleaseRequest initialRequestedIds pre-populates requestedIds', (t) => {
  const toast = createToastDouble(t);
  const { isRequested } = useReleaseRequest({
    initialRequestedIds: ['release:seed-1', 'release:seed-2'],
    toast,
  });

  assert.equal(isRequested('release:seed-1'), true);
  assert.equal(isRequested('release:seed-2'), true);
  assert.equal(isRequested('release:unknown'), false);
});

// ---------------------------------------------------------------------------
// canRequest helper
// ---------------------------------------------------------------------------

test('useReleaseRequest canRequest returns false for a release with no artist', (t) => {
  const toast = createToastDouble(t);
  const { canRequest } = useReleaseRequest({ toast });
  assert.equal(canRequest({ title: 'Album Only' }), false);
});

test('useReleaseRequest canRequest returns false for an already requested release', (t) => {
  const toast = createToastDouble(t);
  const release = makeRelease();
  const { canRequest } = useReleaseRequest({
    initialRequestedIds: ['release:mbid-release-99'],
    toast,
  });
  assert.equal(canRequest(release), false);
});

test('useReleaseRequest canRequest returns true for a valid, unseen release', (t) => {
  const toast = createToastDouble(t);
  const { canRequest } = useReleaseRequest({ toast });
  assert.equal(canRequest(makeRelease()), true);
});

// ---------------------------------------------------------------------------
// isRequesting / isRequested with key strings
// ---------------------------------------------------------------------------

test('useReleaseRequest isRequested accepts a key string directly', (t) => {
  const toast = createToastDouble(t);
  const { isRequested } = useReleaseRequest({
    initialRequestedIds: ['release:key-1'],
    toast,
  });
  assert.equal(isRequested('release:key-1'), true);
  assert.equal(isRequested('release:other'), false);
});

test('useReleaseRequest isRequesting accepts a key string directly', (t) => {
  const toast = createToastDouble(t);
  const { isRequesting, requestingIds } = useReleaseRequest({ toast });
  requestingIds.value = new Set(['release:key-2']);
  assert.equal(isRequesting('release:key-2'), true);
  assert.equal(isRequesting('release:other'), false);
});
