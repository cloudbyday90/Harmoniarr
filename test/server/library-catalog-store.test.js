import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';

function createCatalogStoreWithQuery(query, t) {
  const release = t.mock.fn(() => {});
  const store = createLibraryCatalogStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  return {
    release,
    store,
  };
}

function createPersistedFileRow({
  canonicalPath,
  extension,
  fileState,
  filename,
  id,
  modifiedAt,
  relativePath,
  sizeBytes,
  tagExtractedModifiedAt = '2026-04-30T18:00:00.000Z',
  tagExtractedSizeBytes = '123',
  tagPayload = null,
}) {
  return {
    canonical_path: canonicalPath,
    extension,
    file_state: fileState,
    filename,
    id,
    modified_at: modifiedAt,
    relative_path: relativePath,
    size_bytes: sizeBytes,
    tag_extracted_modified_at: tagExtractedModifiedAt,
    tag_extracted_size_bytes: tagExtractedSizeBytes,
    tag_payload: tagPayload,
  };
}

test('recordLibraryFiles upserts the root, batches files, and tombstones missing rows in one transaction', async (t) => {
  const query = t.mock.fn(async (sql, values) => {
    if (/INSERT INTO library_roots/.test(sql)) {
      return {
        rows: [{
          id: 'root-1',
          canonical_path: values[2],
        }],
      };
    }

    if (/WITH input_rows/.test(sql)) {
      return {
        rows: values[1].map((canonicalPath, index) => createPersistedFileRow({
          canonicalPath,
          extension: values[4][index],
          fileState: values[7][index],
          filename: values[3][index],
          id: `file-${index + 1}`,
          modifiedAt: values[6][index],
          relativePath: values[2][index],
          sizeBytes: values[5][index],
        })),
      };
    }

    return { rows: [] };
  });
  const { release, store } = createCatalogStoreWithQuery(query, t);

  const result = await store.recordLibraryFiles({
    files: [{
      canonicalPath: '/data/music/Artist/track-01.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-01.flac',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
    }, {
      canonicalPath: '/data/music/Artist/track-02.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-02.flac',
      modifiedAt: '2026-04-30T18:01:00.000Z',
      relativePath: 'Artist/track-02.flac',
      sizeBytes: 456,
    }],
    libraryRootPath: '/data/music',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /INSERT INTO library_roots/);
  assert.match(query.mock.calls[2].arguments[0], /WITH input_rows/);
  assert.match(query.mock.calls[2].arguments[0], /FROM UNNEST/);
  assert.match(query.mock.calls[2].arguments[0], /ON CONFLICT \(canonical_path\) DO UPDATE/);
  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'root-1',
    ['/data/music/Artist/track-01.flac', '/data/music/Artist/track-02.flac'],
    ['Artist/track-01.flac', 'Artist/track-02.flac'],
    ['track-01.flac', 'track-02.flac'],
    ['.flac', '.flac'],
    [123, 456],
    ['2026-04-30T18:00:00.000Z', '2026-04-30T18:01:00.000Z'],
    ['observed', 'observed'],
  ]);
  assert.match(query.mock.calls[3].arguments[0], /UPDATE library_files/);
  assert.deepEqual(query.mock.calls[3].arguments[1], [
    'root-1',
    ['/data/music/Artist/track-01.flac', '/data/music/Artist/track-02.flac'],
  ]);
  assert.equal(query.mock.calls[4].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
  assert.deepEqual(result, {
    files: [{
      canonicalPath: '/data/music/Artist/track-01.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-01.flac',
      id: 'file-1',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 123,
      tagExtractedModifiedAt: '2026-04-30T18:00:00.000Z',
      tagExtractedSizeBytes: 123,
      tagPayload: null,
    }, {
      canonicalPath: '/data/music/Artist/track-02.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-02.flac',
      id: 'file-2',
      modifiedAt: '2026-04-30T18:01:00.000Z',
      relativePath: 'Artist/track-02.flac',
      sizeBytes: 456,
      tagExtractedModifiedAt: '2026-04-30T18:00:00.000Z',
      tagExtractedSizeBytes: 123,
      tagPayload: null,
    }],
    libraryRootId: 'root-1',
    observedFileCount: 2,
  });
});

