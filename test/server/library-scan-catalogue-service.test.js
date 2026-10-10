/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryScanCatalogueService } from '../../src/server/library/library-scan-catalogue-service.js';
import { captureScanCatalogue, isCompleteScanCatalogueResult } from '../../src/server/library/library-scan-catalogue-policy.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';

const RUN_ID = '20000000-0000-4000-8000-000000000001';
const TOKEN = '20000000-0000-4000-8000-000000000002';
const ROOT_ID = '20000000-0000-4000-8000-000000000003';
const NOW = Date.parse('2026-10-09T12:00:00.000Z');

function inputForTest() {
  return { runId: RUN_ID,
    expectedLease: { leaseKey: `library_scan:${RUN_ID}`, ownerInstanceId: 'scanner-a', acquisitionId: TOKEN },
    requestedLibraryRoot: '/configured-music', libraryRootPath: '/data/music',
    files: [{ canonicalPath: '/data/music/Artist/track.flac', relativePath: 'Artist/track.flac', filename: 'track.flac',
      extension: '.flac', fileState: 'observed', sizeBytes: 42, modifiedAt: '2026-10-09T11:00:00.000Z' },
    { canonicalPath: '/data/music/Artist/booklet.txt', relativePath: 'Artist/booklet.txt', filename: 'booklet.txt',
      extension: '.txt', fileState: 'ignored', sizeBytes: 0, modifiedAt: null }] };
}
function catalogueResult(files) {
  const unique = [...new Map(files.map((file) => [file.canonicalPath, file])).values()];
  return { libraryRootId: ROOT_ID, observedFileCount: unique.length,
    files: unique.map((file, index) => ({ ...file, id: `20000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}` })) };
}
function fixture(overrides = {}) {
  const input = inputForTest(); const events = []; const guards = []; const writerCalls = [];
  const queryable = { connection: 'owned-transaction' };
  const context = { run: { id: RUN_ID, operation_type: 'library_scan', status: 'running',
    summary: { libraryRoot: input.requestedLibraryRoot }, cancel_requested_at: null, cancelled_at: null },
  lease: { ...input.expectedLease, releasedAt: null, expiresAt: '2026-10-09T13:00:00.000Z' },
  root: { id: ROOT_ID, canonicalPath: '/data/music' } };
  let clock = NOW; let open = false;
  let committed = { rootEnabled: false, paths: ['previous-file'], tombstones: false };
  let staged = null;
  const options = {
    store: {
      async lockContext(args) { events.push('lock'); assert.equal(args.queryable, queryable); guards.push(args); return context; },
      async readContext(args) { events.push('read'); assert.equal(args.queryable, queryable); guards.push(args); return context; },
      async readClock(client) { events.push('clock'); assert.equal(client, queryable); assert.equal(open, true); return clock; },
    },
    async assertMaintenanceWriteAllowed({ queryable: client }) { events.push('maintenance'); assert.equal(client, queryable); assert.equal(open, true); },
    async withTransaction(work) {
      assert.equal(open, false); events.push('begin'); open = true; staged = structuredClone(committed);
      try { const result = await work(queryable); committed = staged; events.push('commit'); return result; }
      catch (error) { events.push('rollback'); throw error; }
      finally { open = false; staged = null; }
    },
    async recordLibraryFiles(args) {
      writerCalls.push(args); assert.equal(open, true); assert.equal(args.queryable, queryable);
      await args.beforeWrite({ queryable, stage: 'root' }); events.push('root'); staged.rootEnabled = true;
      if (args.files.length) {
        await args.beforeWrite({ queryable, stage: 'file_batch' }); events.push('batch'); staged.paths = args.files.map((file) => file.canonicalPath);
      }
      await args.beforeWrite({ queryable, stage: 'tombstones' }); events.push('tombstones'); staged.tombstones = true;
      if (!args.files.length) staged.paths = [];
      return catalogueResult(args.files);
    },
    ...overrides,
  };
  const service = createLibraryScanCatalogueService(options);
  return { input, context, events, guards, writerCalls, queryable, options, service,
    setClock(value) { clock = value; }, get committed() { return committed; } };
}

