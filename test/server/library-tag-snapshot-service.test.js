/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { captureTagSnapshotPayload, captureTagSnapshotSource, isCurrentTagSnapshotSource, isTagSnapshotRefusal } from '../../src/server/library/library-tag-snapshot-policy.js';
import { createLibraryTagSnapshotService } from '../../src/server/library/library-tag-snapshot-service.js';
import { createLibraryTagSnapshotStore } from '../../src/server/library/library-tag-snapshot-store.js';

const RUN_ID = '30000000-0000-4000-8000-000000000001';
const TOKEN = '30000000-0000-4000-8000-000000000002';
const ROOT_ID = '30000000-0000-4000-8000-000000000003';
const FILE_ID = '30000000-0000-4000-8000-000000000004';
const SNAPSHOT_ID = '30000000-0000-4000-8000-000000000005';
const NOW = Date.parse('2026-10-10T00:00:00.000Z');

function inputForTest() {
  return { runId: RUN_ID, expectedLease: { leaseKey: `library_scan:${RUN_ID}`, acquisitionId: TOKEN, ownerInstanceId: 'scanner-a' },
    requestedLibraryRoot: '/configured-music', libraryRootPath: '/data/music', libraryRootId: ROOT_ID,
    file: { id: FILE_ID, canonicalPath: '/data/music/Artist/track.flac', relativePath: 'Artist/track.flac', filename: 'track.flac',
      extension: '.flac', fileState: 'observed', sizeBytes: 42, modifiedAt: '2026-10-09T23:00:00.000Z' } };
}
function payloadForTest(status = 'extracted') {
  return { extractor: 'music-metadata', extractorVersion: '11.16.0', status,
    audioCodec: status === 'extracted' ? 'FLAC' : null,
    normalizedTags: status === 'extracted' ? { title: 'Track', artists: ['Artist'] } : null,
    rawTags: status === 'extracted' ? { native: { vorbis: [{ id: 'TITLE', value: 'Track' }] } } : { error: 'Unsupported content' } };
}
function fixture(overrides = {}) {
  const input = inputForTest(); const payload = payloadForTest(); const events = []; const guards = []; const writes = [];
  const queryable = { connection: 'owned-tag-transaction' };
  const context = { run: { id: RUN_ID, operation_type: 'library_scan', status: 'running', summary: { libraryRoot: input.requestedLibraryRoot },
    cancel_requested_at: null, cancelled_at: null },
  lease: { ...input.expectedLease, releasedAt: null, expiresAt: '2026-10-10T01:00:00.000Z' },
  file: { id: FILE_ID, libraryRootId: ROOT_ID, rootPath: '/data/music', canonicalPath: input.file.canonicalPath,
    sizeBytes: 42, modifiedAt: input.file.modifiedAt, fileState: 'observed', deletedAt: null } };
  let clock = NOW; let open = false; let staged;
  let committed = { snapshotCount: 0, tagPayload: { title: 'Previous' } };
  const options = {
    store: {
      async lockContext(args) { events.push('lock'); guards.push(args); assert.equal(args.queryable, queryable); return context; },
      async readContext(args) { events.push('read'); guards.push(args); assert.equal(args.queryable, queryable); return context; },
      async readClock(client) { events.push('clock'); assert.equal(open, true); assert.equal(client, queryable); return clock; },
    },
    async assertMaintenanceWriteAllowed({ queryable: client }) { events.push('maintenance'); assert.equal(open, true); assert.equal(client, queryable); },
    async withTransaction(work) {
      assert.equal(open, false); open = true; events.push('begin'); staged = structuredClone(committed);
      try { const result = await work(queryable); committed = staged; events.push('commit'); return result; }
      catch (error) { events.push('rollback'); throw error; }
      finally { open = false; staged = null; }
    },
    async writeLibraryFileTagSnapshot(args) {
      writes.push(args); assert.equal(open, true); assert.equal(args.queryable, queryable);
      await args.beforeWrite({ queryable, stage: 'snapshot' }); events.push('snapshot'); staged.snapshotCount += 1;
      await args.beforeWrite({ queryable, stage: 'file_update' }); events.push('file_update'); staged.tagPayload = args.normalizedTags;
      return { snapshotId: SNAPSHOT_ID, libraryFileId: FILE_ID };
    },
    ...overrides,
  };
  const service = createLibraryTagSnapshotService(options);
  return { input, payload, context, queryable, options, service, events, guards, writes,
    setClock(value) { clock = value; }, get committed() { return committed; } };
}

