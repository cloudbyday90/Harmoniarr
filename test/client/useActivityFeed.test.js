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
import { useActivityFeed } from '../../src/client/composables/useActivityFeed.js';

function makeEvent(overrides = {}) {
  return {
    id: 'evt-1',
    eventType: 'request_created',
    actorUserId: 'user-1',
    entityType: 'media_request',
    entityId: 'req-1',
    entityTitle: 'OK Computer',
    entityArtist: 'Radiohead',
    extraPayload: null,
    occurredAt: '2026-06-01T11:00:00.000Z',
    ...overrides,
  };
}

function makeFeedPayload(overrides = {}) {
  return {
    ok: true,
    checkedAt: '2026-06-01T12:00:00.000Z',
    events: [],
    total: 0,
    ...overrides,
  };
}

// ── initial state ─────────────────────────────────────────────────────────────

test('useActivityFeed: starts with empty state and no loading', () => {
  const feed = useActivityFeed({ fetchFeedFn: async () => makeFeedPayload() });

  assert.deepEqual(feed.events.value, []);
  assert.equal(feed.isLoading.value, false);
  assert.equal(feed.errorMessage.value, '');
  assert.equal(feed.checkedAt.value, null);
  assert.equal(feed.total.value, 0);
});

test('useActivityFeed: hasEvents is false and isEmpty is true before load', () => {
  const feed = useActivityFeed({ fetchFeedFn: async () => makeFeedPayload() });

  assert.equal(feed.hasEvents.value, false);
  assert.equal(feed.isEmpty.value, true);
});

// ── loading lifecycle ─────────────────────────────────────────────────────────

test('useActivityFeed: load sets isLoading during fetch and clears it after', async () => {
  let resolveP;
  const blocker = new Promise((r) => { resolveP = r; });
  const fetchFeedFn = async () => { await blocker; return makeFeedPayload(); };
  const feed = useActivityFeed({ fetchFeedFn });

  const loadPromise = feed.load();
  assert.equal(feed.isLoading.value, true);

  resolveP(undefined);
  await loadPromise;
  assert.equal(feed.isLoading.value, false);
});

test('useActivityFeed: load clears errorMessage before fetching', async () => {
  // First load fails, second succeeds
  let callCount = 0;
  const fetchFeedFn = async () => {
    callCount += 1;
    if (callCount === 1) throw new Error('Network error');
    return makeFeedPayload();
  };
  const feed = useActivityFeed({ fetchFeedFn });

  await feed.load(); // fails
  assert.ok(feed.errorMessage.value.length > 0);

  await feed.load(); // succeeds — error should be cleared
  assert.equal(feed.errorMessage.value, '');
});

// ── successful load ───────────────────────────────────────────────────────────

test('useActivityFeed: load populates events from the API response', async () => {
  const event = makeEvent();
  const feed = useActivityFeed({
    fetchFeedFn: async () => makeFeedPayload({ events: [event], total: 1 }),
  });

  await feed.load();

  assert.equal(feed.events.value.length, 1);
  assert.equal(feed.events.value[0].id, 'evt-1');
  assert.equal(feed.total.value, 1);
});

test('useActivityFeed: load normalizes events via normalizeActivityEvent', async () => {
  const rawEvent = {
    id: 'evt-2',
    eventType: 'artist_monitored',
    entityTitle: 'Aphex Twin',
    // missing optional fields — normalizer should fill with null
  };
  const feed = useActivityFeed({
    fetchFeedFn: async () => makeFeedPayload({ events: [rawEvent] }),
  });

  await feed.load();

  const normalized = feed.events.value[0];
  assert.equal(normalized.id, 'evt-2');
  assert.equal(normalized.actorUserId, null);
  assert.equal(normalized.entityArtist, null);
});

test('useActivityFeed: load sets checkedAt from the payload', async () => {
  const feed = useActivityFeed({
    fetchFeedFn: async () => makeFeedPayload({ checkedAt: '2026-06-01T08:00:00.000Z' }),
  });

  await feed.load();

  assert.equal(feed.checkedAt.value, '2026-06-01T08:00:00.000Z');
});

test('useActivityFeed: hasEvents becomes true after events are loaded', async () => {
  const event = makeEvent();
  const feed = useActivityFeed({
    fetchFeedFn: async () => makeFeedPayload({ events: [event] }),
  });

  await feed.load();

  assert.equal(feed.hasEvents.value, true);
  assert.equal(feed.isEmpty.value, false);
});

test('useActivityFeed: load handles missing events field gracefully', async () => {
  const feed = useActivityFeed({
    fetchFeedFn: async () => ({ ok: true, checkedAt: '2026-06-01T12:00:00.000Z', total: 0 }),
  });

  await feed.load();

  assert.deepEqual(feed.events.value, []);
  assert.equal(feed.hasEvents.value, false);
});

// ── error handling ────────────────────────────────────────────────────────────

test('useActivityFeed: load sets errorMessage on API error', async () => {
  const feed = useActivityFeed({
    fetchFeedFn: async () => { throw new Error('API unavailable'); },
  });

  await feed.load();

  assert.ok(feed.errorMessage.value.length > 0);
  assert.equal(feed.isLoading.value, false);
});

test('useActivityFeed: load clears events and total on error', async () => {
  // Prime with data first
  const event = makeEvent();
  let callCount = 0;
  const fetchFeedFn = async () => {
    callCount += 1;
    if (callCount === 1) return makeFeedPayload({ events: [event], total: 1 });
    throw new Error('Now broken');
  };
  const feed = useActivityFeed({ fetchFeedFn });

  await feed.load(); // success
  assert.equal(feed.events.value.length, 1);

  await feed.load(); // error
  assert.deepEqual(feed.events.value, []);
  assert.equal(feed.total.value, 0);
  assert.equal(feed.checkedAt.value, null);
});

// ── limit option ──────────────────────────────────────────────────────────────

test('useActivityFeed: uses default limit of 50 when not specified', async (t) => {
  const fetchFeedFn = t.mock.fn(async () => makeFeedPayload());
  const feed = useActivityFeed({ fetchFeedFn });

  await feed.load();

  const [{ limit }] = fetchFeedFn.mock.calls[0].arguments;
  assert.equal(limit, 50);
});

test('useActivityFeed: uses provided limit option', async (t) => {
  const fetchFeedFn = t.mock.fn(async () => makeFeedPayload());
  const feed = useActivityFeed({ fetchFeedFn, limit: 10 });

  await feed.load();

  const [{ limit }] = fetchFeedFn.mock.calls[0].arguments;
  assert.equal(limit, 10);
});

// ── injectable fetchFeedFn ────────────────────────────────────────────────────

test('useActivityFeed: uses the injected fetchFeedFn instead of the default', async (t) => {
  const fetchFeedFn = t.mock.fn(async () => makeFeedPayload());
  const feed = useActivityFeed({ fetchFeedFn });

  await feed.load();

  assert.equal(fetchFeedFn.mock.callCount(), 1);
});