test('scan catalogue owns one transaction and uses its client for every current guard and write', async () => {
  const value = fixture(); const result = await value.service.recordLibraryScanCatalogue(value.input);
  assert.deepEqual(result, catalogueResult(value.input.files));
  assert.equal(value.events.filter((event) => event === 'begin').length, 1);
  assert.equal(value.events.filter((event) => event === 'commit').length, 1);
  assert.equal(value.writerCalls.length, 1);
  assert.equal(value.events.filter((event) => event === 'clock').length, 5);
  assert.deepEqual(value.events.slice(0, 4), ['begin', 'maintenance', 'lock', 'clock']);
  assert.deepEqual(value.events.slice(-3), ['read', 'clock', 'commit']);
  assert.ok(value.guards.every((guard) => guard.prepared === value.guards[0].prepared && guard.queryable === value.queryable));
  assert.equal(value.writerCalls[0].libraryRootPath, '/data/music');
  assert.equal(value.guards[0].prepared.requestedLibraryRoot, '/configured-music');
  assert.deepEqual(value.committed, { rootEnabled: true, paths: value.input.files.map((file) => file.canonicalPath), tombstones: true });
});

test('actual scan owner and catalogue writer share the owning client without borrowing or nesting a transaction', async () => {
  const value = fixture(); const statements = [];
  value.queryable.query = async (sql, values) => {
    statements.push(sql);
    if (/INSERT INTO library_roots/u.test(sql)) return { rows: [{ id: ROOT_ID, canonical_path: values[2] }] };
    if (/WITH input_rows/u.test(sql)) return { rows: values[1].map((canonicalPath, index) => ({
      id: `20000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`, canonical_path: canonicalPath,
      relative_path: values[2][index], filename: values[3][index], extension: values[4][index],
      size_bytes: values[5][index], modified_at: values[6][index], file_state: values[7][index],
    })) };
    return { rows: [] };
  };
  const catalogue = createLibraryCatalogStore({ getPoolFn: () => { assert.fail('The owning transaction already supplies its connection'); } });
  const service = createLibraryScanCatalogueService({ ...value.options, recordLibraryFiles: catalogue.recordLibraryFiles });
  const result = await service.recordLibraryScanCatalogue(value.input);
  assert.equal(result.observedFileCount, 2); assert.equal(result.libraryRootId, ROOT_ID);
  assert.equal(result.files[0].fileState, 'observed'); assert.equal(result.files[1].fileState, 'ignored');
  assert.equal(statements.length, 3);
  assert.ok(statements.every((sql) => !/^(BEGIN|COMMIT|ROLLBACK)$/u.test(sql)));
  assert.equal(value.events.filter((event) => event === 'clock').length, 5);
  assert.ok(value.guards.every((guard) => guard.queryable === value.queryable));
  assert.equal(value.events.at(-1), 'commit');
});

test('a current empty successful scan enables its root and commits missing-file tombstones', async () => {
  const value = fixture(); value.input.files = [];
  const result = await value.service.recordLibraryScanCatalogue(value.input);
  assert.deepEqual(result, { libraryRootId: ROOT_ID, observedFileCount: 0, files: [] });
  assert.deepEqual(value.committed, { rootEnabled: true, paths: [], tombstones: true });
  assert.equal(value.events.includes('batch'), false);
  assert.equal(value.events.at(-1), 'commit');
});

test('scan captures observations, Date timestamps, roots and original token before the first awaited lock', async () => {
  const value = fixture(); const observedTime = new Date('2026-10-09T11:00:00.000Z'); value.input.files[0].modifiedAt = observedTime;
  const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => {
    await Promise.resolve(); observedTime.setUTCFullYear(2020);
    value.input.expectedLease.acquisitionId = '20000000-0000-4000-8000-000000000099';
    value.input.requestedLibraryRoot = '/other'; value.input.libraryRootPath = '/other';
    value.input.files[0].canonicalPath = '/other/wrong.flac'; value.input.files[0].sizeBytes = 999;
    value.input.files.push({ ...value.input.files[0] });
    return lock(args);
  };
  await value.service.recordLibraryScanCatalogue(value.input);
  const prepared = value.guards[0].prepared;
  assert.equal(prepared.expectedLease.acquisitionId, TOKEN);
  assert.equal(prepared.requestedLibraryRoot, '/configured-music'); assert.equal(prepared.libraryRootPath, '/data/music');
  assert.equal(prepared.files.length, 2); assert.equal(prepared.files[0].canonicalPath, '/data/music/Artist/track.flac');
  assert.equal(prepared.files[0].sizeBytes, 42); assert.equal(prepared.files[0].modifiedAt, '2026-10-09T11:00:00.000Z');
  for (const captured of [prepared, prepared.expectedLease, prepared.files, ...prepared.files]) assert.equal(Object.isFrozen(captured), true);
  assert.notEqual(prepared.files, value.input.files); assert.notEqual(prepared.files[0], value.input.files[0]);
  assert.equal(value.writerCalls[0].files, prepared.files);
});

