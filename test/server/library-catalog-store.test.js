import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';

test('recordLibraryFiles upserts the root, writes files, and tombstones missing rows in one transaction', async (t) => {
  const query = t.mock.fn(async (sql, values) => {
    if (/INSERT INTO library_roots/.test(sql)) {
      return {
        rows: [{
          id: 'root-1',
          canonical_path: values[2],
        }],
      };
    }

    if (/INSERT INTO library_files/.test(sql)) {
      return {
        rows: [{
          id: 'file-1',
          canonical_path: values[1],
          relative_path: values[2],
          filename: values[3],
          extension: values[4],
          file_state: values[7],
          tag_payload: null,
        }],
      };
    }

    return { rows: [] };
  });
  const release = t.mock.fn(() => {});
  const store = createLibraryCatalogStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  const result = await store.recordLibraryFiles({
    files: [{
      canonicalPath: '/data/music/Artist/track-01.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-01.flac',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
    }],
    libraryRootPath: '/data/music',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /INSERT INTO library_roots/);
  assert.match(query.mock.calls[2].arguments[0], /INSERT INTO library_files/);
  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'root-1',
    '/data/music/Artist/track-01.flac',
    'Artist/track-01.flac',
    'track-01.flac',
    '.flac',
    123,
    '2026-04-30T18:00:00.000Z',
    'observed',
  ]);
  assert.match(query.mock.calls[3].arguments[0], /UPDATE library_files/);
  assert.deepEqual(query.mock.calls[3].arguments[1], ['root-1', ['/data/music/Artist/track-01.flac']]);
  assert.equal(query.mock.calls[4].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
  assert.deepEqual(result, {
    files: [{
      canonicalPath: '/data/music/Artist/track-01.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-01.flac',
      id: 'file-1',
      relativePath: 'Artist/track-01.flac',
      tagPayload: null,
    }],
    libraryRootId: 'root-1',
    observedFileCount: 1,
  });
});