test('recordLibraryFiles skips the batch upsert when no files are observed', async (t) => {
  const query = t.mock.fn(async (sql, values) => {
    assert.doesNotMatch(sql, /WITH input_rows/);

    if (/INSERT INTO library_roots/.test(sql)) {
      return {
        rows: [{
          id: 'root-1',
          canonical_path: values[2],
        }],
      };
    }

    return { rows: [] };
  });
  const { store } = createCatalogStoreWithQuery(query, t);

  const result = await store.recordLibraryFiles({
    files: [],
    libraryRootPath: '/data/music',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /INSERT INTO library_roots/);
  assert.match(query.mock.calls[2].arguments[0], /UPDATE library_files/);
  assert.deepEqual(query.mock.calls[2].arguments[1], ['root-1', []]);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.deepEqual(result, {
    files: [],
    libraryRootId: 'root-1',
    observedFileCount: 0,
  });
});

test('recordLibraryFiles deduplicates duplicate canonical paths before batch upsert', async (t) => {
  const query = t.mock.fn(async (sql, values) => {
    if (/INSERT INTO library_roots/.test(sql)) {
      return {
        rows: [{
          id: 'root-1',
          canonical_path: values[2],
        }],
      };
    }

    if (/WITH input_rows/.test(sql)) {
      return {
        rows: values[1].map((canonicalPath, index) => createPersistedFileRow({
          canonicalPath,
          extension: values[4][index],
          fileState: values[7][index],
          filename: values[3][index],
          id: `file-${index + 1}`,
          modifiedAt: values[6][index],
          relativePath: values[2][index],
          sizeBytes: values[5][index],
        })),
      };
    }

    return { rows: [] };
  });
  const { store } = createCatalogStoreWithQuery(query, t);

  const result = await store.recordLibraryFiles({
    files: [{
      canonicalPath: '/data/music/Artist/track-01.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'stale-name.flac',
      modifiedAt: '2026-04-30T18:00:00.000Z',
      relativePath: 'Artist/stale-name.flac',
      sizeBytes: 111,
    }, {
      canonicalPath: '/data/music/Artist/track-02.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-02.flac',
      modifiedAt: '2026-04-30T18:01:00.000Z',
      relativePath: 'Artist/track-02.flac',
      sizeBytes: 222,
    }, {
      canonicalPath: '/data/music/Artist/track-01.flac',
      extension: '.flac',
      fileState: 'observed',
      filename: 'track-01.flac',
      modifiedAt: '2026-04-30T18:02:00.000Z',
      relativePath: 'Artist/track-01.flac',
      sizeBytes: 333,
    }],
    libraryRootPath: '/data/music',
  });

  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'root-1',
    ['/data/music/Artist/track-02.flac', '/data/music/Artist/track-01.flac'],
    ['Artist/track-02.flac', 'Artist/track-01.flac'],
    ['track-02.flac', 'track-01.flac'],
    ['.flac', '.flac'],
    [222, 333],
    ['2026-04-30T18:01:00.000Z', '2026-04-30T18:02:00.000Z'],
    ['observed', 'observed'],
  ]);
  assert.deepEqual(query.mock.calls[3].arguments[1], [
    'root-1',
    ['/data/music/Artist/track-02.flac', '/data/music/Artist/track-01.flac'],
  ]);
  assert.equal(result.observedFileCount, 2);
});

test('recordLibraryFiles chunks large file batches at 5000 rows', async (t) => {
  const query = t.mock.fn(async (sql, values) => {
    if (/INSERT INTO library_roots/.test(sql)) {
      return {
        rows: [{
          id: 'root-1',
          canonical_path: values[2],
        }],
      };
    }

    if (/WITH input_rows/.test(sql)) {
      return {
        rows: values[1].map((canonicalPath, index) => createPersistedFileRow({
          canonicalPath,
          extension: values[4][index],
          fileState: values[7][index],
          filename: values[3][index],
          id: `file-${canonicalPath}`,
          modifiedAt: values[6][index],
          relativePath: values[2][index],
          sizeBytes: values[5][index],
        })),
      };
    }

    return { rows: [] };
  });
  const { store } = createCatalogStoreWithQuery(query, t);
  const files = Array.from({ length: 5001 }, (_, index) => ({
    canonicalPath: `/data/music/Artist/track-${index}.flac`,
    extension: '.flac',
    fileState: 'observed',
    filename: `track-${index}.flac`,
    modifiedAt: '2026-04-30T18:00:00.000Z',
    relativePath: `Artist/track-${index}.flac`,
    sizeBytes: index,
  }));

  const result = await store.recordLibraryFiles({
    files,
    libraryRootPath: '/data/music',
  });
  const batchCalls = query.mock.calls.filter((call) => /WITH input_rows/.test(call.arguments[0]));

  assert.equal(batchCalls.length, 2);
  assert.equal(batchCalls[0].arguments[1][1].length, 5000);
  assert.equal(batchCalls[1].arguments[1][1].length, 1);
  assert.equal(result.observedFileCount, 5001);
});
