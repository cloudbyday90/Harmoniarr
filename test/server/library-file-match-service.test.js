/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { captureFileMatchBatch, captureFileMatchResults, isCurrentFileMatchScope, isCurrentFileMatchSource } from '../../src/server/library/library-file-match-policy.js';
import { createLibraryFileMatchService } from '../../src/server/library/library-file-match-service.js';
import { createLibraryFileMatchStore } from '../../src/server/library/library-file-match-store.js';

const uuid = (value) => `40000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const FILE_ID = uuid(1); const SECOND_FILE_ID = uuid(2); const ROOT_ID = uuid(3);
const RUN_ID = uuid(10); const TOKEN = uuid(11); const SCOPE_ID = uuid(20);
const NOW = Date.parse('2026-10-10T03:00:00.000Z');
function inputForTest() {
  return { runId: RUN_ID, expectedLease: { leaseKey: `library_scan:${RUN_ID}`, ownerInstanceId: 'scanner-a', acquisitionId: TOKEN },
    requestedLibraryRoot: '/configured-music', libraryRootPath: '/data/music', libraryRootId: ROOT_ID,
    files: [{ id: FILE_ID, canonicalPath: '/data/music/Artist/track.flac', relativePath: 'Artist/track.flac', filename: 'track.flac',
      extension: '.flac', sizeBytes: 42, modifiedAt: '2026-10-10T02:00:00.000Z', fileState: 'observed',
      tagPayload: { title: 'Track', artists: ['Artist', 'Other'], track: { number: 1, of: 10 } }, scopeMetadataReleaseId: SCOPE_ID },
    { id: SECOND_FILE_ID, canonicalPath: '/data/music/Artist/unknown.flac', relativePath: 'Artist/unknown.flac', filename: 'unknown.flac',
      extension: '.flac', sizeBytes: 84, modifiedAt: null, fileState: 'observed', tagPayload: null }] };
}
function matchesForTest() {
  return [{ libraryFileId: FILE_ID, matchStatus: 'matched', confidence: 'high', matchedBy: 'conventional_tags',
    evidence: { strategy: 'conventional_tags', scopeMetadataReleaseId: SCOPE_ID }, metadataArtistId: uuid(21),
    metadataReleaseGroupId: uuid(22), metadataReleaseId: uuid(23), metadataMediumId: uuid(24), metadataTrackId: uuid(25), metadataRecordingId: null },
  { libraryFileId: SECOND_FILE_ID, matchStatus: 'unmatched', confidence: 'low', matchedBy: 'missing_tag_payload', evidence: { reason: 'missing_tag_payload' } }];
}
function fixture(overrides = {}) {
  const input = inputForTest(); const matches = matchesForTest(); const events = []; const guards = []; const writes = [];
  const queryable = { connection: 'owned-match-transaction' };
  const context = { run: { id: RUN_ID, operation_type: 'library_scan', status: 'running', cancel_requested_at: null, cancelled_at: null,
    summary: { libraryRoot: input.requestedLibraryRoot, releaseHints: [{ canonicalPath: input.files[0].canonicalPath, metadataReleaseId: SCOPE_ID }] } },
  lease: { ...input.expectedLease, releasedAt: null, expiresAt: '2026-10-10T04:00:00.000Z' },
  files: input.files.map((file) => ({ ...structuredClone(file), libraryRootId: ROOT_ID, rootPath: '/data/music', deletedAt: null })) };
  let clock = NOW; let open = false; let staged;
  let committed = ['previous-match'];
  const options = {
    store: {
      async lockContext(args) { events.push('lock'); guards.push(args); assert.equal(args.queryable, queryable); return context; },
      async readContext(args) { events.push('read'); guards.push(args); assert.equal(args.queryable, queryable); return context; },
      async readClock(client) { events.push('clock'); assert.equal(open, true); assert.equal(client, queryable); return clock; },
    },
    async assertMaintenanceWriteAllowed({ queryable: client }) { events.push('maintenance'); assert.equal(open, true); assert.equal(client, queryable); },
    async withTransaction(work) {
      assert.equal(open, false); open = true; events.push('begin'); staged = [...committed];
      try { const result = await work(queryable); committed = staged; events.push('commit'); return result; }
      catch (error) { events.push('rollback'); throw error; }
      finally { open = false; staged = null; }
    },
    async writeLibraryFileMatchBatch(args) {
      assert.equal(open, true); assert.equal(args.queryable, queryable); writes.push(args);
      await args.beforeWrite({ queryable, stage: 'match_batch' }); events.push('write'); staged = args.matches.map((match) => match.libraryFileId);
      return { libraryFileIds: [...staged] };
    },
    ...overrides,
  };
  const service = createLibraryFileMatchService(options);
  return { input, matches, options, service, context, queryable, events, guards, writes,
    setClock(value) { clock = value; }, get committed() { return committed; } };
}

test('current match batch commits captured strategies, confidence and nullable metadata using one owner client', async () => {
  const value = fixture(); const result = await value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches });
  assert.deepEqual(result, { libraryFileIds: [FILE_ID, SECOND_FILE_ID] }); assert.equal(value.writes.length, 1);
  assert.deepEqual(value.events.slice(0, 4), ['begin', 'maintenance', 'lock', 'clock']);
  assert.deepEqual(value.events.slice(-3), ['read', 'clock', 'commit']);
  assert.equal(value.events.filter((event) => event === 'clock').length, 3);
  assert.ok(value.guards.every((guard) => guard.queryable === value.queryable && guard.prepared === value.guards[0].prepared));
  const written = value.writes[0]; assert.equal(written.expectedSources, value.guards[0].prepared.files);
  assert.equal(written.matches[0].matchedBy, 'conventional_tags'); assert.equal(written.matches[0].confidence, 'high');
  assert.equal(written.matches[0].metadataRecordingId, null); assert.equal(written.matches[1].metadataTrackId, null);
  assert.deepEqual(written.matches[1].evidence, { reason: 'missing_tag_payload' });
});

test('capture before a simulated lookup await preserves original acquisition, Date, source, nullable tags and scope', async () => {
  const value = fixture(); const date = new Date(value.input.files[0].modifiedAt); value.input.files[0].modifiedAt = date;
  const prepared = captureFileMatchBatch(value.input); await Promise.resolve();
  date.setUTCFullYear(2020); value.input.files[0].tagPayload.title = 'Changed'; value.input.files[0].tagPayload.artists.reverse();
  value.input.files[0].scopeMetadataReleaseId = uuid(99); value.input.files[0].sizeBytes = 999;
  value.input.files[1].tagPayload = {}; value.input.expectedLease.acquisitionId = uuid(99);
  assert.equal(prepared.expectedLease.acquisitionId, TOKEN); assert.equal(prepared.files[0].modifiedAt, '2026-10-10T02:00:00.000Z');
  assert.equal(prepared.files[0].scopeMetadataReleaseId, SCOPE_ID); assert.equal(prepared.files[0].sizeBytes, 42);
  assert.deepEqual(prepared.files[0].tagPayload.artists, ['Artist', 'Other']); assert.equal(prepared.files[1].tagPayload, null);
  for (const item of [prepared, prepared.expectedLease, prepared.files, prepared.files[0], prepared.files[0].tagPayload, prepared.files[0].tagPayload.artists]) assert.equal(Object.isFrozen(item), true);
  await value.service.writeOwnedLibraryFileMatchBatch({ prepared, matches: value.matches });
  assert.equal(value.writes[0].expectedSources[0].tagPayload.title, 'Track');
});

test('match results and evidence are copied before the first awaited ownership read', async () => {
  const value = fixture(); const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => {
    await Promise.resolve(); value.matches[0].metadataTrackId = uuid(99); value.matches[0].evidence.strategy = 'Changed';
    value.matches[1].matchStatus = 'matched'; return lock(args);
  };
  await value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches });
  assert.equal(value.writes[0].matches[0].metadataTrackId, uuid(25));
  assert.equal(value.writes[0].matches[0].evidence.strategy, 'conventional_tags'); assert.equal(value.writes[0].matches[1].matchStatus, 'unmatched');
  assert.equal(Object.isFrozen(value.writes[0].matches), true); assert.equal(Object.isFrozen(value.writes[0].matches[0].evidence), true);
});

test('empty current capture and results remain a no-op without transaction or writer', async () => {
  const value = fixture(); value.input.files = [];
  assert.deepEqual(await value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: [] }), { libraryFileIds: [] });
  assert.deepEqual(value.events, []); assert.equal(value.writes.length, 0);
});

test('match owner requires writer, maintenance, transaction and current-source dependencies', () => {
  const value = fixture();
  for (const name of ['writeLibraryFileMatchBatch', 'assertMaintenanceWriteAllowed', 'withTransaction']) assert.throws(() => createLibraryFileMatchService({ ...value.options, [name]: null }), TypeError);
  for (const name of ['lockContext', 'readContext', 'readClock']) assert.throws(() => createLibraryFileMatchService({ ...value.options, store: { ...value.options.store, [name]: null } }), TypeError);
});

test('malformed source, duplicate identity, ignored file or nonobject tags refuse before any transaction', async () => {
  for (const mutate of [
    (value) => { delete value.input.expectedLease.acquisitionId; },
    (value) => { value.input.libraryRootId = 'root'; },
    (value) => { value.input.files[0].canonicalPath = '/outside/track.flac'; },
    (value) => { value.input.files[0].fileState = 'ignored'; },
    (value) => { value.input.files[1].id = FILE_ID; },
    (value) => { value.input.files[0].scopeMetadataReleaseId = 'release'; },
    (value) => { value.input.files[0].modifiedAt = new Date(NaN); },
    (value) => { value.input.files[0].tagPayload = 'tags'; },
    (value) => { value.input.files[0].tagPayload = []; },
    (value) => { value.input.files[0].tagPayload.cycle = value.input.files[0].tagPayload; },
  ]) {
    const value = fixture(); mutate(value);
    await assert.rejects(value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }), { code: 'library_file_match_invalid' });
    assert.deepEqual(value.events, []); assert.equal(value.writes.length, 0);
  }
});

test('result capture rejects missing, duplicate, extra, malformed or noncanonical matched results', () => {
  const prepared = captureFileMatchBatch(inputForTest());
  for (const mutate of [
    (matches) => { matches.pop(); }, (matches) => { matches.push({ ...matches[0] }); },
    (matches) => { matches[1].libraryFileId = FILE_ID; }, (matches) => { matches[1].libraryFileId = uuid(99); },
    (matches) => { matches[0].matchStatus = 'pending'; }, (matches) => { matches[0].confidence = 'none'; },
    (matches) => { matches[0].matchedBy = ''; }, (matches) => { matches[0].metadataTrackId = null; },
    (matches) => { matches[0].metadataArtistId = 'artist'; }, (matches) => { matches[0].metadataRecordingId = 'recording'; },
    (matches) => { matches[0].evidence.cycle = matches[0].evidence; },
  ]) { const matches = matchesForTest(); mutate(matches); assert.equal(captureFileMatchResults(matches, prepared), null); }
  const ambiguous = matchesForTest(); ambiguous[1] = { libraryFileId: SECOND_FILE_ID, matchStatus: 'ambiguous', confidence: 'low',
    matchedBy: 'conventional_tags_multiple_candidates', evidence: { candidateCount: 2 } };
  const captured = captureFileMatchResults(ambiguous, prepared);
  assert.ok(captured); assert.equal(captured[1].metadataTrackId, null); assert.equal(captured[0].metadataRecordingId, null);
});

test('semantic tag comparison ignores object key order and preserves arrays, scalar types and NULL', () => {
  const value = fixture(); const prepared = captureFileMatchBatch(value.input); const file = prepared.files[0];
  const reordered = { ...value.context.files[0], tagPayload: { track: { of: 10, number: 1 }, artists: ['Artist', 'Other'], title: 'Track' } };
  assert.equal(isCurrentFileMatchSource(reordered, prepared, file), true);
  for (const tags of [{ ...reordered.tagPayload, artists: ['Other', 'Artist'] },
    { ...reordered.tagPayload, track: { number: '1', of: 10 } }, { ...reordered.tagPayload, title: 'Other' }, null]) {
    assert.equal(isCurrentFileMatchSource({ ...reordered, tagPayload: tags }, prepared, file), false);
  }
  assert.equal(isCurrentFileMatchSource(value.context.files[1], prepared, prepared.files[1]), true);
  assert.equal(isCurrentFileMatchSource({ ...value.context.files[1], tagPayload: {} }, prepared, prepared.files[1]), false);
});

test('scope comparison uses the relevant current hint, preserving unrelated summary and hint changes', async () => {
  const value = fixture(); const prepared = captureFileMatchBatch(value.input);
  value.context.run.summary.other = 'unrelated';
  value.context.run.summary.releaseHints.push({ canonicalPath: '/data/music/unrelated.flac', metadataReleaseId: uuid(99) });
  assert.equal(isCurrentFileMatchScope(value.context.run, prepared), true);
  await value.service.writeOwnedLibraryFileMatchBatch({ prepared, matches: value.matches });
  for (const hints of [[], { malformed: true }, [{ canonicalPath: value.input.files[0].canonicalPath, metadataReleaseId: uuid(99) }],
    [{ canonicalPath: value.input.files[0].canonicalPath, metadataReleaseId: SCOPE_ID }, { canonicalPath: value.input.files[0].canonicalPath, metadataReleaseId: uuid(99) }]]) {
    assert.equal(isCurrentFileMatchScope({ summary: { releaseHints: hints } }, prepared), false);
  }
});

const drifts = [
  ['replaced acquisition', (value) => { value.context.lease.acquisitionId = uuid(99); }, 'operation_run_lease_lost'],
  ['foreign owner', (value) => { value.context.lease.ownerInstanceId = 'scanner-b'; }, 'operation_run_lease_lost'],
  ['released acquisition', (value) => { value.context.lease.releasedAt = '2026-10-10T02:59:00.000Z'; }, 'operation_run_lease_lost'],
  ['expired acquisition', (value) => { value.context.lease.expiresAt = '2026-10-10T03:00:00.000Z'; }, 'operation_run_lease_lost'],
  ['foreign run', (value) => { value.context.run.id = uuid(99); }, 'operation_run_lease_lost'],
  ['foreign operation', (value) => { value.context.run.operation_type = 'library_organize_apply'; }, 'operation_run_lease_lost'],
  ['terminal run', (value) => { value.context.run.status = 'completed'; }, 'operation_run_lease_lost'],
  ['cancellation', (value) => { value.context.run.cancel_requested_at = '2026-10-10T03:00:00.000Z'; }, 'operation_run_cancelled'],
  ['requested root', (value) => { value.context.run.summary.libraryRoot = '/other'; }, 'library_file_match_stale'],
  ['missing source', (value) => { value.context.files.pop(); }, 'library_file_match_stale'],
  ['root identity', (value) => { value.context.files[0].libraryRootId = uuid(99); }, 'library_file_match_stale'],
  ['root path', (value) => { value.context.files[0].rootPath = '/other'; }, 'library_file_match_stale'],
  ['canonical path', (value) => { value.context.files[0].canonicalPath = '/data/music/other.flac'; }, 'library_file_match_stale'],
  ['size', (value) => { value.context.files[0].sizeBytes = 84; }, 'library_file_match_stale'],
  ['mtime', (value) => { value.context.files[0].modifiedAt = '2026-10-10T02:30:00.000Z'; }, 'library_file_match_stale'],
  ['ignored state', (value) => { value.context.files[0].fileState = 'ignored'; }, 'library_file_match_stale'],
  ['deleted state', (value) => { value.context.files[0].deletedAt = '2026-10-10T02:59:00.000Z'; }, 'library_file_match_stale'],
  ['changed tags with unchanged physical tuple', (value) => { value.context.files[0].tagPayload.title = 'Changed'; }, 'library_file_match_stale'],
  ['NULL-to-object tags', (value) => { value.context.files[1].tagPayload = {}; }, 'library_file_match_stale'],
  ['object-to-NULL tags', (value) => { value.context.files[0].tagPayload = null; }, 'library_file_match_stale'],
  ['relevant scope', (value) => { value.context.run.summary.releaseHints[0].metadataReleaseId = uuid(99); }, 'library_file_match_stale'],
];
for (const [name, mutate, code] of drifts) {
  test(`match ${name} drift refuses the entire batch before any projection write`, async () => {
    const value = fixture(); mutate(value);
    await assert.rejects(value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }), { code });
    assert.equal(value.writes.length, 0); assert.deepEqual(value.committed, ['previous-match']); assert.equal(value.events.at(-1), 'rollback');
  });
}

test('maintenance conflict pauses before source locks, and unrelated outages escape without a write', async () => {
  for (const failure of [Object.assign(new Error('Maintenance'), { code: 'recovery_lock_conflict' }), new Error('Unavailable')]) {
    const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw failure; } });
    await assert.rejects(value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }),
      (error) => failure.code === 'recovery_lock_conflict' ? error.code === 'operation_run_paused' : error === failure);
    assert.equal(value.guards.length, 0); assert.equal(value.writes.length, 0);
  }
});

test('match owner refreshes clock after waited locks and uses its original client despite callback arguments', async () => {
  const value = fixture(); const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => { await Promise.resolve(); value.setClock(Date.parse(value.context.lease.expiresAt)); return lock(args); };
  await assert.rejects(value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }), { code: 'operation_run_lease_lost' });
  assert.equal(value.writes.length, 0);
  const other = fixture({ writeLibraryFileMatchBatch: async (args) => {
    await args.beforeWrite({ queryable: { foreign: true } }); await args.beforeWrite(); return { libraryFileIds: [FILE_ID, SECOND_FILE_ID] };
  } });
  await other.service.writeOwnedLibraryFileMatchBatch({ prepared: other.input, matches: other.matches });
  assert.ok(other.guards.every((guard) => guard.queryable === other.queryable));
});

for (const [name, mutate, code] of [
  ['expiry', (value) => { value.setClock(Date.parse(value.context.lease.expiresAt)); }, 'operation_run_lease_lost'],
  ['one stale sibling', (value) => { value.context.files[1].sizeBytes = 999; }, 'library_file_match_stale'],
  ['scope', (value) => { value.context.run.summary.releaseHints = []; }, 'library_file_match_stale'],
]) {
  test(`final match ${name} refusal rolls back every provisional match`, async () => {
    const value = fixture(); const writer = value.options.writeLibraryFileMatchBatch;
    const service = createLibraryFileMatchService({ ...value.options, writeLibraryFileMatchBatch: async (args) => {
      const result = await writer(args); mutate(value); return result;
    } });
    await assert.rejects(service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }), { code });
    assert.equal(value.events.includes('write'), true); assert.equal(value.events.includes('commit'), false);
    assert.deepEqual(value.committed, ['previous-match']); assert.equal(value.events.at(-1), 'rollback');
  });
}

test('write failures and incomplete or foreign result identities never become unmatched success', async () => {
  const failure = new Error('Write unavailable'); let calls = 0;
  const value = fixture({ writeLibraryFileMatchBatch: async () => { calls += 1; throw failure; } });
  await assert.rejects(value.service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }), (error) => error === failure);
  assert.equal(calls, 1); assert.equal(value.events.at(-1), 'rollback');
  for (const result of [null, {}, { libraryFileIds: [FILE_ID] }, { libraryFileIds: [FILE_ID, FILE_ID] }, { libraryFileIds: [FILE_ID, uuid(99)] }]) {
    const item = fixture({ writeLibraryFileMatchBatch: async () => result });
    await assert.rejects(item.service.writeOwnedLibraryFileMatchBatch({ prepared: item.input, matches: item.matches }), { code: 'library_file_match_incomplete' });
    assert.equal(item.events.at(-1), 'rollback');
  }
});

test('match capture reuses valid double-dot and POSIX backslash identities beside traversal negatives', () => {
  for (const root of ['/data/music', 'D:\\Music', '\\\\server\\Music']) {
    const input = inputForTest(); input.libraryRootPath = root; input.files = [input.files[0]];
    for (const relativePath of ['..track.flac', '..Archive/track.flac']) {
      input.files[0].canonicalPath = root === '/data/music' ? `${root}/${relativePath}` : `${root}\\${relativePath.replaceAll('/', '\\')}`;
      input.files[0].relativePath = relativePath; input.files[0].filename = relativePath.split('/').at(-1);
      assert.ok(captureFileMatchBatch(input));
    }
    input.files[0].canonicalPath = root === '/data/music' ? `${root}/../outside.flac` : `${root}\\..\\outside.flac`;
    input.files[0].relativePath = '../outside.flac'; input.files[0].filename = 'outside.flac';
    assert.equal(captureFileMatchBatch(input), null);
  }
  const input = inputForTest(); input.files = [input.files[0]]; input.files[0].filename = 'track\\part.flac';
  input.files[0].relativePath = input.files[0].filename; input.files[0].canonicalPath = `/data/music/${input.files[0].filename}`;
  assert.ok(captureFileMatchBatch(input));
});

test('actual match owner and raw writer share a client and refuse partial CAS without borrowing or retry', async () => {
  for (const partial of [false, true]) {
    const value = fixture(); let calls = 0;
    value.queryable.query = async (sql, values) => {
      calls += 1; assert.match(sql, /INSERT INTO library_file_matches/u);
      const ids = partial ? values[0].slice(0, 1) : values[0];
      return { rowCount: ids.length, rows: ids.map((libraryFileId) => ({ library_file_id: libraryFileId })) };
    };
    const rawStore = createLibraryFileMatchStore({ getPoolFn: () => { assert.fail('Owning client already exists'); } });
    const service = createLibraryFileMatchService({ ...value.options, writeLibraryFileMatchBatch: rawStore.writeLibraryFileMatchBatch });
    if (partial) {
      await assert.rejects(service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }), { code: 'library_file_match_stale' });
      assert.equal(value.events.at(-1), 'rollback');
    } else {
      assert.deepEqual(await service.writeOwnedLibraryFileMatchBatch({ prepared: value.input, matches: value.matches }), { libraryFileIds: [FILE_ID, SECOND_FILE_ID] });
      assert.equal(value.events.at(-1), 'commit');
    }
    assert.equal(calls, 1); assert.ok(value.guards.every((guard) => guard.queryable === value.queryable));
  }
});
