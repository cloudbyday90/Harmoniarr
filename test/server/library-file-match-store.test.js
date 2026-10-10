import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryFileMatchStore } from '../../src/server/library/library-file-match-store.js';

function returnMatches(sql, values) {
  return { rowCount: values[0].length, rows: values[0].map((libraryFileId) => ({ library_file_id: libraryFileId })) };
}

test('writeLibraryFileMatch upserts the current canonical match projection for a library file', async (t) => {
  const query = t.mock.fn(returnMatches);
  const store = createLibraryFileMatchStore({
    withTransaction: async (work) => work({ query }),
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
  const query = t.mock.fn(returnMatches);
  const store = createLibraryFileMatchStore({
    withTransaction: async (work) => work({ query }),
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
  const query = t.mock.fn(returnMatches);
  const store = createLibraryFileMatchStore({
    withTransaction: async (work) => work({ query }),
    getPoolFn: () => ({
      query,
    }),
  });

  await store.writeLibraryFileMatchBatch({ matches: [] });

  assert.equal(query.mock.callCount(), 0);
});

test('writeLibraryFileMatchBatch deduplicates library file ids with last value winning', async (t) => {
  const query = t.mock.fn(returnMatches);
  const store = createLibraryFileMatchStore({
    withTransaction: async (work) => work({ query }),
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

const FILE_ID = '40000000-0000-4000-8000-000000000001';
const SECOND_FILE_ID = '40000000-0000-4000-8000-000000000002';
const ROOT_ID = '40000000-0000-4000-8000-000000000003';
function unmatched(libraryFileId = FILE_ID) {
  return { libraryFileId, confidence: 'low', matchStatus: 'unmatched', matchedBy: 'missing_tag_payload', evidence: { reason: 'missing_tag_payload' } };
}
function source(libraryFileId = FILE_ID, tagPayload = null) {
  return { id: libraryFileId, libraryRootId: ROOT_ID, canonicalPath: `/data/music/${libraryFileId}.flac`, sizeBytes: 42,
    modifiedAt: '2026-10-10T02:00:00.000Z', fileState: 'observed', tagPayload };
}

test('match writer uses the supplied client and awaited guard without borrowing or nesting a transaction', async (t) => {
  const events = []; const query = t.mock.fn(async (sql, values) => { events.push('write'); return returnMatches(sql, values); });
  const queryable = { query };
  const store = createLibraryFileMatchStore({ getPoolFn: () => { assert.fail('The owner already supplies a client'); },
    withTransaction: async () => { assert.fail('Caller-owned transaction must not be nested'); },
  });
  const result = await store.writeLibraryFileMatchBatch({ matches: [unmatched()], expectedSources: [source()], queryable,
    beforeWrite: async ({ queryable: client }) => { await Promise.resolve(); assert.equal(client, queryable); events.push('guard'); },
  });
  assert.deepEqual(result, { libraryFileIds: [FILE_ID] }); assert.deepEqual(events, ['guard', 'write']);
  assert.equal(query.mock.callCount(), 1);
});

test('match writer waits for the guard before upserting any match', async (t) => {
  let entered; let resume;
  const ready = new Promise((done) => { entered = done; }); const paused = new Promise((done) => { resume = done; });
  const query = t.mock.fn(returnMatches); const queryable = { query };
  const store = createLibraryFileMatchStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  const running = store.writeLibraryFileMatchBatch({ matches: [unmatched()], queryable,
    beforeWrite: async () => { entered(); await paused; },
  });
  await ready; assert.equal(query.mock.callCount(), 0); resume(); await running; assert.equal(query.mock.callCount(), 1);
});

test('match guard refusal propagates without query, fallback or caller transaction management', async (t) => {
  const query = t.mock.fn(returnMatches); const queryable = { query };
  const store = createLibraryFileMatchStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  const failure = Object.assign(new Error('Lost'), { code: 'operation_run_lease_lost' });
  await assert.rejects(store.writeLibraryFileMatchBatch({ matches: [unmatched()], queryable,
    beforeWrite: async () => { throw failure; },
  }), (error) => error === failure);
  assert.equal(query.mock.callCount(), 0);
});

test('empty match batches preserve no-op behavior without borrowing a transaction or invoking a guard', async () => {
  const store = createLibraryFileMatchStore({ getPoolFn: () => { assert.fail('Unexpected connection'); },
    withTransaction: async () => { assert.fail('Empty batch must not borrow a transaction'); },
  });
  assert.deepEqual(await store.writeLibraryFileMatchBatch({ matches: [], beforeWrite: async () => { assert.fail('Empty batch has no writes'); } }), { libraryFileIds: [] });
});

test('source CAS passes SQL NULL tags distinctly from a JSON object and repeats source predicates', async (t) => {
  const query = t.mock.fn(returnMatches); const queryable = { query };
  const store = createLibraryFileMatchStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  await store.writeLibraryFileMatchBatch({ matches: [unmatched(), unmatched(SECOND_FILE_ID)],
    expectedSources: [source(), source(SECOND_FILE_ID, {})], queryable,
  });
  const [sql, values] = query.mock.calls[0].arguments;
  const sourceValues = values.slice(11);
  assert.ok(sourceValues.some((value) => Array.isArray(value) && value.length === 2 && value[0] === null && value[1] === '{}'));
  assert.match(sql, /tag_payload IS NOT DISTINCT FROM/u);
  assert.match(sql, /modified_at IS NOT DISTINCT FROM/u);
  assert.match(sql, /file_state = 'observed'/u); assert.match(sql, /deleted_at IS NULL/u);
  assert.ok(sourceValues.some((value) => Array.isArray(value) && value[0] === ROOT_ID && value[1] === ROOT_ID));
  assert.ok(sourceValues.some((value) => Array.isArray(value) && value[0] === source().canonicalPath));
});

test('zero or partial guarded match rows roll back the whole standalone batch and release its client', async (t) => {
  for (const rows of [[], [{ library_file_id: FILE_ID }]]) {
    const events = []; const release = t.mock.fn();
    const query = t.mock.fn(async (sql) => {
      if (/INSERT INTO library_file_matches/u.test(sql)) { events.push('write'); return { rowCount: rows.length, rows }; }
      events.push(sql); return { rows: [] };
    });
    const store = createLibraryFileMatchStore({ getPoolFn: () => ({ connect: async () => ({ query, release }) }) });
    await assert.rejects(store.writeLibraryFileMatchBatch({ matches: [unmatched(), unmatched(SECOND_FILE_ID)], expectedSources: [source(), source(SECOND_FILE_ID)] }), { code: 'library_file_match_stale' });
    assert.deepEqual(events, ['BEGIN', 'write', 'ROLLBACK']); assert.equal(release.mock.callCount(), 1);
  }
});

test('duplicate or foreign returned identities refuse standalone match success and roll back', async (t) => {
  for (const rows of [[{ library_file_id: FILE_ID }, { library_file_id: FILE_ID }],
    [{ library_file_id: FILE_ID }, { library_file_id: 'foreign' }]]) {
    const events = []; const release = t.mock.fn();
    const query = t.mock.fn(async (sql) => {
      if (/INSERT INTO library_file_matches/u.test(sql)) { events.push('write'); return { rowCount: 2, rows }; }
      events.push(sql); return { rows: [] };
    });
    const store = createLibraryFileMatchStore({ getPoolFn: () => ({ connect: async () => ({ query, release }) }) });
    await assert.rejects(store.writeLibraryFileMatchBatch({ matches: [unmatched(), unmatched(SECOND_FILE_ID)] }), { code: 'library_file_match_incomplete' });
    assert.deepEqual(events, ['BEGIN', 'write', 'ROLLBACK']); assert.equal(release.mock.callCount(), 1);
  }
});

test('malformed match callback or transaction client refuses before any write', async (t) => {
  const query = t.mock.fn(returnMatches); const store = createLibraryFileMatchStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  for (const extra of [{ queryable: { query }, beforeWrite: true }, { queryable: { noQuery: true } }]) {
    await assert.rejects(store.writeLibraryFileMatchBatch({ matches: [unmatched()], ...extra }), TypeError);
  }
  assert.equal(query.mock.callCount(), 0);
});
