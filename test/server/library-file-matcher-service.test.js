import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryFileMatcherService } from '../../src/server/library/library-file-matcher-service.js';

function createTrackLookupRow(overrides = {}) {
  return {
    metadata_artist_id: 'artist-1',
    metadata_medium_id: 'medium-1',
    metadata_recording_id: 'recording-1',
    metadata_release_group_id: 'release-group-1',
    metadata_release_id: 'release-1',
    metadata_track_id: 'track-1',
    musicbrainz_release_id: 'mb-release-1',
    recording_musicbrainz_recording_id: null,
    release_artist_name: 'Autechre',
    release_title: 'Amber',
    track_artist_credit: 'Autechre',
    track_position: 1,
    track_title: 'Foil',
    ...overrides,
  };
}

test('matchLibraryFiles prefers exact MusicBrainz recording matches when present', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          metadata_artist_id: 'artist-1',
          metadata_medium_id: 'medium-1',
          metadata_recording_id: 'recording-1',
          metadata_release_group_id: 'release-group-1',
          metadata_release_id: 'release-1',
          metadata_track_id: 'track-1',
          musicbrainz_release_id: 'mb-release-1',
          recording_musicbrainz_recording_id: 'mb-recording-1',
          release_artist_name: 'Autechre',
          release_title: 'Amber',
          track_artist_credit: 'Autechre',
          track_position: 1,
          track_title: 'Foil',
        }],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        musicBrainz: {
          recordingId: 'mb-recording-1',
          releaseId: 'mb-release-1',
        },
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'high',
    evidence: {
      musicBrainzRecordingId: 'mb-recording-1',
      strategy: 'musicbrainz_recording_id',
    },
    libraryFileId: 'file-1',
    matchStatus: 'matched',
    matchedBy: 'musicbrainz_recording_id',
    metadataArtistId: 'artist-1',
    metadataMediumId: 'medium-1',
    metadataRecordingId: 'recording-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    metadataTrackId: 'track-1',
  });
});

test('matchLibraryFiles falls back to release-local title and track position only when there is a unique candidate', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          metadata_artist_id: 'artist-1',
          metadata_medium_id: 'medium-1',
          metadata_recording_id: 'recording-1',
          metadata_release_group_id: 'release-group-1',
          metadata_release_id: 'release-1',
          metadata_track_id: 'track-1',
          musicbrainz_release_id: 'mb-release-1',
          recording_musicbrainz_recording_id: null,
          release_artist_name: 'Autechre',
          release_title: 'Amber',
          track_artist_credit: 'Autechre',
          track_position: 1,
          track_title: 'Foil',
        }],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        musicBrainz: {
          releaseId: 'mb-release-1',
        },
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'high',
    evidence: {
      musicBrainzReleaseId: 'mb-release-1',
      normalizedTitle: 'foil',
      strategy: 'musicbrainz_release_title_track_position',
      trackPosition: 1,
    },
    libraryFileId: 'file-1',
    matchStatus: 'matched',
    matchedBy: 'musicbrainz_release_title_track_position',
    metadataArtistId: 'artist-1',
    metadataMediumId: 'medium-1',
    metadataRecordingId: 'recording-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    metadataTrackId: 'track-1',
  });
});

test('matchLibraryFiles matches conventional title, track number, and album artist tags without MusicBrainz IDs', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow()],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        album: 'Amber',
        albumArtist: 'Autechre',
        musicBrainz: {},
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'medium',
    evidence: {
      matchedAlbum: 'amber',
      matchedArtist: 'autechre',
      matchedTitle: 'foil',
      matchedTrackPosition: 1,
      scopeMetadataReleaseId: null,
      strategy: 'conventional_tags',
    },
    libraryFileId: 'file-1',
    matchStatus: 'matched',
    matchedBy: 'conventional_tags',
    metadataArtistId: 'artist-1',
    metadataMediumId: 'medium-1',
    metadataRecordingId: 'recording-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    metadataTrackId: 'track-1',
  });
});

test('matchLibraryFiles uses scopeMetadataReleaseId for high-confidence conventional tag matches', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [
          createTrackLookupRow({
            metadata_release_id: 'release-scope',
            metadata_track_id: 'track-scope',
            release_title: 'Amber',
            track_title: 'Foil',
          }),
          createTrackLookupRow({
            metadata_release_id: 'release-other',
            metadata_track_id: 'track-other',
            release_title: 'Live Archive',
            track_title: 'Foil',
          }),
        ],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      scopeMetadataReleaseId: 'release-scope',
      tagPayload: {
        album: 'Unknown Album Tag',
        albumArtist: 'Autechre',
        musicBrainz: {},
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].confidence, 'high');
  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].matchedBy, 'conventional_tags');
  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].metadataReleaseId, 'release-scope');
  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].metadataTrackId, 'track-scope');
  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].evidence, {
    matchedAlbum: 'unknown album tag',
    matchedArtist: 'autechre',
    matchedTitle: 'foil',
    matchedTrackPosition: 1,
    scopeMetadataReleaseId: 'release-scope',
    strategy: 'conventional_tags',
  });
});

test('matchLibraryFiles strips conventional title suffixes before matching', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow()],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        albumArtist: 'Autechre',
        musicBrainz: {},
        title: 'Foil (feat. Guest Artist)',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].matchStatus, 'matched');
  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].evidence.matchedTitle, 'foil');
});

