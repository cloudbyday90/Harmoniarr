import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdBrowseCacheStore } from '../../src/server/slskd/slskd-browse-cache-store.js';

function buildRow(overrides = {}) {
  return {
    id: 'browse-1',
    username: 'user',
    directory: 'Artist\\Album',
    file_count: 3,
    payload: { files: [{ filename: 'a.flac' }] },
    observed_at: '2026-06-26T00:00:00.000Z',
    ...overrides,
  };
}

test('getFreshBrowse queries with a freshness cutoff and maps the row', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [buildRow()] }));
  const store = createSlskdBrowseCacheStore({ getPoolFn: () => ({ query }) });

  const freshAfter = new Date('2026-06-25T00:00:00.000Z');
  const result = await store.getFreshBrowse({
    username: ' user ',
    directory: ' Artist\\Album ',
    freshAfter,
  });

  assert.equal(query.mock.callCount(), 1);
  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /FROM slskd_browse_cache/);
  assert.match(sql, /observed_at >= \$3/);
  assert.deepEqual(params, ['user', 'Artist\\Album', '2026-06-25T00:00:00.000Z']);
  assert.deepEqual(result, {
    id: 'browse-1',
    username: 'user',
    directory: 'Artist\\Album',
    fileCount: 3,
    payload: { files: [{ filename: 'a.flac' }] },
    observedAt: '2026-06-26T00:00:00.000Z',
  });
});

test('getFreshBrowse skips the query for blank keys', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createSlskdBrowseCacheStore({ getPoolFn: () => ({ query }) });

  assert.equal(await store.getFreshBrowse({ username: '  ', directory: 'x', freshAfter: new Date() }), null);
  assert.equal(await store.getFreshBrowse({ username: 'x', directory: '  ', freshAfter: new Date() }), null);
  assert.equal(await store.getFreshBrowse({ username: 'x', directory: 'y', freshAfter: null }), null);
  assert.equal(query.mock.callCount(), 0);
});

test('getFreshBrowse returns null when no fresh row exists', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createSlskdBrowseCacheStore({ getPoolFn: () => ({ query }) });

  const result = await store.getFreshBrowse({
    username: 'user',
    directory: 'Artist\\Album',
    freshAfter: new Date(),
  });

  assert.equal(result, null);
});

test('upsertBrowse inserts with ON CONFLICT update and serializes payload', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [buildRow({ file_count: 5 })] }));
  const store = createSlskdBrowseCacheStore({ getPoolFn: () => ({ query }) });

  const result = await store.upsertBrowse({
    username: ' user ',
    directory: ' Artist\\Album ',
    fileCount: 5,
    payload: { files: [{ filename: 'a.flac' }] },
  });

  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO slskd_browse_cache/);
  assert.match(sql, /ON CONFLICT \(username, directory\)/);
  assert.match(sql, /observed_at = NOW\(\)/);
  assert.deepEqual(params, [
    'user',
    'Artist\\Album',
    5,
    JSON.stringify({ files: [{ filename: 'a.flac' }] }),
  ]);
  assert.equal(result.fileCount, 5);
});

test('upsertBrowse rejects blank keys and clamps invalid file counts', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [buildRow({ file_count: 0 })] }));
  const store = createSlskdBrowseCacheStore({ getPoolFn: () => ({ query }) });

  await assert.rejects(
    () => store.upsertBrowse({ username: '  ', directory: 'x', fileCount: 1, payload: {} }),
    /username and directory/,
  );

  await store.upsertBrowse({ username: 'user', directory: 'x', fileCount: -7, payload: {} });
  assert.equal(query.mock.calls[0].arguments[1][2], 0);
});

test('pruneExpiredBrowse deletes rows older than the cutoff', async (t) => {
  const query = t.mock.fn(async () => ({ rowCount: 4 }));
  const store = createSlskdBrowseCacheStore({ getPoolFn: () => ({ query }) });

  const removed = await store.pruneExpiredBrowse({ olderThan: new Date('2026-06-01T00:00:00.000Z') });

  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM slskd_browse_cache WHERE observed_at < \$1/);
  assert.deepEqual(params, ['2026-06-01T00:00:00.000Z']);
  assert.equal(removed, 4);
});

test('pruneExpiredBrowse is a no-op without a cutoff', async (t) => {
  const query = t.mock.fn(async () => ({ rowCount: 0 }));
  const store = createSlskdBrowseCacheStore({ getPoolFn: () => ({ query }) });

  assert.equal(await store.pruneExpiredBrowse({ olderThan: null }), 0);
  assert.equal(query.mock.callCount(), 0);
});
