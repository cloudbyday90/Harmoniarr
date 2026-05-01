import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryFileMatcherService } from '../../src/server/library/library-file-matcher-service.js';

test('matchLibraryFiles prefers exact MusicBrainz recording matches when present', async (t) => {
  const writeLibraryFileMatch = t.mock.fn(async () => {});
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
    libraryFileMatchStore: { writeLibraryFileMatch },
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

  assert.deepEqual(writeLibraryFileMatch.mock.calls[0].arguments[0], {
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
  const writeLibraryFileMatch = t.mock.fn(async () => {});
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
    libraryFileMatchStore: { writeLibraryFileMatch },
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

  assert.deepEqual(writeLibraryFileMatch.mock.calls[0].arguments[0], {
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

test('matchLibraryFiles records ambiguity instead of guessing when multiple release-local candidates remain', async (t) => {
  const writeLibraryFileMatch = t.mock.fn(async () => {});
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
    libraryFileMatchStore: { writeLibraryFileMatch },
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

  assert.deepEqual(writeLibraryFileMatch.mock.calls[0].arguments[0], {
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
  const writeLibraryFileMatch = t.mock.fn(async () => {});
  const service = createLibraryFileMatcherService({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
    libraryFileMatchStore: { writeLibraryFileMatch },
  });

  await service.matchLibraryFiles({
    files: [{
      fileState: 'observed',
      id: 'file-1',
      tagPayload: null,
    }],
  });

  assert.deepEqual(writeLibraryFileMatch.mock.calls[0].arguments[0], {
    confidence: 'low',
    evidence: {
      reason: 'missing_tag_payload',
    },
    libraryFileId: 'file-1',
    matchStatus: 'unmatched',
    matchedBy: 'missing_tag_payload',
  });
});