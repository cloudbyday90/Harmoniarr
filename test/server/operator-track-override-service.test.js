import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperatorTrackOverrideService,
  normalizeOperatorTrackOverridePatch,
} from '../../src/server/metadata/operator-track-override-service.js';

test('normalizeOperatorTrackOverridePatch validates track-mbid based overrides', () => {
  const result = normalizeOperatorTrackOverridePatch({
    isDesired: true,
    mediumPosition: 1,
    metadataReleaseId: 'release-1',
    recordingMbid: '11111111-1111-4111-8111-111111111111',
    remapStatus: 'REVIEW_NEEDED',
    trackLengthMsSnapshot: 215000,
    trackMbid: '22222222-2222-4222-8222-222222222222',
    trackPosition: 4,
    trackTitleSnapshot: ' Example Song ',
  });

  assert.deepEqual(result, {
    isDesired: true,
    mediumPosition: 1,
    metadataReleaseId: 'release-1',
    recordingMbid: '11111111-1111-4111-8111-111111111111',
    remapStatus: 'review_needed',
    trackLengthMsSnapshot: 215000,
    trackMbid: '22222222-2222-4222-8222-222222222222',
    trackPosition: 4,
    trackTitleSnapshot: 'Example Song',
  });
});

test('normalizeOperatorTrackOverridePatch requires fallback identity when trackMbid is omitted', () => {
  assert.throws(
    () => normalizeOperatorTrackOverridePatch({
      isDesired: true,
      recordingMbid: '11111111-1111-4111-8111-111111111111',
    }),
    {
      code: 'validation_error',
      message: 'mediumPosition and trackPosition are required when trackMbid is not provided',
      status: 400,
    },
  );
});

test('updateOperatorTrackOverride validates release-group and release membership before persisting', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }

    if (sql.includes('SELECT id FROM metadata_artists')) {
      return { rows: [{ id: 'artist-1' }] };
    }

    if (sql.includes('FROM metadata_release_groups')) {
      assert.deepEqual(params, ['release-group-1']);
      return { rows: [{ id: 'release-group-1', metadata_artist_id: 'artist-1' }] };
    }

    if (sql.includes('FROM metadata_releases')) {
      assert.deepEqual(params, ['release-1', 'release-group-1']);
      return { rows: [{ id: 'release-1' }] };
    }

    return { rows: [] };
  });
  const upsertOperatorTrackOverride = t.mock.fn(async () => {});
  const service = createOperatorTrackOverrideService({
    getPoolFn: () => ({ query }),
    operatorTrackOverrideStore: {
      getOperatorTrackOverride: async () => null,
      upsertOperatorTrackOverride,
    },
  });

  const result = await service.updateOperatorTrackOverride({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    patch: {
      isDesired: true,
      mediumPosition: 1,
      metadataReleaseId: 'release-1',
      recordingMbid: '11111111-1111-4111-8111-111111111111',
      trackLengthMsSnapshot: 215000,
      trackMbid: '22222222-2222-4222-8222-222222222222',
      trackPosition: 4,
      trackTitleSnapshot: 'Example Song',
    },
  });

  assert.deepEqual(upsertOperatorTrackOverride.mock.calls[0].arguments[0], {
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
  assert.deepEqual(result, {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    override: {
      isDesired: true,
      mediumPosition: 1,
      metadataReleaseId: 'release-1',
      recordingMbid: '11111111-1111-4111-8111-111111111111',
      remapStatus: 'resolved',
      trackLengthMsSnapshot: 215000,
      trackMbid: '22222222-2222-4222-8222-222222222222',
      trackPosition: 4,
      trackTitleSnapshot: 'Example Song',
    },
  });
});

test('updateOperatorTrackOverride rejects release groups that do not belong to the requested artist', async () => {
  const service = createOperatorTrackOverrideService({
    getPoolFn: () => ({
      query: async (sql) => {
        if (sql.includes('FROM app_users')) {
          return { rows: [{ id: 'user-1' }] };
        }

        if (sql.includes('SELECT id FROM metadata_artists')) {
          return { rows: [{ id: 'artist-1' }] };
        }

        if (sql.includes('FROM metadata_release_groups')) {
          return { rows: [{ id: 'release-group-1', metadata_artist_id: 'artist-2' }] };
        }

        return { rows: [] };
      },
    }),
    operatorTrackOverrideStore: {
      getOperatorTrackOverride: async () => null,
      upsertOperatorTrackOverride: async () => {},
    },
  });

  await assert.rejects(
    service.updateOperatorTrackOverride({
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      patch: {
        isDesired: true,
        mediumPosition: 1,
        recordingMbid: '11111111-1111-4111-8111-111111111111',
        trackPosition: 4,
      },
    }),
    {
      code: 'validation_error',
      message: 'Release group release-group-1 does not belong to artist artist-1',
      status: 400,
    },
  );
});

test('updateOperatorTrackOverride rejects resolved releases outside the release group', async () => {
  const service = createOperatorTrackOverrideService({
    getPoolFn: () => ({
      query: async (sql) => {
        if (sql.includes('FROM app_users')) {
          return { rows: [{ id: 'user-1' }] };
        }

        if (sql.includes('SELECT id FROM metadata_artists')) {
          return { rows: [{ id: 'artist-1' }] };
        }

        if (sql.includes('FROM metadata_release_groups')) {
          return { rows: [{ id: 'release-group-1', metadata_artist_id: 'artist-1' }] };
        }

        if (sql.includes('FROM metadata_releases')) {
          return { rows: [] };
        }

        return { rows: [] };
      },
    }),
    operatorTrackOverrideStore: {
      getOperatorTrackOverride: async () => null,
      upsertOperatorTrackOverride: async () => {},
    },
  });

  await assert.rejects(
    service.updateOperatorTrackOverride({
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      patch: {
        isDesired: true,
        mediumPosition: 1,
        metadataReleaseId: 'release-9',
        recordingMbid: '11111111-1111-4111-8111-111111111111',
        trackPosition: 4,
      },
    }),
    {
      code: 'validation_error',
      message: 'Resolved release release-9 does not belong to release group release-group-1',
      status: 400,
    },
  );
});
