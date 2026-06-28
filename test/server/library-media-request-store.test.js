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

test('createMediaRequest normalizes partial expected release dates before insert', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    if (params.length > 1) {
      assert.equal(params[16], '2000-01-01');
      return {
        rows: [{ id: 'request-1' }],
      };
    }

    return {
      rows: [{
        artist_name: 'Autechre',
        created_at: '2026-05-04T00:00:00.000Z',
        evidence: {},
        expected_release_date: '2000-01-01',
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

  await store.createMediaRequest({
    artistName: 'Autechre',
    evidence: {},
    expectedReleaseDate: '2000',
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

test('listMediaRequestEvents with cursor returns empty results and hasMore false when no rows match keyset', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const cursor = Buffer.from(JSON.stringify({ o: '2026-05-22T08:00:00Z', i: 'evt-old' })).toString('base64url');
  const result = await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 50, cursor });

  assert.equal(result.events.length, 0);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextCursor, null);
  const sql = query.mock.calls[0].arguments[0];
  assert.match(sql, /\(media_request_events\.occurred_at, media_request_events\.id\) < \(\$2, \$3\)/);
});

test('listMediaRequestEvents with valid cursor containing non-date value falls back gracefully', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [
      { id: 'evt-1', event_type: 'created', previous_requested_for_user_id: null, new_requested_for_user_id: null, reason: null, actor_user_id: 'u-1', details: null, occurred_at: '2026-05-22T12:00:00Z', actor_username: 'listener' },
    ],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const cursor = Buffer.from(JSON.stringify({ o: '', i: '' })).toString('base64url');
  const result = await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 50, cursor });

  assert.equal(result.events.length, 1);
  assert.equal(result.hasMore, false);
  const sql = query.mock.calls[0].arguments[0];
  assert.doesNotMatch(sql, /< \(\$2, \$3\)/);
});

test('listMediaRequestEvents clamps NaN limit to default', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });

  await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: Number.NaN });

  const params = query.mock.calls[0].arguments[1];
  assert.equal(params[params.length - 1], 51);
});

test('listMediaRequestEvents clamps negative limit to 1', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });

  await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: -5 });

  const params = query.mock.calls[0].arguments[1];
  assert.equal(params[params.length - 1], 2);
});

test('listMediaRequestEvents clamps limit exceeding max to MAX_EVENT_PAGE_LIMIT', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });

  await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 999 });

  const params = query.mock.calls[0].arguments[1];
  assert.equal(params[params.length - 1], 101);
});

test('listMediaRequestEvents uses safeLimit for hasMore and row slicing', async (t) => {
  const rows = Array.from({ length: 4 }, (_, i) => ({
    id: `evt-${i}`,
    event_type: 'created',
    previous_requested_for_user_id: null,
    new_requested_for_user_id: null,
    reason: null,
    actor_user_id: 'u-1',
    details: null,
    occurred_at: new Date(Date.now() - i * 60000).toISOString(),
    actor_username: 'listener',
  }));

  const query = t.mock.fn(async () => ({ rows }));
  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });

  const result = await store.listMediaRequestEvents({ mediaRequestId: 'req-1', limit: 3 });

  assert.equal(result.events.length, 3);
  assert.equal(result.hasMore, true);
  assert.ok(result.nextCursor);
  assert.equal(query.mock.calls[0].arguments[1][1], 4);
});

function makeRequestRow(overrides = {}) {
  return {
    id: overrides.id ?? 'req-1',
    request_kind: 'release',
    request_state: 'needs_fetch',
    artist_name: 'Artist',
    release_title: 'Album',
    track_title: null,
    source_url: null,
    source_provider: null,
    normalized_query: 'artist album',
    matched_metadata_release_group_id: null,
    matched_metadata_release_id: null,
    notes: null,
    evidence: {},
    created_at: overrides.created_at ?? '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    musicbrainz_release_id: null,
    linked_request_id: null,
    expected_release_date: null,
    fan_out_parent_id: null,
    fan_out_child_count: 0,
    requested_by_user_id: 'admin-1',
    requested_by_username: 'admin',
    requested_by_role: 'admin',
    requested_for_user_id: 'user-1',
    requested_for_username: 'listener',
    requested_for_role: 'requester',
    matched_release_group_id: null,
    matched_release_group_title: null,
    matched_release_title: null,
    matched_musicbrainz_release_id: null,
    matched_artist_name: null,
    ...overrides,
  };
}

test('listMediaRequests without cursor returns offset-based results without hasMore/nextCursor', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [makeRequestRow({ id: 'req-1' }), makeRequestRow({ id: 'req-2' })],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const result = await store.listMediaRequests({ limit: 10, offset: 0 });

  assert.equal(result.mediaRequests.length, 2);
  assert.equal(result.mediaRequests[0].id, 'req-1');
  assert.equal('hasMore' in result, false);
  assert.equal('nextCursor' in result, false);
  assert.equal(query.mock.callCount(), 1);

  const sql = query.mock.calls[0].arguments[0];
  assert.match(sql, /LIMIT \$\d+/);
  assert.match(sql, /OFFSET \$\d+/);
});