test('matchLibraryFiles records ambiguous conventional tag matches instead of guessing', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [
          createTrackLookupRow({
            metadata_release_id: 'release-1',
            metadata_track_id: 'track-1',
            release_title: 'Amber',
          }),
          createTrackLookupRow({
            metadata_release_id: 'release-2',
            metadata_track_id: 'track-2',
            release_title: 'Peel Session',
          }),
        ],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        albumArtist: 'Autechre',
        musicBrainz: {},
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'low',
    evidence: {
      candidateCount: 2,
      matchedAlbum: null,
      matchedArtist: 'autechre',
      matchedTitle: 'foil',
      matchedTrackPosition: 1,
      scopeMetadataReleaseId: null,
      strategy: 'conventional_tags_multiple_candidates',
    },
    libraryFileId: 'file-1',
    matchStatus: 'ambiguous',
    matchedBy: 'conventional_tags_multiple_candidates',
  });
});

test('matchLibraryFiles leaves files without conventional title tags unmatched', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow()],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        albumArtist: 'Autechre',
        musicBrainz: {},
        title: null,
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'low',
    evidence: {
      reason: 'no_unique_canonical_candidate',
      releaseId: null,
      title: null,
      trackNumber: 1,
    },
    libraryFileId: 'file-1',
    matchStatus: 'unmatched',
    matchedBy: 'no_canonical_match',
  });
});

test('matchLibraryFiles keeps MusicBrainz recording ID matches ahead of conventional matching', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow({
          recording_musicbrainz_recording_id: 'mb-recording-1',
          track_title: 'Different Canonical Title',
        })],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        albumArtist: 'Different Artist',
        musicBrainz: {
          recordingId: 'mb-recording-1',
        },
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].matchedBy, 'musicbrainz_recording_id');
  assert.equal(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].confidence, 'high');
});

test('matchLibraryFiles records ambiguity instead of guessing when multiple release-local candidates remain', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [
          {
            metadata_artist_id: 'artist-1',
            metadata_medium_id: 'medium-1',
            metadata_recording_id: 'recording-1',
            metadata_release_group_id: 'release-group-1',
            metadata_release_id: 'release-1',
            metadata_track_id: 'track-1',
            musicbrainz_release_id: 'mb-release-1',
            recording_musicbrainz_recording_id: null,
            release_artist_name: 'Autechre',
            release_title: 'Amber',
            track_artist_credit: 'Autechre',
            track_position: 1,
            track_title: 'Foil',
          },
          {
            metadata_artist_id: 'artist-1',
            metadata_medium_id: 'medium-2',
            metadata_recording_id: 'recording-2',
            metadata_release_group_id: 'release-group-1',
            metadata_release_id: 'release-1',
            metadata_track_id: 'track-2',
            musicbrainz_release_id: 'mb-release-1',
            recording_musicbrainz_recording_id: null,
            release_artist_name: 'Autechre',
            release_title: 'Amber',
            track_artist_credit: 'Autechre',
            track_position: 1,
            track_title: 'Foil',
          },
        ],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        musicBrainz: {
          releaseId: 'mb-release-1',
        },
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }],
  });

  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'low',
    evidence: {
      candidateCount: 2,
      releaseId: 'mb-release-1',
      strategy: 'release_scoped_multiple_candidates',
      title: 'Foil',
      trackNumber: 1,
    },
    libraryFileId: 'file-1',
    matchStatus: 'ambiguous',
    matchedBy: 'release_scoped_multiple_candidates',
  });
});

test('matchLibraryFiles records unmatched files when tag payload is absent', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: null,
    }],
  });

  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'low',
    evidence: {
      reason: 'missing_tag_payload',
    },
    libraryFileId: 'file-1',
    matchStatus: 'unmatched',
    matchedBy: 'missing_tag_payload',
  });
});

test('matchLibraryFiles flushes observed match results in one batch and skips ignored files', async (t) => {
  const writeLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          metadata_artist_id: 'artist-1',
          metadata_medium_id: 'medium-1',
          metadata_recording_id: 'recording-1',
          metadata_release_group_id: 'release-group-1',
          metadata_release_id: 'release-1',
          metadata_track_id: 'track-1',
          musicbrainz_release_id: 'mb-release-1',
          recording_musicbrainz_recording_id: 'mb-recording-1',
          release_artist_name: 'Autechre',
          release_title: 'Amber',
          track_artist_credit: 'Autechre',
          track_position: 1,
          track_title: 'Foil',
        }],
      }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatchBatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: {
        musicBrainz: {
          recordingId: 'mb-recording-1',
        },
        title: 'Foil',
        track: {
          number: 1,
        },
      },
    }, {
      fileState: 'ignored',
      id: 'file-ignored',
      tagPayload: {
        title: 'Ignored',
      },
    }, {
      fileState: 'observed',
      id: 'file-2',
      tagPayload: null,
    }],
  });

  assert.equal(writeLibraryFileMatchBatch.mock.callCount(), 1);
  assert.deepEqual(writeLibraryFileMatchBatch.mock.calls[0].arguments[0].matches, [{
    confidence: 'high',
    evidence: {
      musicBrainzRecordingId: 'mb-recording-1',
      strategy: 'musicbrainz_recording_id',
    },
    libraryFileId: 'file-1',
    matchStatus: 'matched',
    matchedBy: 'musicbrainz_recording_id',
    metadataArtistId: 'artist-1',
    metadataMediumId: 'medium-1',
    metadataRecordingId: 'recording-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    metadataTrackId: 'track-1',
  }, {
    confidence: 'low',
    evidence: {
      reason: 'missing_tag_payload',
    },
    libraryFileId: 'file-2',
    matchStatus: 'unmatched',
    matchedBy: 'missing_tag_payload',
  }]);
});
