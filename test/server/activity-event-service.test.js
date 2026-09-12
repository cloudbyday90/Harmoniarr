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
import { createActivityEventService } from '../../src/server/activity/activity-event-service.js';

// Null stderr stub that records written output for assertion.
function createTestStderr() {
  const lines = [];
  return {
    write(msg) { lines.push(msg); },
    lines,
  };
}

// Minimal store stub factory.
function createStubStore(overrides = {}) {
  return {
    insertActivityEvent: async () => ({ id: 'evt-1' }),
    listActivityEvents: async () => [],
    deleteExpiredActivityEvents: async () => ({ deleted: 0 }),
    ...overrides,
  };
}

// ── recordActivityEvent ───────────────────────────────────────────────────────

test('recordActivityEvent: resolves without throwing for valid eventType', async () => {
  const store = createStubStore();
  const service = createActivityEventService({ activityEventStore: store });
  assert.deepEqual(await service.recordActivityEvent({ eventType: 'request_created' }), { recorded: true });
});

test('recordActivityEvent: calls insertActivityEvent with provided fields', async (t) => {
  const insertActivityEvent = t.mock.fn(async () => ({ id: 'evt-x' }));
  const store = createStubStore({ insertActivityEvent });
  const service = createActivityEventService({ activityEventStore: store });

  await service.recordActivityEvent({
    eventType: 'artist_monitored',
    actorUserId: 'user-1',
    entityType: 'artist',
    entityId: 'mbid-artist-1',
    entityTitle: 'Radiohead',
    entityArtist: null,
    extraPayload: null,
  });

  assert.equal(insertActivityEvent.mock.callCount(), 1);
  const [args] = insertActivityEvent.mock.calls[0].arguments;
  assert.equal(args.eventType, 'artist_monitored');
  assert.equal(args.actorUserId, 'user-1');
  assert.equal(args.entityTitle, 'Radiohead');
});

test('recordActivityEvent: skips insert and logs for unknown eventType', async (t) => {
  const insertActivityEvent = t.mock.fn(async () => ({}));
  const stderr = createTestStderr();
  const store = createStubStore({ insertActivityEvent });
  const service = createActivityEventService({ activityEventStore: store, stderr });

  assert.deepEqual(await service.recordActivityEvent({ eventType: 'not_a_real_event' }), { recorded: false });

  assert.equal(insertActivityEvent.mock.callCount(), 0);
  assert.deepEqual(JSON.parse(stderr.lines[0]), { event: 'activity_event_recording_failed', reason: 'unsupported_event_type', eventType: null });
});

test('recordActivityEvent: catches store errors and logs them, never throws', async () => {
  const stderr = createTestStderr();
  const store = createStubStore({
    insertActivityEvent: async () => { throw new Error('DB is down'); },
  });
  const service = createActivityEventService({ activityEventStore: store, stderr });

  assert.deepEqual(await service.recordActivityEvent({ eventType: 'download_completed' }), { recorded: false });
  assert.deepEqual(JSON.parse(stderr.lines[0]), { event: 'activity_event_recording_failed', reason: 'recording_failed', eventType: 'download_completed' });
});

test('recordActivityEvent: handles each allowed event type without throwing', async () => {
  const allowedTypes = [
    'request_created',
    'download_completed',
    'release_added',
    'artist_monitored',
    'artist_policy_saved',
    'music_queue_quality_blocked',
    'quality_fallback_allowed',
    'music_queue_search_queued',
    'music_queue_search_started',
    'music_queue_download_retrying',
    'music_queue_match_retrying',
    'music_queue_no_matches_left',
    'music_queue_download_failed',
    'music_queue_import_blocked',
    'request_fulfilled',
  ];

  for (const eventType of allowedTypes) {
    const store = createStubStore();
    const service = createActivityEventService({ activityEventStore: store });
    await assert.doesNotReject(
      () => service.recordActivityEvent({ eventType }),
      `eventType "${eventType}" should be accepted`,
    );
  }
});

// ── buildActivityFeed ─────────────────────────────────────────────────────────

test('buildActivityFeed: returns checkedAt, empty events, and total 0 when store returns nothing', async () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  const store = createStubStore({ listActivityEvents: async () => [] });
  const service = createActivityEventService({ activityEventStore: store, getNow: () => now });

  const result = await service.buildActivityFeed({});

  assert.equal(result.checkedAt, '2026-06-01T12:00:00.000Z');
  assert.deepEqual(result.events, []);
  assert.equal(result.total, 0);
});

test('buildActivityFeed: returns events from the store in the order received', async () => {
  const events = [
    { id: 'evt-1', eventType: 'request_created', occurredAt: '2026-06-01T11:00:00.000Z' },
    { id: 'evt-2', eventType: 'artist_monitored', occurredAt: '2026-06-01T10:00:00.000Z' },
  ];
  const store = createStubStore({ listActivityEvents: async () => events });
  const service = createActivityEventService({ activityEventStore: store });

  const result = await service.buildActivityFeed({});

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].id, 'evt-1');
  assert.equal(result.events[1].id, 'evt-2');
  assert.equal(result.total, 2);
});

