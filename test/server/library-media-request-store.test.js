import assert from 'node:assert/strict';
import test from 'node:test';

import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';

test('library media request store joins matched artists through release groups', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    if (params.length > 1) {
      return {
        rows: [{
          id: 'request-1',
        }],
      };
    }

    return {
      rows: [{
        artist_name: 'Autechre',
        created_at: '2026-05-04T00:00:00.000Z',
        evidence: {},
        id: 'request-1',
        matched_artist_name: 'Autechre',
        matched_metadata_release_group_id: 'group-1',
        matched_metadata_release_id: 'release-1',
        matched_release_group_id: 'group-1',
        matched_release_group_title: 'Amber',
        matched_release_title: 'Amber',
        normalized_query: 'autechre amber',
        notes: null,
        release_title: 'Amber',
        request_kind: 'release',
        request_state: 'needs_fetch',
        requested_by_role: 'admin',
        requested_by_user_id: 'admin-1',
        requested_by_username: 'smoke-admin',
        requested_for_role: 'requester',
        requested_for_user_id: 'user-1',
        requested_for_username: 'smoke-listener',
        source_provider: null,
        source_url: null,
        track_title: null,
        updated_at: '2026-05-04T00:00:00.000Z',
      }],
    };
  });
  const store = createLibraryMediaRequestStore({
    getPoolFn: () => ({ query }),
  });

  const mediaRequest = await store.createMediaRequest({
    artistName: 'Autechre',
    evidence: {},
    matchedMetadataReleaseGroupId: 'group-1',
    matchedMetadataReleaseId: 'release-1',
    normalizedQuery: 'autechre amber',
    notes: null,
    releaseTitle: 'Amber',
    requestKind: 'release',
    requestState: 'needs_fetch',
    requestedByUserId: 'admin-1',
    requestedForUserId: 'user-1',
    sourceProvider: null,
    sourceUrl: null,
    trackTitle: null,
  });

  assert.equal(query.mock.callCount(), 2);
  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO media_requests/);
  assert.match(query.mock.calls[1].arguments[0], /matched_artists\.id = matched_release_groups\.metadata_artist_id/);
  assert.doesNotMatch(query.mock.calls[1].arguments[0], /matched_releases\.metadata_artist_id/);
  assert.deepEqual(query.mock.calls[1].arguments[1], ['request-1']);
  assert.equal(mediaRequest.existingMatch.artistName, 'Autechre');
  assert.equal(mediaRequest.existingMatch.releaseId, 'release-1');
});

test('cancelFanOutChildren updates only cancellable children of a parent request', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.match(sql, /UPDATE media_requests/);
    assert.match(sql, /fan_out_parent_id = \$1/);
    assert.match(sql, /request_state = 'cancelled'/);
    assert.equal(params[0], 'parent-1');
    assert.deepEqual(params.slice(1), ['needs_fetch', 'needs_review']);

    return {
      rows: [{ id: 'child-1' }, { id: 'child-2' }],
    };
  });

  const store = createLibraryMediaRequestStore({
    getPoolFn: () => ({ query }),
  });

  const cancelledIds = await store.cancelFanOutChildren({
    parentMediaRequestId: 'parent-1',
    cancellableStates: ['needs_fetch', 'needs_review'],
  });

  assert.deepEqual(cancelledIds, ['child-1', 'child-2']);
  assert.equal(query.mock.callCount(), 1);
});

test('cancelFanOutChildren returns empty array when no children match', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));

  const store = createLibraryMediaRequestStore({
    getPoolFn: () => ({ query }),
  });

  const cancelledIds = await store.cancelFanOutChildren({
    parentMediaRequestId: 'parent-1',
    cancellableStates: ['needs_fetch', 'needs_review'],
  });

  assert.deepEqual(cancelledIds, []);
  assert.equal(query.mock.callCount(), 1);
});

test('listMediaRequestEvents returns events with hasMore false when under limit', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [
      { id: 'evt-1', event_type: 'reassigned', previous_requested_for_user_id: null, new_requested_for_user_id: 'u-2', reason: null, actor_user_id: 'admin-1', details: null, occurred_at: '2026-05-22T12:00:00Z', actor_username: 'admin' },
      { id: 'evt-2', event_type: 'cancelled', previous_requested_for_user_id: null, new_requested_for_user_id: null, reason: 'done', actor_user_id: 'u-1', details: null, occurred_at: '2026-05-22T11:00:00Z', actor_username: 'listener' },
    ],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const result = await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 50 });

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].id, 'evt-1');
  assert.equal(result.events[0].eventType, 'reassigned');
  assert.equal(result.events[1].id, 'evt-2');
  assert.equal(result.hasMore, false);
  assert.equal(result.nextCursor, null);
  assert.equal(query.mock.callCount(), 1);
  assert.match(query.mock.calls[0].arguments[0], /ORDER BY media_request_events\.occurred_at DESC, media_request_events\.id DESC/);
  assert.equal(query.mock.calls[0].arguments[1][0], 'req-1');
  assert.equal(query.mock.calls[0].arguments[1][1], 51);
});

test('listMediaRequestEvents returns hasMore true and nextCursor when results exceed limit', async (t) => {
  const rows = [];
  for (let i = 0; i <= 3; i++) {
    rows.push({
      id: `evt-${i}`,
      event_type: 'reassigned',
      previous_requested_for_user_id: null,
      new_requested_for_user_id: `u-${i}`,
      reason: null,
      actor_user_id: 'admin-1',
      details: null,
      occurred_at: new Date(Date.now() - i * 60000).toISOString(),
      actor_username: 'admin',
    });
  }

  const query = t.mock.fn(async () => ({ rows }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const result = await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 3 });

  assert.equal(result.events.length, 3);
  assert.equal(result.hasMore, true);
  assert.ok(result.nextCursor);
  assert.equal(result.events.length, 3);
  assert.equal(query.mock.calls[0].arguments[1][1], 4);
});

test('listMediaRequestEvents with cursor adds keyset filter', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [
      { id: 'evt-5', event_type: 'created', previous_requested_for_user_id: null, new_requested_for_user_id: null, reason: null, actor_user_id: 'u-1', details: null, occurred_at: '2026-05-22T10:00:00Z', actor_username: 'listener' },
    ],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });

  const cursor = Buffer.from(JSON.stringify({ o: '2026-05-22T11:00:00Z', i: 'evt-2' })).toString('base64url');
  const result = await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 50, cursor });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, 'evt-5');
  assert.equal(result.hasMore, false);
  assert.equal(query.mock.callCount(), 1);

  const sql = query.mock.calls[0].arguments[0];
  assert.match(sql, /\(media_request_events\.occurred_at, media_request_events\.id\) < \(\$2, \$3\)/);
  const params = query.mock.calls[0].arguments[1];
  assert.equal(params[0], 'req-1');
  assert.equal(params[1], '2026-05-22T11:00:00Z');
  assert.equal(params[2], 'evt-2');
});

test('listMediaRequestEvents with invalid cursor falls back to initial query', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [
      { id: 'evt-1', event_type: 'created', previous_requested_for_user_id: null, new_requested_for_user_id: null, reason: null, actor_user_id: 'u-1', details: null, occurred_at: '2026-05-22T12:00:00Z', actor_username: 'listener' },
    ],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const result = await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 50, cursor: 'not-valid-base64!!!' });

  assert.equal(result.events.length, 1);
  assert.equal(query.mock.callCount(), 1);
  const sql = query.mock.calls[0].arguments[0];
  assert.doesNotMatch(sql, /< \(\$2, \$3\)/);
});