for (const status of ['extracted', 'failed']) {
  test(`current ${status} tag payload persists one snapshot and one current-file update in the owning transaction`, async () => {
    const value = fixture(); const payload = payloadForTest(status);
    const result = await value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload });
    assert.deepEqual(result, { snapshotId: SNAPSHOT_ID, libraryFileId: FILE_ID });
    assert.equal(value.writes.length, 1);
    assert.equal(value.events.filter((event) => event === 'clock').length, 4);
    assert.deepEqual(value.events.slice(0, 4), ['begin', 'maintenance', 'lock', 'clock']);
    assert.deepEqual(value.events.slice(-3), ['read', 'clock', 'commit']);
    assert.equal(value.committed.snapshotCount, 1); assert.deepEqual(value.committed.tagPayload, payload.normalizedTags);
    const args = value.writes[0]; assert.equal(args.libraryFileId, FILE_ID);
    assert.equal(args.expectedSource, value.guards[0].prepared.file);
    assert.equal(args.sourceSizeBytes, 42); assert.equal(args.sourceModifiedAt, value.input.file.modifiedAt);
    assert.ok(value.guards.every((guard) => guard.queryable === value.queryable && guard.prepared === value.guards[0].prepared));
  });
}

test('source capture before a simulated parser await freezes Dates, presentation and original acquisition', async () => {
  const input = inputForTest(); const date = new Date(input.file.modifiedAt); input.file.modifiedAt = date;
  const prepared = captureTagSnapshotSource(input); await Promise.resolve();
  date.setUTCFullYear(2020); input.file.canonicalPath = '/other/file.flac'; input.file.sizeBytes = 999;
  input.expectedLease.acquisitionId = '30000000-0000-4000-8000-000000000099';
  assert.equal(prepared.file.modifiedAt, '2026-10-09T23:00:00.000Z');
  assert.equal(prepared.file.canonicalPath, '/data/music/Artist/track.flac'); assert.equal(prepared.file.sizeBytes, 42);
  assert.equal(prepared.expectedLease.acquisitionId, TOKEN);
  for (const value of [prepared, prepared.file, prepared.expectedLease]) assert.equal(Object.isFrozen(value), true);
  const fixtureValue = fixture();
  await fixtureValue.service.writeOwnedLibraryFileTagSnapshot({ prepared, payload: payloadForTest() });
  assert.equal(fixtureValue.writes[0].sourceModifiedAt, '2026-10-09T23:00:00.000Z');
});

test('owner copies payload before awaited SQL and refuses caller identity or source-stamp overrides', async () => {
  const value = fixture(); Object.assign(value.payload, { libraryFileId: 'foreign', sourceSizeBytes: 999,
    sourceModifiedAt: '2020-01-01T00:00:00.000Z', expectedSource: { id: 'foreign' }, queryable: { foreign: true } });
  const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => {
    await Promise.resolve(); value.payload.normalizedTags.title = 'Changed'; value.payload.normalizedTags.artists.push('Other');
    value.payload.rawTags.native.vorbis[0].value = 'Changed'; return lock(args);
  };
  await value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload });
  const written = value.writes[0]; assert.equal(written.libraryFileId, FILE_ID); assert.equal(written.sourceSizeBytes, 42);
  assert.equal(written.sourceModifiedAt, '2026-10-09T23:00:00.000Z'); assert.equal(written.queryable, value.queryable);
  assert.deepEqual(written.normalizedTags, { title: 'Track', artists: ['Artist'] });
  assert.equal(written.rawTags.native.vorbis[0].value, 'Track');
  assert.equal(Object.isFrozen(written.normalizedTags), true); assert.equal(Object.isFrozen(written.normalizedTags.artists), true);
});

test('tag owner requires writer, maintenance, transaction and current-source dependencies', () => {
  const value = fixture();
  for (const name of ['writeLibraryFileTagSnapshot', 'assertMaintenanceWriteAllowed', 'withTransaction']) {
    assert.throws(() => createLibraryTagSnapshotService({ ...value.options, [name]: null }), TypeError);
  }
  for (const name of ['lockContext', 'readContext', 'readClock']) {
    assert.throws(() => createLibraryTagSnapshotService({ ...value.options, store: { ...value.options.store, [name]: null } }), TypeError);
  }
});

