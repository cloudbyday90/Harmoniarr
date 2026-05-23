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
import { useMediaRequestReassignment } from '../../src/client/composables/useMediaRequestReassignment.js';

function makeFetchHistoryFn(events = []) {
  return async () => ({ ok: true, events });
}

function makeFetchUsersFn(users = []) {
  return async () => ({ ok: true, users });
}

function makeReassignFn(result) {
  return async () => ({ ok: true, mediaRequest: result });
}

function makeUser(overrides = {}) {
  return {
    id: 'u-1',
    username: 'alice',
    role: 'requester',
    mediaRequestTarget: { eligible: true },
    ...overrides,
  };
}

function makeEvent(overrides = {}) {
  return {
    id: 'evt-1',
    eventType: 'reassigned',
    previousRequestedForUserId: 'u-1',
    newRequestedForUserId: 'u-2',
    reason: null,
    actorUserId: 'admin-1',
    actorUsername: 'admin',
    details: null,
    occurredAt: '2026-05-22T12:00:00Z',
    ...overrides,
  };
}

test('useMediaRequestReassignment loadHistory populates events', async () => {
  const evt = makeEvent();
  const { events, loadHistory } = useMediaRequestReassignment({
    fetchHistoryFn: makeFetchHistoryFn([evt]),
  });

  await loadHistory({ mediaRequestId: 'req-1' });

  assert.equal(events.value.length, 1);
  assert.equal(events.value[0].eventType, 'reassigned');
});

test('useMediaRequestReassignment loadHistory handles empty events', async () => {
  const { events, loadHistory } = useMediaRequestReassignment({
    fetchHistoryFn: makeFetchHistoryFn([]),
  });

  await loadHistory({ mediaRequestId: 'req-1' });

  assert.equal(events.value.length, 0);
});

test('useMediaRequestReassignment loadHistory sets error on failure', async () => {
  const { historyError, loadHistory } = useMediaRequestReassignment({
    fetchHistoryFn: async () => { throw new Error('server error'); },
  });

  await loadHistory({ mediaRequestId: 'req-1' });

  assert.equal(historyError.value, 'server error');
});

test('useMediaRequestReassignment loadHistory clears error before fetch', async () => {
  let callCount = 0;
  const { historyError, loadHistory } = useMediaRequestReassignment({
    fetchHistoryFn: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('first fail');
      return { ok: true, events: [] };
    },
  });

  await loadHistory({ mediaRequestId: 'req-1' });
  assert.equal(historyError.value, 'first fail');

  await loadHistory({ mediaRequestId: 'req-1' });
  assert.equal(historyError.value, '');
});

test('useMediaRequestReassignment loadEligibleUsers filters by eligibility', async () => {
  const eligible = makeUser({ id: 'u-1', username: 'eligible' });
  const ineligible = makeUser({ id: 'u-2', username: 'ineligible', mediaRequestTarget: { eligible: false } });
  const { eligibleUsers, loadEligibleUsers } = useMediaRequestReassignment({
    fetchUsersFn: makeFetchUsersFn([eligible, ineligible]),
  });

  await loadEligibleUsers();

  assert.equal(eligibleUsers.value.length, 1);
  assert.equal(eligibleUsers.value[0].username, 'eligible');
});

test('useMediaRequestReassignment loadEligibleUsers is idempotent', async () => {
  let fetchCount = 0;
  const { loadEligibleUsers } = useMediaRequestReassignment({
    fetchUsersFn: async () => {
      fetchCount += 1;
      return { ok: true, users: [makeUser()] };
    },
  });

  await loadEligibleUsers();
  await loadEligibleUsers();

  assert.equal(fetchCount, 1);
});

test('useMediaRequestReassignment loadEligibleUsers sets error on failure', async () => {
  const { usersError, loadEligibleUsers } = useMediaRequestReassignment({
    fetchUsersFn: async () => { throw new Error('network'); },
  });

  await loadEligibleUsers();

  assert.equal(usersError.value, 'network');
});

test('useMediaRequestReassignment reassign returns result on success', async () => {
  const mockResult = { id: 'req-1', requestedForUser: { id: 'u-2' } };
  const { reassign, reassignResult } = useMediaRequestReassignment({
    reassignFn: makeReassignFn(mockResult),
  });

  const result = await reassign({
    mediaRequestId: 'req-1',
    newRequestedForUserId: 'u-2',
    reason: null,
  });

  assert.deepEqual(result, mockResult);
  assert.deepEqual(reassignResult.value, mockResult);
});

test('useMediaRequestReassignment reassign returns null on failure', async () => {
  const { reassign, reassignError, reassignResult } = useMediaRequestReassignment({
    reassignFn: async () => { throw new Error('conflict'); },
  });

  const result = await reassign({
    mediaRequestId: 'req-1',
    newRequestedForUserId: 'u-2',
    reason: null,
  });

  assert.equal(result, null);
  assert.equal(reassignResult.value, null);
  assert.equal(reassignError.value, 'conflict');
});

test('useMediaRequestReassignment reassign clears previous error', async () => {
  let callCount = 0;
  const { reassign, reassignError } = useMediaRequestReassignment({
    reassignFn: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('fail');
      return { ok: true, mediaRequest: { id: 'req-1' } };
    },
  });

  await reassign({ mediaRequestId: 'req-1', newRequestedForUserId: 'u-2', reason: null });
  assert.equal(reassignError.value, 'fail');

  await reassign({ mediaRequestId: 'req-1', newRequestedForUserId: 'u-2', reason: null });
  assert.equal(reassignError.value, '');
});

test('useMediaRequestReassignment reset clears all state', async () => {
  const evt = makeEvent();
  const { events, historyError, reassignError, reassignResult, reset, loadHistory } = useMediaRequestReassignment({
    fetchHistoryFn: makeFetchHistoryFn([evt]),
  });

  await loadHistory({ mediaRequestId: 'req-1' });
  assert.equal(events.value.length, 1);

  reset();

  assert.equal(events.value.length, 0);
  assert.equal(historyError.value, '');
  assert.equal(reassignError.value, '');
  assert.equal(reassignResult.value, null);
});

test('useMediaRequestReassignment isLoadingHistory is false initially', () => {
  const { isLoadingHistory } = useMediaRequestReassignment();
  assert.equal(isLoadingHistory.value, false);
});

test('useMediaRequestReassignment isReassigning is false initially', () => {
  const { isReassigning } = useMediaRequestReassignment();
  assert.equal(isReassigning.value, false);
});
