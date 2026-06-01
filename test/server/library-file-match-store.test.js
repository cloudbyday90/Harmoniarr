import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryFileMatchStore } from '../../src/server/library/library-file-match-store.js';

test('writeLibraryFileMatch upserts the current canonical match projection for a library file', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryFileMatchStore({
    getPoolFn: () => ({
      query,
    }),
  });

  await store.writeLibraryFileMatch({
    confidence: 'high',
    evidence: {
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

  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO library_file_matches/);
  assert.match(query.mock.calls[0].arguments[0], /FROM UNNEST/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    ['file-1'],
    ['artist-1'],
    ['release-group-1'],
    ['release-1'],
    ['medium-1'],
    ['track-1'],
    ['recording-1'],
    ['matched'],
    ['high'],
    ['musicbrainz_recording_id'],
    ['{"strategy":"musicbrainz_recording_id"}'],
  ]);
});

test('writeLibraryFileMatchBatch upserts match projections with nullable foreign keys', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryFileMatchStore({
    getPoolFn: () => ({
      query,
    }),
  });

  await store.writeLibraryFileMatchBatch({
    matches: [{
      confidence: 'high',
      evidence: {
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
    }],
  });

  assert.equal(query.mock.callCount(), 1);
  assert.match(query.mock.calls[0].arguments[0], /ON CONFLICT \(library_file_id\) DO UPDATE/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    ['file-1', 'file-2'],
    ['artist-1', null],
    ['release-group-1', null],
    ['release-1', null],
    ['medium-1', null],
    ['track-1', null],
    ['recording-1', null],
    ['matched', 'unmatched'],
    ['high', 'low'],
    ['musicbrainz_recording_id', 'missing_tag_payload'],
    ['{"strategy":"musicbrainz_recording_id"}', '{"reason":"missing_tag_payload"}'],
  ]);
});

test('writeLibraryFileMatchBatch skips empty batches', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryFileMatchStore({
    getPoolFn: () => ({
      query,
    }),
  });

  await store.writeLibraryFileMatchBatch({ matches: [] });

  assert.equal(query.mock.callCount(), 0);
});

test('writeLibraryFileMatchBatch deduplicates library file ids with last value winning', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryFileMatchStore({
    getPoolFn: () => ({
      query,
    }),
  });

  await store.writeLibraryFileMatchBatch({
    matches: [{
      confidence: 'low',
      libraryFileId: 'file-1',
      matchStatus: 'unmatched',
      matchedBy: 'missing_tag_payload',
    }, {
      confidence: 'high',
      evidence: {
        strategy: 'musicbrainz_recording_id',
      },
      libraryFileId: 'file-2',
      matchStatus: 'matched',
      matchedBy: 'musicbrainz_recording_id',
      metadataArtistId: 'artist-2',
    }, {
      confidence: 'medium',
      libraryFileId: 'file-1',
      matchStatus: 'ambiguous',
      matchedBy: 'conventional_tags_multiple_candidates',
    }],
  });

  assert.deepEqual(query.mock.calls[0].arguments[1][0], ['file-2', 'file-1']);
  assert.deepEqual(query.mock.calls[0].arguments[1][1], ['artist-2', null]);
  assert.deepEqual(query.mock.calls[0].arguments[1][7], ['matched', 'ambiguous']);
  assert.deepEqual(query.mock.calls[0].arguments[1][8], ['high', 'medium']);
  assert.deepEqual(query.mock.calls[0].arguments[1][9], [
    'musicbrainz_recording_id',
    'conventional_tags_multiple_candidates',
  ]);
});