test('buildActivityFeed: clamps limit above max to 200', async (t) => {
  const listActivityEvents = t.mock.fn(async () => []);
  const store = createStubStore({ listActivityEvents });
  const service = createActivityEventService({ activityEventStore: store });

  await service.buildActivityFeed({ limit: 99999 });

  const [{ limit }] = listActivityEvents.mock.calls[0].arguments;
  assert.equal(limit, 200);
});

test('buildActivityFeed: uses default limit of 50 when limit is omitted', async (t) => {
  const listActivityEvents = t.mock.fn(async () => []);
  const store = createStubStore({ listActivityEvents });
  const service = createActivityEventService({ activityEventStore: store });

  await service.buildActivityFeed({});

  const [{ limit }] = listActivityEvents.mock.calls[0].arguments;
  assert.equal(limit, 50);
});

test('buildActivityFeed: uses default limit of 50 when limit is non-positive', async (t) => {
  const listActivityEvents = t.mock.fn(async () => []);
  const store = createStubStore({ listActivityEvents });
  const service = createActivityEventService({ activityEventStore: store });

  await service.buildActivityFeed({ limit: 0 });

  const [{ limit }] = listActivityEvents.mock.calls[0].arguments;
  assert.equal(limit, 50);
});

test('buildActivityFeed: forwards a valid eventType filter to the store', async (t) => {
  const listActivityEvents = t.mock.fn(async () => []);
  const store = createStubStore({ listActivityEvents });
  const service = createActivityEventService({ activityEventStore: store });

  await service.buildActivityFeed({ eventType: 'release_added' });

  const [{ eventType }] = listActivityEvents.mock.calls[0].arguments;
  assert.equal(eventType, 'release_added');
});

test('buildActivityFeed: passes null eventType to store for unknown filter values', async (t) => {
  const listActivityEvents = t.mock.fn(async () => []);
  const store = createStubStore({ listActivityEvents });
  const service = createActivityEventService({ activityEventStore: store });

  await service.buildActivityFeed({ eventType: 'definitely_not_valid' });

  const [{ eventType }] = listActivityEvents.mock.calls[0].arguments;
  assert.equal(eventType, null);
});

test('buildActivityFeed: passes null actorUserId when not provided', async (t) => {
  const listActivityEvents = t.mock.fn(async () => []);
  const store = createStubStore({ listActivityEvents });
  const service = createActivityEventService({ activityEventStore: store });

  await service.buildActivityFeed({});

  const [{ actorUserId }] = listActivityEvents.mock.calls[0].arguments;
  assert.equal(actorUserId, null);
});

test('buildActivityFeed: forwards actorUserId when provided', async (t) => {
  const listActivityEvents = t.mock.fn(async () => []);
  const store = createStubStore({ listActivityEvents });
  const service = createActivityEventService({ activityEventStore: store });

  await service.buildActivityFeed({ actorUserId: 'user-42' });

  const [{ actorUserId }] = listActivityEvents.mock.calls[0].arguments;
  assert.equal(actorUserId, 'user-42');
});

test('recordActivityEvent logs no raw exception, identifier, payload or unknown event text', async () => {
  const stderr = createTestStderr();
  const hostileError = new Error('token=secret database://user:password@host');
  Object.defineProperty(hostileError, 'message', { get() { throw new Error('Must never inspect exception messages'); } });
  const service = createActivityEventService({ stderr, activityEventStore: createStubStore({ insertActivityEvent: async () => { throw hostileError; } }) });
  assert.deepEqual(await service.recordActivityEvent({ eventType: 'artist_policy_saved', actorUserId: 'private-actor',
    entityTitle: 'private-title', extraPayload: { accessToken: 'private-token' } }), { recorded: false });
  assert.deepEqual(await service.recordActivityEvent({ eventType: 'secret\nforged-log-line' }), { recorded: false });
  assert.equal(stderr.lines.length, 2);
  for (const line of stderr.lines) {
    assert.doesNotMatch(line, /private|secret|password|forged|database/u);
    assert.equal(line.split('\n').length, 2, 'Each diagnostic occupies one JSON line');
  }
});

test('recordActivityEvent remains nonthrowing when diagnostic writers throw or reject', async () => {
  for (const write of [() => { throw new Error('closed sink'); }, async () => { throw new Error('failed async sink'); }]) {
    const service = createActivityEventService({ stderr: { write }, activityEventStore: createStubStore({
      insertActivityEvent: async () => { throw new Error('insert failed'); },
    }) });
    assert.deepEqual(await service.recordActivityEvent({ eventType: 'artist_monitored' }), { recorded: false });
    assert.deepEqual(await service.recordActivityEvent({ eventType: 'invalid' }), { recorded: false });
  }
  await new Promise((resolve) => { setImmediate(resolve); });
});

test('recordActivityEvent rejects malformed inputs safely without attempting persistence', async () => {
  let inserts = 0;
  const service = createActivityEventService({ stderr: createTestStderr(), activityEventStore: createStubStore({
    insertActivityEvent: async () => { inserts += 1; },
  }) });
  const throwingInput = Object.defineProperty({}, 'eventType', { get() { throw new Error('private input'); } });
  for (const input of [undefined, null, {}, throwingInput]) {
    assert.deepEqual(await service.recordActivityEvent(input), { recorded: false });
  }
  assert.equal(inserts, 0);
});
