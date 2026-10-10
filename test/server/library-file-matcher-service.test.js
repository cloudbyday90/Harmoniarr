import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryFileMatcherService } from '../../src/server/library/library-file-matcher-service.js';
import { posix } from 'node:path';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';

const runId = '33333333-3333-4333-8333-333333333333';
const context = { runId, libraryRootId: '44444444-4444-4444-8444-444444444444',
  requestedLibraryRoot: '/data/music', libraryRootPath: '/data/music',
  expectedLease: createOperationRunLeaseFixture({ runId, jobType: 'library_scan' }) };
function source(file) {
  const canonicalPath = file.canonicalPath ?? `/data/music/${file.id}.flac`;
  return { canonicalPath, relativePath: posix.relative(context.libraryRootPath, canonicalPath),
    filename: posix.basename(canonicalPath), extension: '.flac', sizeBytes: 123, modifiedAt: null, ...file };
}
const matchFiles = (service, { files }) => service.matchLibraryFiles({ ...context, files: files.map(source) });

test('matcher captures source, tags and release scope before lookup and requires its guarded writer', async () => {
  assert.throws(() => createLibraryFileMatcherService({ libraryFileMatchStore: {} }), /guarded batch owner/u);
  const modifiedAt = new Date('2026-04-30T18:00:00.000Z');
  const file = source({ id: '11111111-1111-4111-8111-111111111111', fileState: 'observed', modifiedAt,
    scopeMetadataReleaseId: '55555555-5555-4555-8555-555555555555',
    tagPayload: { musicBrainz: { recordingId: 'original-recording' }, title: 'Foil', track: { number: 1 } } });
  let written;
  const service = createLibraryFileMatcherService({ getPoolFn: () => ({ query: async () => {
    file.tagPayload.musicBrainz.recordingId = 'changed-recording'; file.scopeMetadataReleaseId = null;
    file.sizeBytes = 999; modifiedAt.setTime(0); await Promise.resolve();
    return { rows: [createTrackLookupRow({ recording_musicbrainz_recording_id: 'original-recording' })] };
  } }), writeOwnedLibraryFileMatchBatch: async (input) => { written = input; return { libraryFileIds: [file.id] }; } });
  await service.matchLibraryFiles({ ...context, files: [file] });
  assert.equal(written.matches[0].matchedBy, 'musicbrainz_recording_id');
  assert.equal(written.matches[0].evidence.musicBrainzRecordingId, 'original-recording');
  assert.equal(written.prepared.files[0].tagPayload.musicBrainz.recordingId, 'original-recording');
  assert.equal(written.prepared.files[0].scopeMetadataReleaseId, '55555555-5555-4555-8555-555555555555');
  assert.equal(written.prepared.files[0].modifiedAt, '2026-04-30T18:00:00.000Z');
  assert.equal(written.prepared.files[0].sizeBytes, 123);
  assert.ok(Object.isFrozen(written.prepared.files[0].tagPayload.musicBrainz));
});

test('matcher propagates an owning refusal once and rejects duplicate sources before lookup', async () => {
  const error = Object.assign(new Error('The original acquisition was lost'), { code: 'operation_run_lease_lost' });
  let lookups = 0; let writes = 0;
  const service = createLibraryFileMatcherService({ getPoolFn: () => ({ query: async () => { lookups += 1; return { rows: [] }; } }),
    writeOwnedLibraryFileMatchBatch: async () => { writes += 1; throw error; } });
  const file = source({ id: '11111111-1111-4111-8111-111111111111', fileState: 'observed', tagPayload: null });
  await assert.rejects(service.matchLibraryFiles({ ...context, files: [file] }), (caught) => caught === error);
  assert.equal(lookups, 1); assert.equal(writes, 1);
  await assert.rejects(service.matchLibraryFiles({ ...context, files: [file, file] }), { code: 'library_file_match_invalid' });
  assert.equal(lookups, 1); assert.equal(writes, 1);
});

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
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
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
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'high',
    evidence: {
      musicBrainzRecordingId: 'mb-recording-1',
      strategy: 'musicbrainz_recording_id',
    },
    libraryFileId: '11111111-1111-4111-8111-111111111111',
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
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
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
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'high',
    evidence: {
      musicBrainzReleaseId: 'mb-release-1',
      normalizedTitle: 'foil',
      strategy: 'musicbrainz_release_title_track_position',
      trackPosition: 1,
    },
    libraryFileId: '11111111-1111-4111-8111-111111111111',
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
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow()],
      }),
    }),
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'medium',
    evidence: {
      matchedAlbum: 'amber',
      matchedArtist: 'autechre',
      matchedTitle: 'foil',
      matchedTrackPosition: 1,
      scopeMetadataReleaseId: null,
      strategy: 'conventional_tags',
    },
    libraryFileId: '11111111-1111-4111-8111-111111111111',
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
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [
          createTrackLookupRow({
            metadata_release_id: '55555555-5555-4555-8555-555555555555',
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
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
      scopeMetadataReleaseId: '55555555-5555-4555-8555-555555555555',
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

  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].confidence, 'high');
  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].matchedBy, 'conventional_tags');
  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].metadataReleaseId, '55555555-5555-4555-8555-555555555555');
  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].metadataTrackId, 'track-scope');
  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].evidence, {
    matchedAlbum: 'unknown album tag',
    matchedArtist: 'autechre',
    matchedTitle: 'foil',
    matchedTrackPosition: 1,
    scopeMetadataReleaseId: '55555555-5555-4555-8555-555555555555',
    strategy: 'conventional_tags',
  });
});

