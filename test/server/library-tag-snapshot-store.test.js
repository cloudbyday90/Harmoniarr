import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryTagSnapshotStore } from '../../src/server/library/library-tag-snapshot-store.js';

test('writeLibraryFileTagSnapshot appends a snapshot and updates the current file read model in one transaction', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (/INSERT INTO file_tag_snapshots/u.test(sql)) return { rowCount: 1, rows: [{ id: '30000000-0000-4000-8000-000000000010', library_file_id: 'file-1' }] };
    if (/UPDATE library_files/u.test(sql)) return { rowCount: 1, rows: [{ id: 'file-1' }] };
    return { rows: [] };
  });
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

const FILE_ID = '30000000-0000-4000-8000-000000000004';
const ROOT_ID = '30000000-0000-4000-8000-000000000003';
const SNAPSHOT_ID = '30000000-0000-4000-8000-000000000005';
function expectedSource() {
  return { id: FILE_ID, libraryRootId: ROOT_ID, canonicalPath: '/data/music/track.flac', sizeBytes: 42,
    modifiedAt: '2026-10-09T23:00:00.000Z', fileState: 'observed' };
}
function snapshotInput(extra = {}) {
  return { libraryFileId: FILE_ID, extractor: 'music-metadata', status: 'extracted', normalizedTags: { title: 'Track' },
    sourceSizeBytes: 42, sourceModifiedAt: '2026-10-09T23:00:00.000Z', ...extra };
}
function returnedQuery(t, { updateResult = null, snapshotResult = null, events = [] } = {}) {
  return t.mock.fn(async (sql) => {
    if (/INSERT INTO file_tag_snapshots/u.test(sql)) { events.push('snapshot'); return snapshotResult ?? { rowCount: 1, rows: [{ id: SNAPSHOT_ID }] }; }
    if (/UPDATE library_files/u.test(sql)) { events.push('file_update'); return updateResult ?? { rowCount: 1, rows: [{ id: FILE_ID }] }; }
    events.push(sql); return { rows: [] };
  });
}

test('snapshot writer uses the supplied client and awaits each guard without borrowing or nesting a transaction', async (t) => {
  const events = []; const queryable = { query: returnedQuery(t, { events }) };
  const store = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('The owner already supplies a transaction client'); } });
  const result = await store.writeLibraryFileTagSnapshot(snapshotInput({ queryable, expectedSource: expectedSource(),
    beforeWrite: async ({ queryable: client, stage }) => { await Promise.resolve(); assert.equal(client, queryable); events.push(`guard:${stage}`); },
  }));
  assert.deepEqual(result, { snapshotId: SNAPSHOT_ID, libraryFileId: FILE_ID });
  assert.deepEqual(events, ['guard:snapshot', 'snapshot', 'guard:file_update', 'file_update']);
  assert.equal(queryable.query.mock.callCount(), 2);
});

test('source stamps remain separate from current-source CAS predicates', async (t) => {
  const queryable = { query: returnedQuery(t) };
  const store = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  await store.writeLibraryFileTagSnapshot(snapshotInput({ queryable, expectedSource: expectedSource(),
    sourceSizeBytes: 999, sourceModifiedAt: '2020-01-01T00:00:00.000Z',
  }));
  const [sql, values] = queryable.query.mock.calls[1].arguments;
  assert.deepEqual(values.slice(9, 11), [999, '2020-01-01T00:00:00.000Z']);
  assert.deepEqual(values.slice(11), [ROOT_ID, '/data/music/track.flac', 42, '2026-10-09T23:00:00.000Z']);
  assert.match(sql, /WHERE id = \$1[\s\S]*library_root_id = \$12::uuid[\s\S]*canonical_path = \$13/u);
  assert.match(sql, /size_bytes = \$14::bigint[\s\S]*modified_at IS NOT DISTINCT FROM \$15::timestamptz/u);
  assert.match(sql, /AND file_state = 'observed' AND deleted_at IS NULL/u);
});

test('nullable mtime source CAS preserves an actual null comparison', async (t) => {
  const queryable = { query: returnedQuery(t) };
  const store = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  await store.writeLibraryFileTagSnapshot(snapshotInput({ queryable, expectedSource: { ...expectedSource(), modifiedAt: null }, sourceModifiedAt: null }));
  assert.equal(queryable.query.mock.calls[1].arguments[1][14], null);
  assert.match(queryable.query.mock.calls[1].arguments[0], /modified_at IS NOT DISTINCT FROM/u);
});

