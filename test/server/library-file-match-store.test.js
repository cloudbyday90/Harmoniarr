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
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'file-1',
    'artist-1',
    'release-group-1',
    'release-1',
    'medium-1',
    'track-1',
    'recording-1',
    'matched',
    'high',
    'musicbrainz_recording_id',
    '{"strategy":"musicbrainz_recording_id"}',
  ]);
});