test('scan requires the owning writer, maintenance guard, transaction and context dependencies', () => {
  const value = fixture();
  for (const name of ['recordLibraryFiles', 'assertMaintenanceWriteAllowed', 'withTransaction']) {
    assert.throws(() => createLibraryScanCatalogueService({ ...value.options, [name]: null }), TypeError);
  }
  for (const name of ['lockContext', 'readContext', 'readClock']) {
    assert.throws(() => createLibraryScanCatalogueService({ ...value.options, store: { ...value.options.store, [name]: null } }), TypeError);
  }
});

const invalidInputs = [
  ['missing token', (input) => { delete input.expectedLease.acquisitionId; }],
  ['foreign lease key', (input) => { input.expectedLease.leaseKey = 'library_scan:other'; }],
  ['invalid run ID', (input) => { input.runId = 'run'; }],
  ['missing requested root', (input) => { input.requestedLibraryRoot = ''; }],
  ['relative canonical root', (input) => { input.libraryRootPath = 'music'; }],
  ['missing observations', (input) => { input.files = null; }],
  ['outside-root file', (input) => { input.files[0].canonicalPath = '/other/track.flac'; }],
  ['different relative path', (input) => { input.files[0].relativePath = 'Other/track.flac'; }],
  ['different filename', (input) => { input.files[0].filename = 'other.flac'; }],
  ['invalid file state', (input) => { input.files[0].fileState = 'deleted'; }],
  ['negative size', (input) => { input.files[0].sizeBytes = -1; }],
  ['fractional size', (input) => { input.files[0].sizeBytes = 0.5; }],
  ['unsafe size', (input) => { input.files[0].sizeBytes = Number.MAX_SAFE_INTEGER + 1; }],
  ['invalid timestamp', (input) => { input.files[0].modifiedAt = new Date(NaN); }],
];
for (const [name, mutate] of invalidInputs) {
  test(`scan rejects ${name} before opening a transaction or writing catalogue data`, async () => {
    const value = fixture(); mutate(value.input);
    await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), { code: 'library_scan_catalogue_invalid' });
    assert.deepEqual(value.events, []); assert.equal(value.writerCalls.length, 0);
  });
}

const invalidContexts = [
  ['replaced acquisition', (value) => { value.context.lease.acquisitionId = '20000000-0000-4000-8000-000000000099'; }, 'operation_run_lease_lost'],
  ['foreign owner', (value) => { value.context.lease.ownerInstanceId = 'scanner-b'; }, 'operation_run_lease_lost'],
  ['released acquisition', (value) => { value.context.lease.releasedAt = '2026-10-09T11:59:00.000Z'; }, 'operation_run_lease_lost'],
  ['expired acquisition', (value) => { value.context.lease.expiresAt = '2026-10-09T12:00:00.000Z'; }, 'operation_run_lease_lost'],
  ['missing run', (value) => { value.context.run = null; }, 'operation_run_lease_lost'],
  ['foreign run', (value) => { value.context.run.id = '20000000-0000-4000-8000-000000000099'; }, 'operation_run_lease_lost'],
  ['foreign operation', (value) => { value.context.run.operation_type = 'library_organize_apply'; }, 'operation_run_lease_lost'],
  ['terminal run', (value) => { value.context.run.status = 'completed'; }, 'operation_run_lease_lost'],
  ['cancellation request', (value) => { value.context.run.cancel_requested_at = '2026-10-09T11:59:00.000Z'; }, 'operation_run_cancelled'],
  ['cancelled run', (value) => { value.context.run.cancelled_at = '2026-10-09T11:59:00.000Z'; }, 'operation_run_cancelled'],
  ['changed requested-root frame', (value) => { value.context.run.summary.libraryRoot = '/other'; }, 'library_scan_catalogue_stale'],
];
for (const [name, mutate, code] of invalidContexts) {
  test(`scan ${name} refuses all root, file and tombstone writes`, async () => {
    const value = fixture(); mutate(value);
    await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), { code });
    assert.equal(value.writerCalls.length, 0);
    assert.deepEqual(value.committed, { rootEnabled: false, paths: ['previous-file'], tombstones: false });
    assert.equal(value.events.at(-1), 'rollback');
  });
}