test('snapshot writer waits for the initial guard before appending any history', async (t) => {
  let entered; let resume; let guards = 0;
  const ready = new Promise((done) => { entered = done; }); const paused = new Promise((done) => { resume = done; });
  const queryable = { query: returnedQuery(t) };
  const store = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  const running = store.writeLibraryFileTagSnapshot(snapshotInput({ queryable,
    beforeWrite: async () => { if (++guards === 1) { entered(); await paused; } },
  }));
  await ready; assert.equal(queryable.query.mock.callCount(), 0); resume();
  await running; assert.equal(queryable.query.mock.callCount(), 2);
});

for (const [stage, expectedWrites] of [['snapshot', []], ['file_update', ['snapshot']]]) {
  test(`${stage} guard failure propagates without a failed-snapshot fallback or caller transaction management`, async (t) => {
    const events = []; const queryable = { query: returnedQuery(t, { events }) };
    const failure = Object.assign(new Error('Lost'), { code: 'operation_run_lease_lost' });
    const store = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
    await assert.rejects(store.writeLibraryFileTagSnapshot(snapshotInput({ queryable,
      beforeWrite: async (args) => { if (args.stage === stage) throw failure; },
    })), (error) => error === failure);
    assert.deepEqual(events, expectedWrites);
  });
}

test('zero-row current-source CAS rolls back inserted history and releases the standalone client', async (t) => {
  const events = []; const query = returnedQuery(t, { events, updateResult: { rowCount: 0, rows: [] } });
  const release = t.mock.fn();
  const store = createLibraryTagSnapshotStore({ getPoolFn: () => ({ connect: async () => ({ query, release }) }) });
  await assert.rejects(store.writeLibraryFileTagSnapshot(snapshotInput({ expectedSource: expectedSource() })), { code: 'library_tag_snapshot_stale' });
  assert.deepEqual(events, ['BEGIN', 'snapshot', 'file_update', 'ROLLBACK']);
  assert.equal(release.mock.callCount(), 1);
});

test('a current parser-failure snapshot retains the successful stamp CASE and guarded observed-file predicates', async (t) => {
  const queryable = { query: returnedQuery(t) };
  const store = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  await store.writeLibraryFileTagSnapshot(snapshotInput({ queryable, expectedSource: expectedSource(), status: 'failed',
    normalizedTags: null, rawTags: { error: 'Unsupported content' },
  }));
  const [sql, values] = queryable.query.mock.calls[1].arguments;
  assert.equal(values[7], null); assert.equal(values[8], 'failed');
  assert.match(sql, /WHEN \$9 = 'extracted'[\s\S]*ELSE tag_extracted_size_bytes/u);
  assert.match(sql, /WHEN \$9 = 'extracted'[\s\S]*ELSE tag_extracted_modified_at/u);
  assert.match(sql, /AND file_state = 'observed' AND deleted_at IS NULL/u);
});

test('incomplete snapshot or foreign current-file rows refuse success and roll back both writes', async (t) => {
  for (const result of [
    { snapshotResult: { rowCount: 0, rows: [] }, code: 'library_tag_snapshot_incomplete', expectedWrites: ['BEGIN', 'snapshot', 'ROLLBACK'] },
    { snapshotResult: { rowCount: 2, rows: [{ id: SNAPSHOT_ID }, { id: SNAPSHOT_ID }] }, code: 'library_tag_snapshot_incomplete', expectedWrites: ['BEGIN', 'snapshot', 'ROLLBACK'] },
    { updateResult: { rowCount: 1, rows: [{ id: 'foreign' }] }, code: 'library_tag_snapshot_stale', expectedWrites: ['BEGIN', 'snapshot', 'file_update', 'ROLLBACK'] },
  ]) {
    const events = []; const query = returnedQuery(t, { ...result, events }); const release = t.mock.fn();
    const store = createLibraryTagSnapshotStore({ getPoolFn: () => ({ connect: async () => ({ query, release }) }) });
    await assert.rejects(store.writeLibraryFileTagSnapshot(snapshotInput()), { code: result.code });
    assert.deepEqual(events, result.expectedWrites); assert.equal(release.mock.callCount(), 1);
  }
});

test('snapshot writer rejects foreign source identity and malformed callback/client before any SQL', async (t) => {
  const queryable = { query: returnedQuery(t) };
  const store = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  for (const extra of [
    { queryable, expectedSource: { ...expectedSource(), id: 'foreign' } },
    { queryable, beforeWrite: true },
    { queryable: { noQuery: true } },
  ]) await assert.rejects(store.writeLibraryFileTagSnapshot(snapshotInput(extra)), TypeError);
  assert.equal(queryable.query.mock.callCount(), 0);
});