test('listMediaRequests with cursor uses keyset filter and returns hasMore false when under limit', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [makeRequestRow({ id: 'req-3', created_at: '2026-05-01T00:00:00Z' })],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const cursor = Buffer.from(JSON.stringify({ c: '2026-05-02T00:00:00Z', i: 'req-2' })).toString('base64url');
  const result = await store.listMediaRequests({ limit: 10, cursor });

  assert.equal(result.mediaRequests.length, 1);
  assert.equal(result.mediaRequests[0].id, 'req-3');
  assert.equal(result.hasMore, false);
  assert.equal(result.nextCursor, null);
  assert.equal(query.mock.callCount(), 1);

  const sql = query.mock.calls[0].arguments[0];
  assert.match(sql, /\(media_requests\.created_at, media_requests\.id\) < \(\$1, \$2\)/);
  assert.match(sql, /LIMIT \$3/);
  assert.doesNotMatch(sql, /OFFSET/);

  const params = query.mock.calls[0].arguments[1];
  assert.equal(params[0], '2026-05-02T00:00:00Z');
  assert.equal(params[1], 'req-2');
  assert.equal(params[2], 11);
});

test('listMediaRequests with cursor returns hasMore true and nextCursor when results exceed limit', async (t) => {
  const rows = [];
  for (let i = 0; i <= 3; i++) {
    rows.push(makeRequestRow({ id: `req-${i}`, created_at: new Date(Date.now() - i * 60000).toISOString() }));
  }

  const query = t.mock.fn(async () => ({ rows }));
  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });

  const cursor = Buffer.from(JSON.stringify({ c: '2026-05-02T00:00:00Z', i: 'req-prev' })).toString('base64url');
  const result = await store.listMediaRequests({ limit: 3, cursor });

  assert.equal(result.mediaRequests.length, 3);
  assert.equal(result.hasMore, true);
  assert.ok(result.nextCursor);

  const decoded = JSON.parse(Buffer.from(result.nextCursor, 'base64url').toString('utf8'));
  assert.equal(decoded.i, 'req-2');
  assert.equal(decoded.c, rows[2].created_at);

  assert.equal(query.mock.calls[0].arguments[1][2], 4);
});

test('listMediaRequests with cursor and filters applies keyset after WHERE clause', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [makeRequestRow({ id: 'req-5', created_at: '2026-05-01T00:00:00Z' })],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const cursor = Buffer.from(JSON.stringify({ c: '2026-05-02T00:00:00Z', i: 'req-4' })).toString('base64url');
  const result = await store.listMediaRequests({
    limit: 10,
    cursor,
    requestedForUserId: 'user-1',
    requestState: 'needs_fetch',
  });

  assert.equal(result.mediaRequests.length, 1);
  assert.equal(result.mediaRequests[0].id, 'req-5');
  assert.equal(result.hasMore, false);

  const sql = query.mock.calls[0].arguments[0];
  assert.match(sql, /WHERE/);
  assert.match(sql, /requested_for_user_id = \$1/);
  assert.match(sql, /AND \(media_requests\.created_at, media_requests\.id\) < \(\$3, \$4\)/);

  const params = query.mock.calls[0].arguments[1];
  assert.equal(params[0], 'user-1');
  assert.equal(params[1], 'needs_fetch');
  assert.equal(params[2], '2026-05-02T00:00:00Z');
  assert.equal(params[3], 'req-4');
});

test('listMediaRequests with invalid cursor falls back to offset-based query', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [makeRequestRow({ id: 'req-1' })],
  }));

  const store = createLibraryMediaRequestStore({ getPoolFn: () => ({ query }) });
  const result = await store.listMediaRequests({ limit: 10, cursor: 'not-valid-base64!!!' });

  assert.equal(result.mediaRequests.length, 1);
  assert.equal('hasMore' in result, false);
  assert.equal('nextCursor' in result, false);

  const sql = query.mock.calls[0].arguments[0];
  assert.doesNotMatch(sql, /\(media_requests\.created_at, media_requests\.id\) < \(/);
  assert.match(sql, /OFFSET/);
});

test('listActiveRequestsByMetadataReleaseIds returns non-terminal requests for targeted releases', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    assert.deepEqual(params, [['release-1', 'release-2']]);
    return {
      rows: [makeRequestRow({
        id: 'req-active',
        matched_artist_name: 'Autechre',
        matched_metadata_release_id: 'release-1',
        matched_release_group_id: 'group-1',
        matched_release_group_title: 'Amber',
        matched_release_title: 'Amber',
        request_state: 'needs_fetch',
      })],
    };
  });
  const store = createLibraryMediaRequestStore({
    getPoolFn: () => ({ query }),
  });

  const requests = await store.listActiveRequestsByMetadataReleaseIds({
    metadataReleaseIds: ['release-1', 'release-2'],
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].id, 'req-active');
  assert.equal(requests[0].existingMatch.releaseId, 'release-1');
  assert.equal(requests[0].requestState, 'needs_fetch');
});