test('a stale empty scan leaves previously committed replacement observations intact', async () => {
  const value = fixture(); value.input.files = []; value.context.lease.acquisitionId = '20000000-0000-4000-8000-000000000099';
  await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), { code: 'operation_run_lease_lost' });
  assert.equal(value.writerCalls.length, 0);
  assert.deepEqual(value.committed.paths, ['previous-file']);
});

test('scan maintenance refusal pauses before ownership locks or any catalogue mutation', async () => {
  const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw Object.assign(new Error('Maintenance'), { code: 'recovery_lock_conflict' }); } });
  await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), { code: 'operation_run_paused', runId: RUN_ID });
  assert.equal(value.guards.length, 0); assert.equal(value.writerCalls.length, 0); assert.equal(value.events.at(-1), 'rollback');
});

test('scan preserves maintenance outages without authorizing catalogue work', async () => {
  const failure = new Error('Unavailable'); const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw failure; } });
  await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), (error) => error === failure);
  assert.equal(value.writerCalls.length, 0); assert.equal(value.guards.length, 0);
});

test('scan reads a fresh authoritative clock after an awaited ownership lock', async () => {
  const value = fixture(); const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => { await Promise.resolve(); value.setClock(Date.parse(value.context.lease.expiresAt)); return lock(args); };
  await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), { code: 'operation_run_lease_lost' });
  assert.equal(value.writerCalls.length, 0); assert.deepEqual(value.events.slice(-3), ['lock', 'clock', 'rollback']);
});

test('scan write callbacks close over the original transaction even if a writer supplies foreign arguments', async () => {
  const foreign = { connection: 'foreign' };
  const value = fixture({ recordLibraryFiles: async (args) => {
    await args.beforeWrite({ queryable: foreign, stage: 'root' });
    await args.beforeWrite();
    return catalogueResult(args.files);
  } });
  await value.service.recordLibraryScanCatalogue(value.input);
  assert.ok(value.guards.every((guard) => guard.queryable === value.queryable));
  assert.equal(value.events.at(-1), 'commit');
});

for (const [name, code, mutate] of [
  ['expiry', 'operation_run_lease_lost', (value) => { value.setClock(Date.parse(value.context.lease.expiresAt)); }],
  ['cancellation', 'operation_run_cancelled', (value) => { value.context.run.cancel_requested_at = '2026-10-09T12:00:00.000Z'; }],
  ['requested-root drift', 'library_scan_catalogue_stale', (value) => { value.context.run.summary.libraryRoot = '/other'; }],
]) {
  test(`scan final ${name} guard rolls back all provisional root, file and tombstone changes`, async () => {
    const value = fixture(); const writer = value.options.recordLibraryFiles;
    const service = createLibraryScanCatalogueService({ ...value.options, recordLibraryFiles: async (args) => {
      const result = await writer(args); mutate(value); return result;
    } });
    await assert.rejects(service.recordLibraryScanCatalogue(value.input), { code });
    assert.equal(value.events.includes('root'), true); assert.equal(value.events.includes('batch'), true); assert.equal(value.events.includes('tombstones'), true);
    assert.equal(value.events.includes('commit'), false); assert.equal(value.events.at(-1), 'rollback');
    assert.deepEqual(value.committed, { rootEnabled: false, paths: ['previous-file'], tombstones: false });
  });
}

test('scan rechecks current ownership between root upsert and later file writes', async () => {
  const value = fixture({ recordLibraryFiles: async (args) => {
    await args.beforeWrite({ queryable: args.queryable, stage: 'root' });
    value.context.lease.acquisitionId = '20000000-0000-4000-8000-000000000099';
    await args.beforeWrite({ queryable: args.queryable, stage: 'file_batch' });
    assert.fail('A stale batch must not run');
  } });
  await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), { code: 'operation_run_lease_lost' });
  assert.equal(value.events.at(-1), 'rollback'); assert.equal(value.events.includes('commit'), false);
});