test('invalid source frames or extraction payloads refuse before a transaction or snapshot', async () => {
  for (const mutate of [
    (value) => { delete value.input.expectedLease.acquisitionId; },
    (value) => { value.input.libraryRootId = 'root'; },
    (value) => { value.input.file.id = 'file'; },
    (value) => { value.input.file.fileState = 'ignored'; },
    (value) => { value.input.file.canonicalPath = '/other/track.flac'; },
    (value) => { value.input.file.sizeBytes = -1; },
    (value) => { value.input.file.modifiedAt = new Date(NaN); },
    (value) => { value.payload.status = 'pending'; },
    (value) => { value.payload.extractor = ''; },
    (value) => { value.payload.rawTags = { invalid: 1n }; },
    (value) => { value.payload.normalizedTags = {}; value.payload.normalizedTags.cycle = value.payload.normalizedTags; },
  ]) {
    const value = fixture(); mutate(value);
    await assert.rejects(value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), { code: 'library_tag_snapshot_invalid' });
    assert.deepEqual(value.events, []); assert.equal(value.writes.length, 0);
  }
});

const drifts = [
  ['replaced acquisition', (value) => { value.context.lease.acquisitionId = '30000000-0000-4000-8000-000000000099'; }, 'operation_run_lease_lost'],
  ['released acquisition', (value) => { value.context.lease.releasedAt = '2026-10-09T23:59:00.000Z'; }, 'operation_run_lease_lost'],
  ['expired acquisition', (value) => { value.context.lease.expiresAt = '2026-10-10T00:00:00.000Z'; }, 'operation_run_lease_lost'],
  ['foreign owner', (value) => { value.context.lease.ownerInstanceId = 'scanner-b'; }, 'operation_run_lease_lost'],
  ['foreign run', (value) => { value.context.run.id = '30000000-0000-4000-8000-000000000099'; }, 'operation_run_lease_lost'],
  ['foreign operation', (value) => { value.context.run.operation_type = 'library_organize_apply'; }, 'operation_run_lease_lost'],
  ['terminal run', (value) => { value.context.run.status = 'completed'; }, 'operation_run_lease_lost'],
  ['cancellation', (value) => { value.context.run.cancel_requested_at = '2026-10-10T00:00:00.000Z'; }, 'operation_run_cancelled'],
  ['cancelled run', (value) => { value.context.run.cancelled_at = '2026-10-10T00:00:00.000Z'; }, 'operation_run_cancelled'],
  ['requested-root drift', (value) => { value.context.run.summary.libraryRoot = '/other'; }, 'library_tag_snapshot_stale'],
  ['changed file identity', (value) => { value.context.file.id = '30000000-0000-4000-8000-000000000099'; }, 'library_tag_snapshot_stale'],
  ['changed root identity', (value) => { value.context.file.libraryRootId = '30000000-0000-4000-8000-000000000099'; }, 'library_tag_snapshot_stale'],
  ['changed root path', (value) => { value.context.file.rootPath = '/other'; }, 'library_tag_snapshot_stale'],
  ['changed canonical path', (value) => { value.context.file.canonicalPath = '/data/music/other.flac'; }, 'library_tag_snapshot_stale'],
  ['changed size', (value) => { value.context.file.sizeBytes = 84; }, 'library_tag_snapshot_stale'],
  ['changed mtime', (value) => { value.context.file.modifiedAt = '2026-10-09T23:30:00.000Z'; }, 'library_tag_snapshot_stale'],
  ['ignored file', (value) => { value.context.file.fileState = 'ignored'; }, 'library_tag_snapshot_stale'],
  ['deleted file', (value) => { value.context.file.deletedAt = '2026-10-09T23:59:00.000Z'; }, 'library_tag_snapshot_stale'],
];
for (const [name, mutate, code] of drifts) {
  test(`tag ${name} refuses successful and failed snapshots without current-file updates`, async () => {
    for (const status of ['extracted', 'failed']) {
      const value = fixture(); mutate(value);
      await assert.rejects(value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: payloadForTest(status) }), { code });
      assert.equal(value.writes.length, 0); assert.equal(value.events.at(-1), 'rollback');
      assert.deepEqual(value.committed, { snapshotCount: 0, tagPayload: { title: 'Previous' } });
    }
  });
}

test('maintenance conflict pauses before locking source or appending history', async () => {
  const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw Object.assign(new Error('Maintenance'), { code: 'recovery_lock_conflict' }); } });
  await assert.rejects(value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), { code: 'operation_run_paused' });
  assert.equal(value.guards.length, 0); assert.equal(value.writes.length, 0);
});

test('a guard outage escapes unchanged without a failed metadata fallback', async () => {
  const failure = new Error('Database unavailable'); const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw failure; } });
  await assert.rejects(value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), (error) => error === failure);
  assert.equal(value.writes.length, 0); assert.equal(value.events.at(-1), 'rollback');
});