test('matchLibraryFiles strips conventional title suffixes before matching', async (t) => {
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow()],
      }),
    }),
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].matchStatus, 'matched');
  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].evidence.matchedTitle, 'foil');
});

test('matchLibraryFiles records ambiguous conventional tag matches instead of guessing', async (t) => {
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
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
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
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
    libraryFileId: '11111111-1111-4111-8111-111111111111',
    matchStatus: 'ambiguous',
    matchedBy: 'conventional_tags_multiple_candidates',
  });
});

test('matchLibraryFiles leaves files without conventional title tags unmatched', async (t) => {
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow()],
      }),
    }),
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'low',
    evidence: {
      reason: 'no_unique_canonical_candidate',
      releaseId: null,
      title: null,
      trackNumber: 1,
    },
    libraryFileId: '11111111-1111-4111-8111-111111111111',
    matchStatus: 'unmatched',
    matchedBy: 'no_canonical_match',
  });
});

test('matchLibraryFiles keeps MusicBrainz recording ID matches ahead of conventional matching', async (t) => {
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [createTrackLookupRow({
          recording_musicbrainz_recording_id: 'mb-recording-1',
          track_title: 'Different Canonical Title',
        })],
      }),
    }),
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].matchedBy, 'musicbrainz_recording_id');
  assert.equal(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0].confidence, 'high');
});

test('matchLibraryFiles records ambiguity instead of guessing when multiple release-local candidates remain', async (t) => {
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
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
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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

  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'low',
    evidence: {
      candidateCount: 2,
      releaseId: 'mb-release-1',
      strategy: 'release_scoped_multiple_candidates',
      title: 'Foil',
      trackNumber: 1,
    },
    libraryFileId: '11111111-1111-4111-8111-111111111111',
    matchStatus: 'ambiguous',
    matchedBy: 'release_scoped_multiple_candidates',
  });
});

test('matchLibraryFiles records unmatched files when tag payload is absent', async (t) => {
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
      tagPayload: null,
    }],
  });

  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches[0], {
    confidence: 'low',
    evidence: {
      reason: 'missing_tag_payload',
    },
    libraryFileId: '11111111-1111-4111-8111-111111111111',
    matchStatus: 'unmatched',
    matchedBy: 'missing_tag_payload',
  });
});

test('matchLibraryFiles flushes observed match results in one batch and skips ignored files', async (t) => {
  const writeOwnedLibraryFileMatchBatch = t.mock.fn(async () => {});
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
    writeOwnedLibraryFileMatchBatch,
  });

  await matchFiles(service, {
    files: [{
      fileState: 'observed',
      id: '11111111-1111-4111-8111-111111111111',
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
      id: '22222222-2222-4222-8222-222222222222',
      tagPayload: null,
    }],
  });

  assert.equal(writeOwnedLibraryFileMatchBatch.mock.callCount(), 1);
  assert.deepEqual(writeOwnedLibraryFileMatchBatch.mock.calls[0].arguments[0].matches, [{
    confidence: 'high',
    evidence: {
      musicBrainzRecordingId: 'mb-recording-1',
      strategy: 'musicbrainz_recording_id',
    },
    libraryFileId: '11111111-1111-4111-8111-111111111111',
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
    libraryFileId: '22222222-2222-4222-8222-222222222222',
    matchStatus: 'unmatched',
    matchedBy: 'missing_tag_payload',
  }]);
});