test('scan rejects null, partial, duplicated, foreign and mismatched-root results instead of committing success', async () => {
  const invalidResults = [null, false, {},
    { ...catalogueResult(inputForTest().files), observedFileCount: 1 },
    { ...catalogueResult(inputForTest().files), files: catalogueResult(inputForTest().files).files.slice(0, 1) },
    { ...catalogueResult(inputForTest().files), libraryRootId: 'root' },
    { ...catalogueResult(inputForTest().files), libraryRootId: '20000000-0000-4000-8000-000000000099' },
  ];
  const duplicated = catalogueResult(inputForTest().files); duplicated.files[1] = { ...duplicated.files[0] }; invalidResults.push(duplicated);
  const duplicateId = catalogueResult(inputForTest().files); duplicateId.files[1].id = duplicateId.files[0].id; invalidResults.push(duplicateId);
  const foreign = catalogueResult(inputForTest().files); foreign.files[0].canonicalPath = '/other/file.flac'; invalidResults.push(foreign);
  for (const result of invalidResults) {
    const value = fixture({ recordLibraryFiles: async () => result });
    await assert.rejects(value.service.recordLibraryScanCatalogue(value.input), { code: 'library_scan_catalogue_incomplete' });
    assert.equal(value.events.at(-1), 'rollback'); assert.equal(value.events.includes('commit'), false);
  }
});

test('scan permits a new root and verifies deduplicated observation completeness without losing latest metadata', async () => {
  const value = fixture(); value.context.root = null;
  value.input.files.push({ ...value.input.files[0], sizeBytes: 84 });
  const result = await value.service.recordLibraryScanCatalogue(value.input);
  assert.equal(result.observedFileCount, 2);
  assert.equal(result.files.find((file) => file.fileState === 'observed').sizeBytes, 84);
  const prepared = captureScanCatalogue(value.input);
  assert.equal(isCompleteScanCatalogueResult(result, prepared), true);
});

test('scan policy preserves Windows and UNC root bindings without trusting an unrelated relative filename', () => {
  for (const root of ['D:\\Music', '\\\\server\\Music']) {
    const input = inputForTest(); input.requestedLibraryRoot = root; input.libraryRootPath = root;
    input.files = [{ canonicalPath: `${root}\\Artist\\track.flac`, relativePath: 'Artist/track.flac', filename: 'track.flac',
      extension: '.flac', fileState: 'observed', sizeBytes: 42, modifiedAt: new Date('2026-10-09T11:00:00.000Z') }];
    const prepared = captureScanCatalogue(input); assert.ok(prepared);
    assert.equal(prepared.files[0].modifiedAt, '2026-10-09T11:00:00.000Z');
    assert.equal(isCompleteScanCatalogueResult(catalogueResult(prepared.files), prepared), true);
    input.files[0].relativePath = '../track.flac'; assert.equal(captureScanCatalogue(input), null);
  }
});

test('scan policy accepts contained double-dot names on POSIX and Windows while refusing parent traversal', () => {
  for (const root of ['/data/music', 'D:\\Music']) {
    for (const relativePath of ['..track.flac', '..Archive/track.flac']) {
      const input = inputForTest(); input.requestedLibraryRoot = root; input.libraryRootPath = root;
      const windows = root.startsWith('D:');
      input.files = [{ canonicalPath: windows ? `${root}\\${relativePath.replaceAll('/', '\\')}` : `${root}/${relativePath}`,
        relativePath, filename: relativePath.split('/').at(-1), extension: '.flac',
        fileState: 'observed', sizeBytes: 42, modifiedAt: null }];
      const prepared = captureScanCatalogue(input);
      assert.ok(prepared, `Contained ${relativePath} should be captured beneath ${root}`);
      assert.equal(prepared.files[0].canonicalPath, input.files[0].canonicalPath);
      assert.equal(isCompleteScanCatalogueResult(catalogueResult(prepared.files), prepared), true);
    }
    const traversal = inputForTest(); traversal.requestedLibraryRoot = root; traversal.libraryRootPath = root;
    traversal.files = [{ canonicalPath: root.startsWith('D:') ? `${root}\\..\\outside.flac` : `${root}/../outside.flac`,
      relativePath: '../outside.flac', filename: 'outside.flac', extension: '.flac',
      fileState: 'observed', sizeBytes: 42, modifiedAt: null }];
    assert.equal(captureScanCatalogue(traversal), null, `Parent traversal must remain refused beneath ${root}`);
  }
});

test('scan policy preserves a literal backslash in a POSIX filename and relative path', () => {
  const input = inputForTest(); const filename = 'track\\part.flac';
  input.files = [{ canonicalPath: `/data/music/${filename}`, relativePath: filename, filename,
    extension: '.flac', fileState: 'observed', sizeBytes: 42, modifiedAt: null }];
  const prepared = captureScanCatalogue(input);
  assert.ok(prepared, 'A literal POSIX backslash is a filename character');
  assert.equal(prepared.files[0].relativePath, filename);
  assert.equal(prepared.files[0].filename, filename);
  assert.equal(isCompleteScanCatalogueResult(catalogueResult(prepared.files), prepared), true);
});
