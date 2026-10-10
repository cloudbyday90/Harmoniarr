/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReleaseReconciliationService } from '../../src/server/library/library-release-reconciliation-service.js';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';
import { createLibraryReleaseCoverageStore } from '../../src/server/library/library-release-coverage-store.js';
import { captureReleaseReconciliationContext, mapReleaseCoverageRows, sameReleaseCoverage } from '../../src/server/library/library-release-reconciliation-policy.js';

const uuid = (value) => `50000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const RUN_ID = uuid(1); const TOKEN = uuid(2); const ROOT_ID = uuid(3);
const NOW = Date.parse('2026-10-10T05:00:00.000Z');
function inputForTest() {
  return { runId: RUN_ID, expectedLease: { leaseKey: `library_scan:${RUN_ID}`, ownerInstanceId: 'scanner-a', acquisitionId: TOKEN },
    requestedLibraryRoot: '/configured-music', libraryRootPath: '/data/music', libraryRootId: ROOT_ID };
}
function coverageRow(index = 1, changes = {}) {
  return { metadata_artist_id: uuid(index + 10), metadata_release_group_id: uuid(index + 20), metadata_release_id: uuid(index + 30),
    expected_track_count: 2, matched_track_count: 2, matched_file_count: 2, duplicate_track_count: 0, ...changes };
}
function fixture(overrides = {}) {
  const input = inputForTest(); const events = []; const guards = []; const writes = [];
  const context = { run: { id: RUN_ID, operation_type: 'library_scan', status: 'running', cancel_requested_at: null, cancelled_at: null,
    summary: { libraryRoot: input.requestedLibraryRoot } },
  lease: { ...input.expectedLease, releasedAt: null, expiresAt: '2026-10-10T06:00:00.000Z' }, root: { id: ROOT_ID, canonicalPath: '/data/music' } };
  let rows = [coverageRow()]; let now = NOW; let open = false; let staged; let committed = [uuid(99)];
  let afterCoverage = null; let coverageReads = 0;
  const queryable = { async query(sql) { events.push(sql); return { rows: [] }; } };
  const options = {
    getPoolFn: () => { assert.fail('Owner already supplies a connection'); },
    store: {
      async lockContext(args) { events.push('lock'); assert.equal(args.queryable, queryable); guards.push(args); return structuredClone(context); },
      async readContext(args) { events.push('read'); assert.equal(args.queryable, queryable); guards.push(args); return structuredClone(context); },
      async readClock(client) { events.push('clock'); assert.equal(client, queryable); assert.equal(open, true); return now; },
    },
    coverageStore: { async loadLibraryReleaseCoverageRows({ queryable: client }) {
      assert.equal(client, queryable); assert.equal(open, true); events.push('coverage'); coverageReads += 1;
      const snapshot = structuredClone(rows); await afterCoverage?.(coverageReads); return snapshot;
    } },
    async assertMaintenanceWriteAllowed({ queryable: client }) { events.push('maintenance'); assert.equal(client, queryable); assert.equal(open, true); },
    async withTransaction(work) {
      assert.equal(open, false); open = true; events.push('begin'); staged = [...committed];
      try { const result = await work(queryable); committed = staged; events.push('commit'); return result; }
      catch (error) { events.push('rollback'); throw error; } finally { open = false; staged = null; }
    },
    libraryReleaseReconciliationStore: { async replaceLibraryReleaseReconciliations(args) {
      assert.equal(args.queryable, queryable); assert.equal(open, true); writes.push(args);
      await args.beforeWrite({ queryable, stage: 'delete' }); events.push('delete');
      const next = args.reconciliations.map((row) => row.metadataReleaseId); const deleted = staged.filter((id) => !next.includes(id));
      staged = staged.filter((id) => next.includes(id));
      if (next.length) { await args.beforeWrite({ queryable, stage: 'upsert_batch' }); events.push('upsert'); staged = [...next]; }
      return { metadataReleaseIds: next, deletedMetadataReleaseIds: deleted };
    } }, ...overrides,
  };
  return { input, context, options, service: createLibraryReleaseReconciliationService(options), queryable, events, guards, writes,
    setRows(value) { rows = value; }, setClock(value) { now = value; }, afterCoverage(work) { afterCoverage = work; },
    get committed() { return committed; }, get coverageReads() { return coverageReads; } };
}

test('reconcileLibraryReleases records complete and duplicate release rollups from current matched files', async () => {
  const value = fixture(); value.setRows([coverageRow(), coverageRow(2, { expected_track_count: 3, matched_track_count: 3, matched_file_count: 4, duplicate_track_count: 1 })]);
  await value.service.reconcileLibraryReleases(value.input);
  assert.deepEqual(value.writes[0].reconciliations, [
    { metadataArtistId: uuid(11), metadataReleaseGroupId: uuid(21), metadataReleaseId: uuid(31), expectedTrackCount: 2,
      matchedTrackCount: 2, matchedFileCount: 2, duplicateTrackCount: 0, missingTrackCount: 0,
      reconciliationStatus: 'complete', evidence: { strategy: 'matched_track_coverage', trackCoverage: 1 } },
    { metadataArtistId: uuid(12), metadataReleaseGroupId: uuid(22), metadataReleaseId: uuid(32), expectedTrackCount: 3,
      matchedTrackCount: 3, matchedFileCount: 4, duplicateTrackCount: 1, missingTrackCount: 0,
      reconciliationStatus: 'duplicate', evidence: { strategy: 'matched_track_coverage', trackCoverage: 1 } },
  ]);
});
test('reconcileLibraryReleases records partial coverage and clears stale release rows when nothing remains matched', async () => {
  const value = fixture(); value.setRows([coverageRow(1, { expected_track_count: 5, matched_track_count: 3, matched_file_count: 3 })]);
  await value.service.reconcileLibraryReleases(value.input);
  assert.deepEqual(value.writes[0].reconciliations, [{ metadataArtistId: uuid(11), metadataReleaseGroupId: uuid(21), metadataReleaseId: uuid(31),
    expectedTrackCount: 5, matchedTrackCount: 3, matchedFileCount: 3, duplicateTrackCount: 0, missingTrackCount: 2,
    reconciliationStatus: 'partial', evidence: { strategy: 'matched_track_coverage', trackCoverage: 0.6 } }]);
  value.setRows([]); const result = await value.service.reconcileLibraryReleases(value.input);
  assert.deepEqual(value.writes[1].reconciliations, []);
  assert.deepEqual(result, { metadataReleaseIds: [], deletedMetadataReleaseIds: [uuid(31)] }); assert.deepEqual(value.committed, []);
});
test('owner establishes READ COMMITTED before maintenance and reads global coverage through its admitted client', async () => {
  const value = fixture(); await value.service.reconcileLibraryReleases(value.input);
  assert.deepEqual(value.events.slice(0, 5), ['begin', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED', 'maintenance', 'lock', 'clock']);
  assert.equal(value.coverageReads, 4); assert.equal(value.writes.length, 1); assert.equal(value.events.at(-1), 'commit');
  assert.ok(value.guards.every((args) => args.queryable === value.queryable && args.prepared === value.guards[0].prepared));
  assert.equal(Object.isFrozen(value.writes[0].reconciliations), true); assert.equal(Object.isFrozen(value.writes[0].reconciliations[0].evidence), true);
});
test('original context is immutable before waits and caller-supplied stale aggregates are never adopted', async () => {
  const value = fixture(); value.input.reconciliations = []; value.input.coverage = []; const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => {
    await Promise.resolve(); value.input.expectedLease.acquisitionId = uuid(98); value.input.libraryRootId = uuid(98);
    value.input.libraryRootPath = '/other'; value.input.requestedLibraryRoot = '/other'; return lock(args);
  };
  await value.service.reconcileLibraryReleases(value.input); const prepared = value.guards[0].prepared;
  assert.equal(prepared.expectedLease.acquisitionId, TOKEN); assert.equal(prepared.libraryRootId, ROOT_ID);
  assert.equal(prepared.libraryRootPath, '/data/music'); assert.equal(prepared.requestedLibraryRoot, '/configured-music');
  assert.equal(Object.isFrozen(prepared), true); assert.equal(Object.hasOwn(prepared, 'reconciliations'), false);
  assert.equal(value.writes[0].reconciliations.length, 1);
});
test('coverage policy preserves status priority, canonical value comparison and immutable evidence', () => {
  const rows = [coverageRow(), coverageRow(2, { expected_track_count: 5, matched_track_count: 3, matched_file_count: 4, duplicate_track_count: 1 })];
  const mapped = mapReleaseCoverageRows(rows); assert.equal(mapped[1].reconciliationStatus, 'duplicate');
  assert.equal(mapped[1].missingTrackCount, 2); assert.equal(mapped[1].evidence.trackCoverage, 0.6);
  assert.equal(sameReleaseCoverage(mapped, mapReleaseCoverageRows([...rows].reverse())), true);
  rows[0].matched_track_count = 1; assert.equal(mapped[0].matchedTrackCount, 2);
  for (const value of [mapped, mapped[0], mapped[0].evidence]) assert.equal(Object.isFrozen(value), true);
  assert.equal(sameReleaseCoverage(mapped, mapReleaseCoverageRows(rows)), false);
});
test('invalid context or inconsistent/duplicate coverage refuses before deletion', async () => {
  for (const mutate of [(input) => { delete input.expectedLease.acquisitionId; }, (input) => { input.libraryRootId = 'root'; },
    (input) => { input.libraryRootPath = 'music'; }, (input) => { input.runId = 'run'; }]) {
    const value = fixture(); mutate(value.input);
    await assert.rejects(value.service.reconcileLibraryReleases(value.input), { code: 'library_release_reconciliation_invalid' }); assert.deepEqual(value.events, []);
  }
  for (const rows of [null, [coverageRow(), coverageRow()], [coverageRow(1, { metadata_release_id: 'release' })],
    [coverageRow(1, { expected_track_count: 0 })], [coverageRow(1, { matched_track_count: 0 })], [coverageRow(1, { duplicate_track_count: 3 })],
    [coverageRow(1, { matched_file_count: 1 })], [coverageRow(1, { matched_track_count: 1.5 })],
    [coverageRow(1, { expected_track_count: Number.MAX_SAFE_INTEGER + 1 })]]) {
    const value = fixture(); value.setRows(rows);
    await assert.rejects(value.service.reconcileLibraryReleases(value.input), { code: 'library_release_reconciliation_invalid' });
    assert.equal(value.writes.length, 0); assert.equal(value.events.at(-1), 'rollback');
  }
});
test('release owner requires authority, coverage, persistence and transaction dependencies', () => {
  const value = fixture();
  for (const name of ['assertMaintenanceWriteAllowed', 'withTransaction']) assert.throws(() => createLibraryReleaseReconciliationService({ ...value.options, [name]: null }), TypeError);
  for (const name of ['lockContext', 'readContext', 'readClock']) assert.throws(() => createLibraryReleaseReconciliationService({ ...value.options, store: { ...value.options.store, [name]: null } }), TypeError);
  assert.throws(() => createLibraryReleaseReconciliationService({ ...value.options, coverageStore: {} }), TypeError);
  assert.throws(() => createLibraryReleaseReconciliationService({ ...value.options, libraryReleaseReconciliationStore: {} }), TypeError);
  assert.equal(Object.isFrozen(captureReleaseReconciliationContext(value.input).expectedLease), true);
});
const drifts = [
  ['replaced acquisition', (value) => { value.context.lease.acquisitionId = uuid(98); }, 'operation_run_lease_lost'],
  ['foreign owner', (value) => { value.context.lease.ownerInstanceId = 'scanner-b'; }, 'operation_run_lease_lost'],
  ['expired acquisition', (value) => { value.context.lease.expiresAt = '2026-10-10T05:00:00.000Z'; }, 'operation_run_lease_lost'],
  ['released acquisition', (value) => { value.context.lease.releasedAt = '2026-10-10T04:59:00.000Z'; }, 'operation_run_lease_lost'],
  ['foreign run', (value) => { value.context.run.id = uuid(98); }, 'operation_run_lease_lost'],
  ['foreign operation', (value) => { value.context.run.operation_type = 'library_organize_apply'; }, 'operation_run_lease_lost'],
  ['terminal run', (value) => { value.context.run.status = 'completed'; }, 'operation_run_lease_lost'],
  ['cancellation', (value) => { value.context.run.cancel_requested_at = '2026-10-10T05:00:00.000Z'; }, 'operation_run_cancelled'],
  ['requested root', (value) => { value.context.run.summary.libraryRoot = '/other'; }, 'library_release_reconciliation_stale'],
  ['missing root', (value) => { value.context.root = null; }, 'library_release_reconciliation_stale'],
  ['root identity', (value) => { value.context.root.id = uuid(98); }, 'library_release_reconciliation_stale'],
  ['root path', (value) => { value.context.root.canonicalPath = '/other'; }, 'library_release_reconciliation_stale'],
];
for (const [name, mutate, code] of drifts) {
  test(`release ${name} drift refuses stale empty cleanup and all mutations`, async () => {
    const value = fixture(); value.setRows([]); mutate(value);
    await assert.rejects(value.service.reconcileLibraryReleases(value.input), { code });
    assert.equal(value.coverageReads, 0); assert.equal(value.writes.length, 0); assert.deepEqual(value.committed, [uuid(99)]);
  });
}
test('maintenance pauses before admission and unavailable checks never authorize replacement', async () => {
  for (const failure of [Object.assign(new Error('Maintenance'), { code: 'recovery_lock_conflict' }), new Error('Unavailable')]) {
    const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw failure; } });
    await assert.rejects(value.service.reconcileLibraryReleases(value.input), (error) => failure.code === 'recovery_lock_conflict' ? error.code === 'operation_run_paused' : error === failure);
    assert.equal(value.guards.length, 0); assert.equal(value.coverageReads, 0); assert.equal(value.writes.length, 0);
  }
});
test('expiry after admission waits and authority changes during coverage await refuse before deletion', async () => {
  const waited = fixture(); const lock = waited.options.store.lockContext;
  waited.options.store.lockContext = async (args) => { await Promise.resolve(); waited.setClock(Date.parse(waited.context.lease.expiresAt)); return lock(args); };
  await assert.rejects(waited.service.reconcileLibraryReleases(waited.input), { code: 'operation_run_lease_lost' }); assert.equal(waited.coverageReads, 0);
  for (const [mutate, code] of [
    [(value) => { value.setClock(Date.parse(value.context.lease.expiresAt)); }, 'operation_run_lease_lost'],
    [(value) => { value.context.run.cancel_requested_at = '2026-10-10T05:00:00.000Z'; }, 'operation_run_cancelled'],
    [(value) => { value.context.lease.acquisitionId = uuid(98); }, 'operation_run_lease_lost'],
  ]) {
    const value = fixture(); value.afterCoverage(async (read) => { await Promise.resolve(); if (read === 1) mutate(value); });
    await assert.rejects(value.service.reconcileLibraryReleases(value.input), { code });
    assert.equal(value.events.includes('delete'), false); assert.deepEqual(value.committed, [uuid(99)]);
  }
});
test('new/other-root rows and metadata counts after lookup refuse instead of adopting new coverage mid-pass', async () => {
  for (const rows of [[coverageRow(), coverageRow(2)], [coverageRow(1, { expected_track_count: 3 })],
    [coverageRow(1, { matched_file_count: 3, duplicate_track_count: 1 })], []]) {
    const value = fixture(); value.afterCoverage(async (read) => { if (read === 1) value.setRows(rows); });
    await assert.rejects(value.service.reconcileLibraryReleases(value.input), { code: 'library_release_reconciliation_stale' });
    assert.equal(value.events.includes('delete'), false); assert.deepEqual(value.committed, [uuid(99)]);
  }
});
test('aggregate ordering and irrelevant row fields do not force stale refusal', async () => {
  const value = fixture(); value.setRows([coverageRow(), coverageRow(2)]);
  value.afterCoverage(async (read) => { if (read === 1) value.setRows([{ ...coverageRow(2), unrelated_tag: 'Changed' }, coverageRow()]); });
  await value.service.reconcileLibraryReleases(value.input); assert.equal(value.events.at(-1), 'commit');
});
for (const [boundary, read] of [['before upsert', 2], ['after all writes', 3]]) {
  test(`coverage drift ${boundary} rolls back deletion and provisional upserts`, async () => {
    const value = fixture(); value.afterCoverage(async (count) => { if (count === read) value.setRows([coverageRow(2)]); });
    await assert.rejects(value.service.reconcileLibraryReleases(value.input), { code: 'library_release_reconciliation_stale' });
    assert.equal(value.events.includes('delete'), true); assert.equal(value.events.includes('commit'), false);
    assert.deepEqual(value.committed, [uuid(99)]); assert.equal(value.events.at(-1), 'rollback');
  });
}
test('final authority loss rolls back replacement and callbacks cannot redirect its client', async () => {
  const value = fixture(); const writer = value.options.libraryReleaseReconciliationStore.replaceLibraryReleaseReconciliations;
  const service = createLibraryReleaseReconciliationService({ ...value.options, libraryReleaseReconciliationStore: {
    replaceLibraryReleaseReconciliations: async (args) => { const result = await writer(args); value.setClock(Date.parse(value.context.lease.expiresAt)); return result; },
  } });
  await assert.rejects(service.reconcileLibraryReleases(value.input), { code: 'operation_run_lease_lost' });
  assert.equal(value.events.includes('upsert'), true); assert.deepEqual(value.committed, [uuid(99)]);
  const other = fixture({ libraryReleaseReconciliationStore: { async replaceLibraryReleaseReconciliations(args) {
    await args.beforeWrite({ queryable: { foreign: true } }); return { metadataReleaseIds: [uuid(31)], deletedMetadataReleaseIds: [] };
  } } });
  await other.service.reconcileLibraryReleases(other.input); assert.ok(other.guards.every((guard) => guard.queryable === other.queryable));
});
test('SQL failures and incomplete projection identities never return success or retry cached coverage', async () => {
  const failure = new Error('Write failed'); let calls = 0;
  const value = fixture({ libraryReleaseReconciliationStore: { async replaceLibraryReleaseReconciliations() { calls += 1; throw failure; } } });
  await assert.rejects(value.service.reconcileLibraryReleases(value.input), (error) => error === failure); assert.equal(calls, 1);
  for (const result of [null, {}, { metadataReleaseIds: [], deletedMetadataReleaseIds: [] },
    { metadataReleaseIds: [uuid(98)], deletedMetadataReleaseIds: [] }, { metadataReleaseIds: [uuid(31)], deletedMetadataReleaseIds: [uuid(31)] },
    { metadataReleaseIds: [uuid(31)], deletedMetadataReleaseIds: [uuid(99), uuid(99)] },
    { metadataReleaseIds: [uuid(31)], deletedMetadataReleaseIds: ['foreign'] }]) {
    const item = fixture({ libraryReleaseReconciliationStore: { async replaceLibraryReleaseReconciliations() { return result; } } });
    await assert.rejects(item.service.reconcileLibraryReleases(item.input), { code: 'library_release_reconciliation_incomplete' });
    assert.equal(item.events.at(-1), 'rollback');
  }
});
test('actual owner and raw replacer share one client for verified empty cleanup', async () => {
  const value = fixture(); value.setRows([]); const statements = [];
  value.queryable.query = async (sql) => {
    statements.push(sql);
    if (/SELECT metadata_release_id FROM library_release_reconciliations/u.test(sql)) return { rows: [{ metadata_release_id: uuid(99) }] };
    if (/DELETE FROM library_release_reconciliations/u.test(sql)) return { rowCount: 1, rows: [{ metadata_release_id: uuid(99) }] };
    return { rows: [] };
  };
  const raw = createLibraryReleaseReconciliationStore({ getPoolFn: () => { assert.fail('Owner client already exists'); } });
  const service = createLibraryReleaseReconciliationService({ ...value.options, libraryReleaseReconciliationStore: raw });
  assert.deepEqual(await service.reconcileLibraryReleases(value.input), { metadataReleaseIds: [], deletedMetadataReleaseIds: [uuid(99)] });
  assert.equal(statements.filter((sql) => /DELETE FROM library_release_reconciliations/u.test(sql)).length, 1);
  assert.equal(statements.some((sql) => /INSERT INTO library_release_reconciliations/u.test(sql)), false); assert.equal(value.events.at(-1), 'commit');
});

test('actual coverage SQL and raw replacer use the owner client for global reads and one bulk replacement', async () => {
  const value = fixture(); const statements = []; const rows = [coverageRow(), coverageRow(2)];
  value.queryable.query = async (sql, params) => {
    statements.push({ sql, params });
    if (/WITH matched_files AS/u.test(sql)) {
      assert.equal(params, undefined, 'Global aggregate must not receive the current scan root as a filter');
      assert.match(sql, /library_files.deleted_at IS NULL/u); assert.match(sql, /library_files.file_state = 'observed'/u);
      return { rows: structuredClone(rows) };
    }
    if (/SELECT metadata_release_id FROM library_release_reconciliations/u.test(sql)) return { rows: [{ metadata_release_id: uuid(99) }] };
    if (/DELETE FROM library_release_reconciliations/u.test(sql)) return { rowCount: 1, rows: [{ metadata_release_id: uuid(99) }] };
    if (/INSERT INTO library_release_reconciliations/u.test(sql)) return { rowCount: params[2].length,
      rows: params[2].map((metadataReleaseId) => ({ metadata_release_id: metadataReleaseId })) };
    return { rows: [] };
  };
  const raw = createLibraryReleaseReconciliationStore({ getPoolFn: () => { assert.fail('Owning transaction already supplies its client'); } });
  const service = createLibraryReleaseReconciliationService({ ...value.options, coverageStore: createLibraryReleaseCoverageStore(), libraryReleaseReconciliationStore: raw });
  assert.deepEqual(await service.reconcileLibraryReleases(value.input), { metadataReleaseIds: [uuid(31), uuid(32)], deletedMetadataReleaseIds: [uuid(99)] });
  assert.equal(statements.filter(({ sql }) => /WITH matched_files AS/u.test(sql)).length, 4);
  assert.equal(statements.filter(({ sql }) => /DELETE FROM library_release_reconciliations/u.test(sql)).length, 1);
  assert.equal(statements.filter(({ sql }) => /INSERT INTO library_release_reconciliations/u.test(sql)).length, 1);
  assert.ok(statements.every(({ sql }) => !/^(BEGIN|COMMIT|ROLLBACK)$/u.test(sql)));
  assert.equal(value.events.at(-1), 'commit');
});
