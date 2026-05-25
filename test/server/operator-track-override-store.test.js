import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';

test('getOperatorTrackOverride resolves track-mbid keyed overrides', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      app_user_id: 'user-1',
      id: 'override-1',
      is_desired: true,
      medium_position: 1,
      metadata_artist_id: 'artist-1',
      metadata_release_group_id: 'release-group-1',
      metadata_release_id: 'release-1',
      recording_mbid: '11111111-1111-4111-8111-111111111111',
      remap_status: 'resolved',
      track_length_ms_snapshot: 215000,
      track_mbid: '22222222-2222-4222-8222-222222222222',
      track_position: 4,
      track_title_snapshot: 'Example Song',
    }],
  }));
  const store = createOperatorTrackOverrideStore({ getPoolFn: () => ({ query }) });

  const result = await store.getOperatorTrackOverride({
    appUserId: 'user-1',
    metadataReleaseGroupId: 'release-group-1',
    trackMbid: '22222222-2222-4222-8222-222222222222',
  });

  assert.deepEqual(result, {
    appUserId: 'user-1',
    id: 'override-1',
    isDesired: true,
    mediumPosition: 1,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    recordingMbid: '11111111-1111-4111-8111-111111111111',
    remapStatus: 'resolved',
    trackLengthMsSnapshot: 215000,
    trackMbid: '22222222-2222-4222-8222-222222222222',
    trackPosition: 4,
    trackTitleSnapshot: 'Example Song',
  });
});

test('getOperatorTrackOverride resolves fallback recording identity overrides', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createOperatorTrackOverrideStore({ getPoolFn: () => ({ query }) });

  const result = await store.getOperatorTrackOverride({
    appUserId: 'user-1',
    mediumPosition: 1,
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    recordingMbid: '11111111-1111-4111-8111-111111111111',
    trackPosition: 4,
  });

  assert.equal(result, null);
  assert.match(query.mock.calls[0].arguments[0], /metadata_release_id IS NOT DISTINCT FROM \$3/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'user-1',
    'release-group-1',
    'release-1',
    '11111111-1111-4111-8111-111111111111',
    1,
    4,
  ]);
});

test('upsertOperatorTrackOverride replaces by logical identity and inserts the new row', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const connect = t.mock.fn(async () => ({ query, release }));
  const store = createOperatorTrackOverrideStore({
    getPoolFn: () => ({ connect }),
  });

  await store.upsertOperatorTrackOverride({
    appUserId: 'user-1',
    isDesired: true,
    mediumPosition: 1,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    recordingMbid: '11111111-1111-4111-8111-111111111111',
    remapStatus: 'resolved',
    trackLengthMsSnapshot: 215000,
    trackMbid: '22222222-2222-4222-8222-222222222222',
    trackPosition: 4,
    trackTitleSnapshot: 'Example Song',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /DELETE FROM operator_track_override/);
  assert.deepEqual(query.mock.calls[1].arguments[1], [
    'user-1',
    'release-group-1',
    '22222222-2222-4222-8222-222222222222',
  ]);
  assert.match(query.mock.calls[2].arguments[0], /INSERT INTO operator_track_override/);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('listOperatorTrackOverrides filters by operator and artist when requested', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      app_user_id: 'user-1',
      id: 'override-1',
      is_desired: false,
      medium_position: 1,
      metadata_artist_id: 'artist-1',
      metadata_release_group_id: 'release-group-1',
      metadata_release_id: 'release-1',
      recording_mbid: '11111111-1111-4111-8111-111111111111',
      remap_status: 'resolved',
      track_length_ms_snapshot: 215000,
      track_mbid: '22222222-2222-4222-8222-222222222222',
      track_position: 4,
      track_title_snapshot: 'Example Song',
    }],
  }));
  const store = createOperatorTrackOverrideStore({ getPoolFn: () => ({ query }) });

  const result = await store.listOperatorTrackOverrides({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.match(query.mock.calls[0].arguments[0], /WHERE app_user_id = \$1 AND metadata_artist_id = \$2/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['user-1', 'artist-1']);
  assert.equal(result.length, 1);
  assert.equal(result[0].isDesired, false);
});

test('replaceOperatorTrackOverridesSnapshot replaces the snapshot transactionally', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const connect = t.mock.fn(async () => ({ query, release }));
  const store = createOperatorTrackOverrideStore({
    getPoolFn: () => ({ connect }),
  });

  await store.replaceOperatorTrackOverridesSnapshot({
    operatorTrackOverrides: [{
      appUserId: 'user-1',
      isDesired: false,
      mediumPosition: 1,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: 'release-1',
      recordingMbid: '11111111-1111-4111-8111-111111111111',
      remapStatus: 'review_needed',
      trackLengthMsSnapshot: 215000,
      trackMbid: null,
      trackPosition: 4,
      trackTitleSnapshot: 'Example Song',
    }],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.equal(query.mock.calls[1].arguments[0], 'DELETE FROM operator_track_override');
  assert.match(query.mock.calls[2].arguments[0], /INSERT INTO operator_track_override/);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});
