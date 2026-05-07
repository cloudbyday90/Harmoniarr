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
import { useMyRequestNotifications } from '../../src/client/composables/useMyRequestNotifications.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(overrides = {}) {
  return {
    id: 'media-request:req-1:delegated',
    category: 'delegated_request',
    message: 'Admin requested Amber for you.',
    occurredAt: '2026-05-07T10:00:00Z',
    severity: 'info',
    title: 'Music requested for you',
    reference: { mediaRequestId: 'req-1', type: 'media_request' },
    ...overrides,
  };
}

function makeSummaryPayload({ notifications = [], total = 0, checkedAt = '2026-05-07T10:00:00Z' } = {}) {
  return {
    ok: true,
    scope: 'mine',
    counts: { totalRequests: 1, alreadyExists: 0, needsFetch: 1, needsReview: 0 },
    fulfillmentCounts: { active: 0, failed: 0, satisfied: 0, underReview: 0 },
    notificationFeed: {
      checkedAt,
      counts: {
        byCategory: {
          delegated_request: notifications.filter((n) => n.category === 'delegated_request').length,
          failure: notifications.filter((n) => n.category === 'failure').length,
          fulfillment: notifications.filter((n) => n.category === 'fulfillment').length,
          review: notifications.filter((n) => n.category === 'review').length,
        },
        total,
      },
      notifications,
    },
    recentRequests: [],
    summary: { message: 'ok', status: 'active' },
  };
}

// ---------------------------------------------------------------------------
// load — happy path
// ---------------------------------------------------------------------------

test('useMyRequestNotifications load populates notifications from notificationFeed', async (t) => {
  const n = makeNotification();
  const fetchSummaryFn = t.mock.fn(async () => makeSummaryPayload({ notifications: [n], total: 1 }));

  const { notifications, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();

  assert.equal(notifications.value.length, 1);
  assert.equal(notifications.value[0].id, 'media-request:req-1:delegated');
  assert.equal(notifications.value[0].category, 'delegated_request');
});

test('useMyRequestNotifications load populates counts from notificationFeed', async (t) => {
  const n = makeNotification();
  const fetchSummaryFn = t.mock.fn(async () => makeSummaryPayload({ notifications: [n], total: 1 }));

  const { counts, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();

  assert.equal(counts.value.total, 1);
  assert.equal(counts.value.byCategory.delegated_request, 1);
});

test('useMyRequestNotifications load populates checkedAt from notificationFeed', async (t) => {
  const fetchSummaryFn = t.mock.fn(async () =>
    makeSummaryPayload({ checkedAt: '2026-05-07T12:30:00Z' }),
  );

  const { checkedAt, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();

  assert.equal(checkedAt.value, '2026-05-07T12:30:00Z');
});

test('useMyRequestNotifications load sets isLoading correctly around the fetch', async (t) => {
  let resolvePromise;
  const slowFetch = async () => {
    await new Promise((resolve) => {
      resolvePromise = resolve;
    });
    return makeSummaryPayload();
  };

  const { isLoading, load } = useMyRequestNotifications({ fetchSummaryFn: slowFetch });

  assert.equal(isLoading.value, false, 'starts false');
  const loadPromise = load();
  assert.equal(isLoading.value, true, 'true during fetch');
  resolvePromise();
  await loadPromise;
  assert.equal(isLoading.value, false, 'false after fetch');
});

// ---------------------------------------------------------------------------
// load — error handling
// ---------------------------------------------------------------------------

test('useMyRequestNotifications load sets errorMessage when fetchSummaryFn rejects', async (t) => {
  const fetchSummaryFn = t.mock.fn(async () => {
    throw new Error('network timeout');
  });

  const { errorMessage, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();

  assert.equal(errorMessage.value, 'network timeout');
});

test('useMyRequestNotifications load clears notifications and counts on error', async (t) => {
  // First load succeeds to populate state
  let callCount = 0;
  const fetchSummaryFn = t.mock.fn(async () => {
    callCount++;
    if (callCount === 1) return makeSummaryPayload({ notifications: [makeNotification()], total: 1 });
    throw new Error('server error');
  });

  const { notifications, counts, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();
  assert.equal(notifications.value.length, 1);

  await load();
  assert.equal(notifications.value.length, 0, 'notifications cleared on error');
  assert.equal(counts.value.total, 0, 'count reset to 0 on error');
});

test('useMyRequestNotifications load resets errorMessage before each new fetch', async (t) => {
  let callCount = 0;
  const fetchSummaryFn = t.mock.fn(async () => {
    callCount++;
    if (callCount === 1) throw new Error('first error');
    return makeSummaryPayload();
  });

  const { errorMessage, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();
  assert.equal(errorMessage.value, 'first error');

  await load();
  assert.equal(errorMessage.value, '', 'error cleared after successful second call');
});

// ---------------------------------------------------------------------------
// load — missing / partial payload
// ---------------------------------------------------------------------------

test('useMyRequestNotifications load handles missing notificationFeed gracefully', async (t) => {
  const fetchSummaryFn = t.mock.fn(async () => ({
    ok: true,
    scope: 'mine',
    counts: { totalRequests: 0 },
    // notificationFeed intentionally absent
  }));

  const { notifications, counts, checkedAt, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();

  assert.deepEqual(notifications.value, []);
  assert.equal(counts.value.total, 0);
  assert.equal(checkedAt.value, null);
});

test('useMyRequestNotifications load handles notificationFeed with no notifications array', async (t) => {
  const fetchSummaryFn = t.mock.fn(async () => ({
    ok: true,
    scope: 'mine',
    notificationFeed: {
      checkedAt: '2026-05-07T00:00:00Z',
      counts: { total: 0, byCategory: {} },
      // notifications field absent
    },
  }));

  const { notifications, load } = useMyRequestNotifications({ fetchSummaryFn });

  await load();

  assert.deepEqual(notifications.value, []);
});