test('tag owner refreshes authoritative time after source-lock waits', async () => {
  const value = fixture(); const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => { await Promise.resolve(); value.setClock(Date.parse(value.context.lease.expiresAt)); return lock(args); };
  await assert.rejects(value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), { code: 'operation_run_lease_lost' });
  assert.equal(value.writes.length, 0); assert.deepEqual(value.events.slice(-3), ['lock', 'clock', 'rollback']);
});

test('tag callbacks retain the owning connection despite foreign or missing writer arguments', async () => {
  const value = fixture({ writeLibraryFileTagSnapshot: async (args) => {
    await args.beforeWrite({ queryable: { foreign: true }, stage: 'snapshot' }); await args.beforeWrite();
    return { snapshotId: SNAPSHOT_ID, libraryFileId: FILE_ID };
  } });
  await value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload });
  assert.ok(value.guards.every((guard) => guard.queryable === value.queryable));
  assert.equal(value.events.at(-1), 'commit');
});

for (const [name, code, mutate] of [
  ['expiry', 'operation_run_lease_lost', (value) => { value.setClock(Date.parse(value.context.lease.expiresAt)); }],
  ['source drift', 'library_tag_snapshot_stale', (value) => { value.context.file.sizeBytes = 84; }],
  ['cancellation', 'operation_run_cancelled', (value) => { value.context.run.cancel_requested_at = '2026-10-10T00:00:00.000Z'; }],
]) {
  test(`final tag ${name} check rolls back provisional history and current metadata`, async () => {
    const value = fixture(); const writer = value.options.writeLibraryFileTagSnapshot;
    const service = createLibraryTagSnapshotService({ ...value.options, writeLibraryFileTagSnapshot: async (args) => {
      const result = await writer(args); mutate(value); return result;
    } });
    await assert.rejects(service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), { code });
    assert.equal(value.events.includes('snapshot'), true); assert.equal(value.events.includes('file_update'), true);
    assert.equal(value.events.includes('commit'), false); assert.equal(value.events.at(-1), 'rollback');
    assert.deepEqual(value.committed, { snapshotCount: 0, tagPayload: { title: 'Previous' } });
  });
}

test('a snapshot writer or CAS failure escapes once and never triggers a failed-snapshot retry', async () => {
  for (const failure of [new Error('Write failed'), Object.assign(new Error('Source changed'), { code: 'library_tag_snapshot_stale' })]) {
    let calls = 0; const value = fixture({ writeLibraryFileTagSnapshot: async () => { calls += 1; throw failure; } });
    await assert.rejects(value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), (error) => error === failure);
    assert.equal(calls, 1); assert.equal(value.events.at(-1), 'rollback'); assert.equal(value.committed.snapshotCount, 0);
  }
});

test('incomplete or foreign writer results roll back rather than return extracted success', async () => {
  for (const result of [null, false, {}, { snapshotId: 'snapshot', libraryFileId: FILE_ID },
    { snapshotId: SNAPSHOT_ID, libraryFileId: '30000000-0000-4000-8000-000000000099' }]) {
    const value = fixture({ writeLibraryFileTagSnapshot: async () => result });
    await assert.rejects(value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), { code: 'library_tag_snapshot_incomplete' });
    assert.equal(value.events.at(-1), 'rollback'); assert.equal(value.events.includes('commit'), false);
  }
});

test('nullable source mtime matches only a current nullable mtime and Dates compare by immutable timestamp', async () => {
  const value = fixture(); value.input.file.modifiedAt = null; value.context.file.modifiedAt = null;
  await value.service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload });
  assert.equal(value.writes[0].sourceModifiedAt, null);
  const prepared = captureTagSnapshotSource(inputForTest());
  const current = { ...fixture().context.file, modifiedAt: new Date('2026-10-09T23:00:00.000Z') };
  assert.equal(isCurrentTagSnapshotSource(current, prepared), true);
  assert.equal(isCurrentTagSnapshotSource({ ...current, modifiedAt: null }, prepared), false);
  assert.equal(isCurrentTagSnapshotSource({ ...current, modifiedAt: new Date(NaN) }, prepared), false);
});

