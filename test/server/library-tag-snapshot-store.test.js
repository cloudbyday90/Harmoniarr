import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryTagSnapshotStore } from '../../src/server/library/library-tag-snapshot-store.js';

test('writeLibraryFileTagSnapshot appends a snapshot and updates the current file read model in one transaction', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const store = createLibraryTagSnapshotStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  await store.writeLibraryFileTagSnapshot({
    audioCodec: 'FLAC',
    bitrateKbps: 932.6,
    bitDepth: 16,
    channels: 2,
    durationMs: 183412.4,
    embeddedArtworkCount: 1,
    extractor: 'music-metadata',
    libraryFileId: 'file-1',
    normalizedTags: { album: 'Amber', title: 'Foil' },
    rawTags: { native: { vorbis: [{ id: 'TITLE', value: 'Foil' }] } },
    sampleRateHz: 44100,
    sourceModifiedAt: '2026-04-30T18:00:00.000Z',
    sourceSizeBytes: 123,
    status: 'extracted',
    tagFormat: 'vorbis',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /INSERT INTO file_tag_snapshots/);
  assert.deepEqual(query.mock.calls[1].arguments[1], [
    'file-1',
    'music-metadata',
    null,
    'vorbis',
    'extracted',
    1,
    '{"native":{"vorbis":[{"id":"TITLE","value":"Foil"}]}}',
    '{"album":"Amber","title":"Foil"}',
  ]);
  assert.match(query.mock.calls[2].arguments[0], /UPDATE library_files/);
  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'file-1',
    'FLAC',
    933,
    44100,
    16,
    2,
    183412,
    '{"album":"Amber","title":"Foil"}',
    'extracted',
    123,
    '2026-04-30T18:00:00.000Z',
  ]);
  assert.match(query.mock.calls[2].arguments[0], /file_state = 'observed'/);
  assert.match(query.mock.calls[2].arguments[0], /tag_extracted_size_bytes/);
  assert.match(query.mock.calls[2].arguments[0], /tag_extracted_modified_at/);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});
