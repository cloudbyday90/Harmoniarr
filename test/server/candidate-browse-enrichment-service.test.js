import assert from 'node:assert/strict';
import test from 'node:test';
import { createCandidateBrowseEnrichmentService } from '../../src/server/library/candidate-browse-enrichment-service.js';

function buildCandidate({ username = 'user', folderPath = 'Artist\\Album', fileCount = 1, files = [] } = {}) {
  return {
    username,
    folderPath,
    fileCount,
    files,
    normalizedPayload: { folderPath, username },
  };
}

test('enrichCandidatesWithBrowse swaps in the fuller browsed candidate', async (t) => {
  const original = buildCandidate({
    folderPath: 'Boards of Canada\\Music Has the Right to Children',
    fileCount: 2,
    files: [{ filename: 'a.flac', extension: 'flac', isLocked: false }],
  });

  const browseUserDirectoryFn = t.mock.fn(async ({ username, directory }) => {
    assert.equal(username, 'user');
    assert.equal(directory, 'Boards of Canada\\Music Has the Right to Children');
    return {
      files: [
        { filename: 'a.flac' },
        { filename: 'b.flac' },
        { filename: 'c.flac' },
      ],
    };
  });

  const normalizeSlskdResponsesFn = t.mock.fn(() => [{
    username: 'user',
    folderPath: 'Boards of Canada\\Music Has the Right to Children',
    fileCount: 10,
    files: [],
    normalizedPayload: {},
  }]);

  const service = createCandidateBrowseEnrichmentService({
    browseUserDirectoryFn,
    normalizeSlskdResponsesFn,
  });

  const result = await service.enrichCandidatesWithBrowse({
    candidates: [original],
    albumTitle: 'Music Has the Right to Children',
    expectedTrackCount: 10,
  });

  assert.equal(browseUserDirectoryFn.mock.callCount(), 1);
  assert.equal(result[0].fileCount, 10);
  assert.deepEqual(result[0].normalizedPayload.browseEnrichment, {
    usedBrowse: true,
    reason: 'folder_name_match',
    originalFileCount: 2,
    browsedFileCount: 10,
  });
});

test('enrichCandidatesWithBrowse keeps original when browse reveals fewer files', async (t) => {
  const original = buildCandidate({
    folderPath: 'Some Artist\\Some Album',
    fileCount: 12,
    files: Array.from({ length: 12 }, (_, index) => ({
      filename: `${index}.flac`,
      extension: 'flac',
      isLocked: false,
    })),
  });

  const browseUserDirectoryFn = t.mock.fn(async () => ({ files: [{ filename: 'a.flac' }] }));
  const normalizeSlskdResponsesFn = t.mock.fn(() => [{
    username: 'user',
    folderPath: 'Some Artist\\Some Album',
    fileCount: 1,
    files: [],
    normalizedPayload: {},
  }]);

  const service = createCandidateBrowseEnrichmentService({
    browseUserDirectoryFn,
    normalizeSlskdResponsesFn,
  });

  // Folder fully covered already -> not browsed at all.
  const result = await service.enrichCandidatesWithBrowse({
    candidates: [original],
    albumTitle: 'Some Album',
    expectedTrackCount: 12,
  });

  assert.equal(browseUserDirectoryFn.mock.callCount(), 0);
  assert.equal(result[0].fileCount, 12);
  assert.equal(result[0].normalizedPayload.browseEnrichment, undefined);
});

test('enrichCandidatesWithBrowse is best-effort and preserves originals on browse failure', async (t) => {
  const original = buildCandidate({
    folderPath: 'Artist\\Matching Album',
    fileCount: 2,
    files: [{ filename: 'a.flac', extension: 'flac', isLocked: false }],
  });

  const browseUserDirectoryFn = t.mock.fn(async () => {
    throw new Error('user offline');
  });
  const normalizeSlskdResponsesFn = t.mock.fn(() => []);

  const service = createCandidateBrowseEnrichmentService({
    browseUserDirectoryFn,
    normalizeSlskdResponsesFn,
  });

  const result = await service.enrichCandidatesWithBrowse({
    candidates: [original],
    albumTitle: 'Matching Album',
    expectedTrackCount: 10,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0], original);
});

