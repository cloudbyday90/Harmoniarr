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
import { useMyRequests } from '../../src/client/composables/useMyRequests.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides = {}) {
  return {
    id: 'req-1',
    requestState: 'needs_fetch',
    releaseTitle: 'Amber',
    artistName: 'Autechre',
    requestKind: 'release',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

function createFetchDouble(mediaRequests = []) {
  return async () => ({ ok: true, mediaRequests, scope: 'mine' });
}

// ---------------------------------------------------------------------------
// loadRequests — happy path
// ---------------------------------------------------------------------------

test('useMyRequests loadRequests populates requests from API response', async (t) => {
  const fetchRequests = t.mock.fn(createFetchDouble([makeRequest(), makeRequest({ id: 'req-2', releaseTitle: 'Tri Repetae' })]));

  const { requests, isLoading, loadRequests } = useMyRequests({ fetchRequests });

  await loadRequests();

  assert.equal(requests.value.length, 2);
  assert.equal(requests.value[0].releaseTitle, 'Amber');
  assert.equal(requests.value[1].releaseTitle, 'Tri Repetae');
  assert.equal(isLoading.value, false);
});

test('useMyRequests loadRequests passes limit to fetchRequests', async (t) => {
  const fetchRequests = t.mock.fn(createFetchDouble([]));

  const { loadRequests } = useMyRequests({ limit: 20, fetchRequests });
  await loadRequests();

  assert.equal(fetchRequests.mock.callCount(), 1);
  const args = fetchRequests.mock.calls[0].arguments[0];
  assert.equal(args.limit, 20);
});

test('useMyRequests loadRequests defaults to limit 50', async (t) => {
  const fetchRequests = t.mock.fn(createFetchDouble([]));

  const { loadRequests } = useMyRequests({ fetchRequests });
  await loadRequests();

  assert.equal(fetchRequests.mock.calls[0].arguments[0].limit, 50);
});

test('useMyRequests loadRequests forwards signal to fetchRequests', async (t) => {
  const fetchRequests = t.mock.fn(createFetchDouble([]));
  const controller = new AbortController();

  const { loadRequests } = useMyRequests({ fetchRequests });
  await loadRequests({ signal: controller.signal });

  const args = fetchRequests.mock.calls[0].arguments[0];
  assert.equal(args.signal, controller.signal);
});

test('useMyRequests isLoading is true before loadRequests is called', () => {
  const { isLoading } = useMyRequests({ fetchRequests: async () => ({}) });
  assert.equal(isLoading.value, true);
});

test('useMyRequests loadRequests sets isLoading false on success', async (t) => {
  const { isLoading, loadRequests } = useMyRequests({
    fetchRequests: t.mock.fn(createFetchDouble([])),
  });

  await loadRequests();

  assert.equal(isLoading.value, false);
});

test('useMyRequests loadRequests treats missing mediaRequests array as empty', async () => {
  const { requests, loadRequests } = useMyRequests({
    fetchRequests: async () => ({}),
  });

  await loadRequests();

  assert.deepEqual(requests.value, []);
});

// ---------------------------------------------------------------------------
// hasRequests computed
// ---------------------------------------------------------------------------

test('useMyRequests hasRequests is false when requests is empty', async (t) => {
  const { hasRequests, loadRequests } = useMyRequests({
    fetchRequests: t.mock.fn(createFetchDouble([])),
  });

  await loadRequests();

  assert.equal(hasRequests.value, false);
});

test('useMyRequests hasRequests is true when requests are populated', async (t) => {
  const { hasRequests, loadRequests } = useMyRequests({
    fetchRequests: t.mock.fn(createFetchDouble([makeRequest()])),
  });

  await loadRequests();

  assert.equal(hasRequests.value, true);
});

// ---------------------------------------------------------------------------
// loadRequests — error handling
// ---------------------------------------------------------------------------

test('useMyRequests loadRequests sets errorMessage on failure', async () => {
  const { errorMessage, isLoading, loadRequests } = useMyRequests({
    fetchRequests: async () => { throw new Error('network timeout'); },
  });

  await loadRequests();

  assert.equal(errorMessage.value, 'network timeout');
  assert.equal(isLoading.value, false);
});

test('useMyRequests loadRequests uses fallback message when error is not an Error instance', async () => {
  const { errorMessage, loadRequests } = useMyRequests({
    fetchRequests: async () => { throw 'string error'; },
  });

  await loadRequests();

  assert.equal(errorMessage.value, 'Could not load your requests.');
});

test('useMyRequests loadRequests clears requests to empty on failure', async () => {
  const { requests, loadRequests } = useMyRequests({
    fetchRequests: async () => { throw new Error('gone'); },
  });

  await loadRequests();

  assert.deepEqual(requests.value, []);
});

// ---------------------------------------------------------------------------
// Reload — clears stale error
// ---------------------------------------------------------------------------

test('useMyRequests loadRequests clears previous errorMessage on successful reload', async () => {
  let callCount = 0;
  const fetchRequests = async ({ limit }) => {
    callCount++;
    if (callCount === 1) throw new Error('first call failed');
    return createFetchDouble([makeRequest()])({ limit });
  };

  const { requests, errorMessage, loadRequests } = useMyRequests({ fetchRequests });

  await loadRequests();
  assert.ok(errorMessage.value.length > 0, 'should have error after first load');

  await loadRequests();
  assert.equal(errorMessage.value, '');
  assert.equal(requests.value.length, 1);
});