test('tag source preserves contained double-dot and platform filename semantics while rejecting traversal', () => {
  for (const root of ['/data/music', 'D:\\Music', '\\\\server\\Music']) {
    for (const relativePath of ['..track.flac', '..Archive/track.flac']) {
      const input = inputForTest(); input.libraryRootPath = root;
      const windows = root !== '/data/music';
      input.file = { ...input.file, canonicalPath: windows ? `${root}\\${relativePath.replaceAll('/', '\\')}` : `${root}/${relativePath}`,
        relativePath, filename: relativePath.split('/').at(-1) };
      assert.ok(captureTagSnapshotSource(input));
    }
    const input = inputForTest(); input.libraryRootPath = root;
    input.file.canonicalPath = root === '/data/music' ? `${root}/../outside.flac` : `${root}\\..\\outside.flac`;
    input.file.relativePath = '../outside.flac'; input.file.filename = 'outside.flac';
    assert.equal(captureTagSnapshotSource(input), null);
  }
  const input = inputForTest(); input.file.filename = 'track\\part.flac'; input.file.relativePath = input.file.filename;
  input.file.canonicalPath = `/data/music/${input.file.filename}`;
  const prepared = captureTagSnapshotSource(input); assert.ok(prepared);
  assert.equal(prepared.file.relativePath, 'track\\part.flac');
});

test('payload capture whitelists JSON metadata and refusal classification separates parser errors', () => {
  const payload = payloadForTest(); payload.libraryFileId = 'foreign'; payload.sourceSizeBytes = 999; payload.acquisitionId = TOKEN;
  const captured = captureTagSnapshotPayload(payload);
  for (const field of ['libraryFileId', 'sourceSizeBytes', 'acquisitionId']) assert.equal(Object.hasOwn(captured, field), false);
  for (const code of ['operation_run_lease_lost', 'operation_run_cancelled', 'operation_run_paused', 'recovery_lock_conflict',
    'library_tag_snapshot_invalid', 'library_tag_snapshot_stale', 'library_tag_snapshot_incomplete']) assert.equal(isTagSnapshotRefusal({ code }), true);
  assert.equal(isTagSnapshotRefusal(new Error('Unsupported content')), false);
  assert.equal(isTagSnapshotRefusal({ code: 'ECONNRESET' }), false);
});

test('actual tag owner and snapshot writer share one supplied client through source CAS without pool reentry', async () => {
  const value = fixture(); const statements = [];
  value.queryable.query = async (sql, values) => {
    statements.push({ sql, values });
    if (/INSERT INTO file_tag_snapshots/u.test(sql)) return { rowCount: 1, rows: [{ id: SNAPSHOT_ID, library_file_id: FILE_ID }] };
    if (/UPDATE library_files/u.test(sql)) return { rowCount: 1, rows: [{ id: FILE_ID }] };
    assert.fail('The raw snapshot writer must not manage the owning transaction');
  };
  const snapshotStore = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Owning client already exists'); } });
  const service = createLibraryTagSnapshotService({ ...value.options, writeLibraryFileTagSnapshot: snapshotStore.writeLibraryFileTagSnapshot });
  const result = await service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload });
  assert.deepEqual(result, { snapshotId: SNAPSHOT_ID, libraryFileId: FILE_ID });
  assert.equal(statements.length, 2); assert.equal(value.events.filter((event) => event === 'clock').length, 4);
  assert.ok(value.guards.every((guard) => guard.queryable === value.queryable)); assert.equal(value.events.at(-1), 'commit');
});

test('actual source CAS zero rows makes the tag owner roll back after one provisional snapshot without retry', async () => {
  const value = fixture(); const statements = [];
  value.queryable.query = async (sql) => {
    statements.push(sql);
    if (/INSERT INTO file_tag_snapshots/u.test(sql)) return { rowCount: 1, rows: [{ id: SNAPSHOT_ID }] };
    if (/UPDATE library_files/u.test(sql)) return { rowCount: 0, rows: [] };
    assert.fail('The raw writer must leave rollback to its transaction owner');
  };
  const snapshotStore = createLibraryTagSnapshotStore({ getPoolFn: () => { assert.fail('Unexpected connection'); } });
  const service = createLibraryTagSnapshotService({ ...value.options, writeLibraryFileTagSnapshot: snapshotStore.writeLibraryFileTagSnapshot });
  await assert.rejects(service.writeOwnedLibraryFileTagSnapshot({ prepared: value.input, payload: value.payload }), { code: 'library_tag_snapshot_stale' });
  assert.equal(statements.filter((sql) => /INSERT INTO file_tag_snapshots/u.test(sql)).length, 1);
  assert.equal(statements.filter((sql) => /UPDATE library_files/u.test(sql)).length, 1);
  assert.equal(value.events.includes('commit'), false); assert.equal(value.events.at(-1), 'rollback');
});