test('enrichCandidatesWithBrowse caps browse calls per ingest', async (t) => {
  const candidates = Array.from({ length: 5 }, (_, index) => buildCandidate({
    folderPath: `Artist\\Matching Album ${index}`,
    fileCount: 1,
    files: [{ filename: 'a.flac', extension: 'flac', isLocked: false }],
  }));

  const browseUserDirectoryFn = t.mock.fn(async () => ({ files: [{ filename: 'a.flac' }] }));
  const normalizeSlskdResponsesFn = t.mock.fn(() => []);

  const service = createCandidateBrowseEnrichmentService({
    browseUserDirectoryFn,
    normalizeSlskdResponsesFn,
    config: { maxBrowsePerIngest: 2 },
  });

  await service.enrichCandidatesWithBrowse({
    candidates,
    albumTitle: 'Matching Album',
    expectedTrackCount: 10,
    trustedUsernames: ['user'],
  });

  assert.equal(browseUserDirectoryFn.mock.callCount(), 2);
});

test('enrichCandidatesWithBrowse serves fresh cache hits without remote browse', async (t) => {
  const original = buildCandidate({
    folderPath: 'Artist\\Cached Album',
    fileCount: 1,
    files: [{ filename: 'a.flac', extension: 'flac', isLocked: false }],
  });

  const browseUserDirectoryFn = t.mock.fn(async () => ({ files: [] }));
  const normalizeSlskdResponsesFn = t.mock.fn(() => [{
    username: 'user',
    folderPath: 'Artist\\Cached Album',
    fileCount: 8,
    files: [],
    normalizedPayload: {},
  }]);

  const getFreshBrowse = t.mock.fn(async () => ({
    payload: { files: [{ filename: 'a.flac' }, { filename: 'b.flac' }] },
  }));
  const upsertBrowse = t.mock.fn(async () => ({}));

  const service = createCandidateBrowseEnrichmentService({
    browseUserDirectoryFn,
    normalizeSlskdResponsesFn,
    browseCacheStore: { getFreshBrowse, upsertBrowse },
  });

  const result = await service.enrichCandidatesWithBrowse({
    candidates: [original],
    albumTitle: 'Cached Album',
    expectedTrackCount: 8,
  });

  assert.equal(getFreshBrowse.mock.callCount(), 1);
  assert.equal(browseUserDirectoryFn.mock.callCount(), 0);
  assert.equal(upsertBrowse.mock.callCount(), 0);
  assert.equal(result[0].fileCount, 8);
});

test('enrichCandidatesWithBrowse caches remote browse results on a miss', async (t) => {
  const original = buildCandidate({
    folderPath: 'Artist\\Fresh Album',
    fileCount: 1,
    files: [{ filename: 'a.flac', extension: 'flac', isLocked: false }],
  });

  const browseUserDirectoryFn = t.mock.fn(async () => ({
    files: [{ filename: 'a.flac' }, { filename: 'b.flac' }],
  }));
  const normalizeSlskdResponsesFn = t.mock.fn(() => [{
    username: 'user',
    folderPath: 'Artist\\Fresh Album',
    fileCount: 9,
    files: [],
    normalizedPayload: {},
  }]);

  const getFreshBrowse = t.mock.fn(async () => null);
  const upsertBrowse = t.mock.fn(async () => ({}));

  const service = createCandidateBrowseEnrichmentService({
    browseUserDirectoryFn,
    normalizeSlskdResponsesFn,
    browseCacheStore: { getFreshBrowse, upsertBrowse },
  });

  await service.enrichCandidatesWithBrowse({
    candidates: [original],
    albumTitle: 'Fresh Album',
    expectedTrackCount: 9,
  });

  assert.equal(browseUserDirectoryFn.mock.callCount(), 1);
  assert.equal(upsertBrowse.mock.callCount(), 1);
  assert.deepEqual(upsertBrowse.mock.calls[0].arguments[0], {
    username: 'user',
    directory: 'Artist\\Fresh Album',
    fileCount: 2,
    payload: { files: [{ filename: 'a.flac' }, { filename: 'b.flac' }] },
  });
});

test('enrichCandidatesWithBrowse requires its function dependencies', () => {
  assert.throws(() => createCandidateBrowseEnrichmentService({}), /browseUserDirectoryFn/);
  assert.throws(
    () => createCandidateBrowseEnrichmentService({ browseUserDirectoryFn: () => {} }),
    /normalizeSlskdResponsesFn/,
  );
});
