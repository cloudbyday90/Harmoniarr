/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { captureWantedContext, captureWantedRows, captureWantedSource, sameWantedProjection, isCompleteWantedReplacement } from '../../src/server/library/library-wanted-release-reconciliation-policy.js';
import { MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from '../../src/server/import-candidates/music-queue-recovery-policy.js';

const uuid = (value) => `60000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const NOW = Date.parse('2026-10-10T13:00:00.000Z');
const RUN_ID = uuid(1); const TOKEN = uuid(2); const USER_A = uuid(10); const USER_B = uuid(11); const RELEASE = uuid(30);
const pair = (appUserId, metadataReleaseId = RELEASE) => ({ appUserId, metadataReleaseId });
function wantedRows() {
  return [USER_A, USER_B].map((appUserId) => ({ appUserId, metadataArtistId: uuid(20), metadataReleaseGroupId: uuid(21), metadataReleaseId: RELEASE,
    wantedStatus: 'missing', expectedTrackCount: 10, matchedTrackCount: 0, missingTrackCount: 10, releaseDate: '2028', releaseStatus: 'Official',
    evidence: { strategy: 'monitored_release_absent', selectionSource: 'policy' } }));
}
function fixture(operationType = 'library_scan', overrides = {}) {
  const input = { workerContext: { runId: RUN_ID, operationType,
    expectedLease: { leaseKey: `${operationType}:${RUN_ID}`, acquisitionId: TOKEN, ownerInstanceId: 'worker-a' } } };
  const context = { run: { id: RUN_ID, operation_type: operationType, status: 'running', summary: {}, cancel_requested_at: null, cancelled_at: null },
    lease: { ...input.workerContext.expectedLease, releasedAt: null, expiresAt: '2026-10-10T14:00:00.000Z' } };
  let rows = wantedRows(); let source = { monitoring: [{ appUserId: USER_A, minimumQuality: 'high', isEnabled: false }], selections: [], overrides: [], availability: [] };
  let clock = NOW; let afterRead = null; let reads = 0; let open = false; let staged;
  let committed = { keys: [pair(USER_A, uuid(99))], links: 'prior' };
  const events = []; const guards = []; const writes = [];
  const queryable = { async query(sql) { events.push(sql); return { rows: [] }; } };
  const options = {
    getPoolFn: () => { assert.fail('Owning transaction already has its client'); },
    store: {
      async lockContext(args) { events.push('lock'); guards.push(args); assert.equal(args.queryable, queryable); return structuredClone(context); },
      async readContext(args) { events.push('read'); guards.push(args); assert.equal(args.queryable, queryable); return structuredClone(context); },
      async readClock(client) { events.push('clock'); assert.equal(client, queryable); return clock; },
    },
    async assertMaintenanceWriteAllowed({ queryable: client }) { events.push('maintenance'); assert.equal(open, true); assert.equal(client, queryable); },
    async withTransaction(work) {
      assert.equal(open, false); events.push('begin'); open = true; staged = structuredClone(committed);
      try { const result = await work(queryable); committed = staged; events.push('commit'); return result; }
      catch (error) { events.push('rollback'); throw error; } finally { open = false; staged = null; }
    },
    projectionReader: { async readWantedReleaseProjection({ queryable: client }) {
      assert.equal(client, queryable); events.push('projection'); reads += 1;
      const snapshot = structuredClone({ wantedReleases: rows, source }); await afterRead?.(reads); return snapshot;
    } },
    libraryWantedReleaseStore: { async replaceLibraryWantedReleases(args) {
      assert.equal(args.queryable, queryable); writes.push(args);
      const next = args.wantedReleases.map(({ appUserId, metadataReleaseId }) => pair(appUserId, metadataReleaseId));
      const deleted = staged.keys.filter((key) => !next.some((row) => sameWantedProjection(row, key)));
      await args.beforeWrite({ queryable, stage: 'delete' }); events.push('delete'); staged.keys = staged.keys.filter((key) => !deleted.includes(key));
      if (next.length) { await args.beforeWrite({ queryable, stage: 'upsert_batch' }); events.push('upsert'); staged.keys = next; }
      await args.beforeWrite({ queryable, stage: 'links' }); events.push('links'); staged.links = 'current';
      return { wantedKeys: next, deletedWantedKeys: deleted };
    } }, ...overrides,
  };
  return { input, context, options, service: createLibraryWantedReleaseService(options), events, guards, writes, queryable,
    setRows(value) { rows = value; }, setSource(value) { source = value; }, setClock(value) { clock = value; }, afterRead(work) { afterRead = work; },
    get reads() { return reads; }, get source() { return source; }, get committed() { return committed; } };
}

for (const type of ['library_scan', 'library_discovery_dispatch', 'metadata_artist_refresh']) {
  test(`${type} original acquisition owns same-client wanted replacement and link handoff`, async () => {
    const value = fixture(type); const result = await value.service.reconcileWantedReleases(value.input);
    assert.deepEqual(result.wantedKeys, [pair(USER_A), pair(USER_B)]); assert.equal(value.reads, 5);
    assert.deepEqual(value.events.slice(0, 4), ['begin', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED', 'maintenance', 'lock']);
    assert.equal(value.events.at(-1), 'commit'); assert.equal(value.committed.links, 'current');
    assert.ok(value.guards.every((args) => args.queryable === value.queryable && args.prepared.expectedLease.acquisitionId === TOKEN));
    assert.equal(value.writes[0].wantedReleases[0].releaseDate, '2028-01-01');
  });
}
test('omitted worker context permits a direct rebuild while present undefined/null/partial contexts cannot fall back', async () => {
  const direct = fixture(); await direct.service.reconcileWantedReleases(); assert.equal(direct.events.includes('maintenance'), true);
  assert.equal(direct.events.includes('clock'), false); assert.equal(direct.events.at(-1), 'commit');
  for (const workerContext of [undefined, null, {}, { runId: RUN_ID }, { ...fixture().input.workerContext, operationType: 'backup_restore_apply' },
    { ...fixture().input.workerContext, expectedLease: { leaseKey: `library_scan:${RUN_ID}`, ownerInstanceId: 'worker-a' } }]) {
    const value = fixture(); await assert.rejects(value.service.reconcileWantedReleases({ workerContext }), { code: 'library_wanted_projection_invalid' });
    assert.deepEqual(value.events, []);
  }
});
test('captured context keeps the original token and type when caller input changes during admission', async () => {
  const value = fixture(); const lock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => { await Promise.resolve(); value.input.workerContext.expectedLease.acquisitionId = uuid(98);
    value.input.workerContext.operationType = 'metadata_artist_refresh'; return lock(args); };
  await value.service.reconcileWantedReleases(value.input);
  assert.equal(value.guards[0].prepared.operationType, 'library_scan'); assert.equal(value.guards[0].prepared.expectedLease.acquisitionId, TOKEN);
  assert.equal(Object.isFrozen(value.guards[0].prepared.expectedLease), true);
});
test('scoped recovery cannot use the generic owner even with a live discovery acquisition', async () => {
  const value = fixture('library_discovery_dispatch'); value.context.run.summary.triggerSource = MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE;
  await assert.rejects(value.service.reconcileWantedReleases(value.input), { code: 'library_wanted_projection_invalid' }); assert.equal(value.reads, 0);
});
test('valid empty wanted projection still deletes stale pairs and synchronizes links atomically', async () => {
  const value = fixture(); value.setRows([]);
  assert.deepEqual(await value.service.reconcileWantedReleases(value.input), { wantedKeys: [], deletedWantedKeys: [pair(USER_A, uuid(99))] });
  assert.equal(value.events.includes('delete'), true); assert.equal(value.events.includes('upsert'), false);
  assert.equal(value.committed.links, 'current'); assert.deepEqual(value.committed.keys, []);
});
test('source/profile change with identical wanted rows refuses before DELETE, while housekeeping changes remain equivalent', async () => {
  const value = fixture(); value.afterRead(async (read) => { if (read === 1) value.source.monitoring[0].minimumQuality = 'lossless'; });
  await assert.rejects(value.service.reconcileWantedReleases(value.input), { code: 'library_wanted_projection_stale' }); assert.equal(value.events.includes('delete'), false);
  const other = fixture(); other.afterRead(async (read) => { other.source.updatedAt = String(read); other.source.monitoring[0].fetchedAt = String(read); });
  await other.service.reconcileWantedReleases(other.input); assert.equal(other.events.at(-1), 'commit');
});
for (const [name, mutate] of [
  ['monitor identity', (value) => { value.source.monitoring[0].appUserId = USER_B; }],
  ['selection', (value) => { value.source.selections.push({ selected: true }); }],
  ['track override', (value) => { value.source.overrides.push({ included: false }); }],
  ['availability', (value) => { value.source.availability.push({ reconciliationStatus: 'complete' }); }],
  ['metadata', (value) => { value.source.metadata = { releases: [uuid(98)] }; }],
]) {
  test(`${name} changes during source reads refuse obsolete global replacement`, async () => {
    const value = fixture(); value.afterRead(async (read) => { if (read === 1) mutate(value); });
    await assert.rejects(value.service.reconcileWantedReleases(value.input), { code: 'library_wanted_projection_stale' });
    assert.equal(value.events.includes('delete'), false); assert.deepEqual(value.committed.keys, [pair(USER_A, uuid(99))]);
  });
}
test('source capture preserves decision dates/nulls and frozen nested policy; paired row identities remain separate', () => {
  const input = { minimumQuality: 'high', effectiveDate: new Date('2026-10-10T00:00:00.000Z'), missing: null,
    nested: { updatedAt: 'old', minimumBitrateKbps: 320 } };
  const source = captureWantedSource(input); input.nested.minimumBitrateKbps = 256; input.effectiveDate.setUTCFullYear(2020);
  assert.equal(source.nested.minimumBitrateKbps, 320); assert.equal(source.effectiveDate, '2026-10-10T00:00:00.000Z');
  assert.equal(source.missing, null); assert.equal(Object.hasOwn(source.nested, 'updatedAt'), false); assert.equal(Object.isFrozen(source.nested), true);
  const rows = captureWantedRows(wantedRows()); assert.equal(rows.length, 2); assert.equal(Object.isFrozen(rows[0].evidence), true);
  assert.equal(captureWantedRows([wantedRows()[0], wantedRows()[0]]), null);
  assert.equal(isCompleteWantedReplacement({ wantedKeys: [pair(USER_A), pair(USER_B)], deletedWantedKeys: [] }, rows), true);
  for (const result of [{ wantedKeys: [pair(USER_A), pair(USER_A)], deletedWantedKeys: [] }, { wantedKeys: [pair(USER_A)], deletedWantedKeys: [] },
    { wantedKeys: [pair(USER_A), pair(USER_B)], deletedWantedKeys: [pair(USER_A)] },
    { wantedKeys: [pair(USER_A), pair(USER_B)], deletedWantedKeys: [{ appUserId: 'foreign', metadataReleaseId: RELEASE }] }]) assert.equal(isCompleteWantedReplacement(result, rows), false);
  assert.equal(captureWantedContext({}).mode, 'direct'); assert.equal(captureWantedContext({ workerContext: undefined }), null);
});
test('malformed projection/source or invalid paired counts fail before persistence', async () => {
  for (const projection of [{ wantedReleases: null, source: {} }, { wantedReleases: [], source: null },
    { wantedReleases: [{ ...wantedRows()[0], missingTrackCount: 1 }], source: {} },
    { wantedReleases: [wantedRows()[0], wantedRows()[0]], source: {} },
    { wantedReleases: [{ ...wantedRows()[0], appUserId: 'user' }], source: {} }]) {
    const value = fixture('library_scan', { projectionReader: { readWantedReleaseProjection: async () => projection } });
    await assert.rejects(value.service.reconcileWantedReleases(value.input), { code: 'library_wanted_projection_invalid' }); assert.equal(value.writes.length, 0);
  }
});
for (const [name, mutate, code] of [
  ['replacement', (value) => { value.context.lease.acquisitionId = uuid(98); }, 'operation_run_lease_lost'],
  ['expiry', (value) => { value.setClock(Date.parse(value.context.lease.expiresAt)); }, 'operation_run_lease_lost'],
  ['cancel', (value) => { value.context.run.cancel_requested_at = '2026-10-10T13:00:00.000Z'; }, 'operation_run_cancelled'],
]) {
  test(`worker ${name} during awaited source read prevents cleanup and link handoff`, async () => {
    const value = fixture(); value.afterRead(async (read) => { await Promise.resolve(); if (read === 1) mutate(value); });
    await assert.rejects(value.service.reconcileWantedReleases(value.input), { code }); assert.equal(value.events.includes('delete'), false);
  });
}
test('maintenance is required for direct rebuilds and becomes an existing pause only for workers', async () => {
  const failure = Object.assign(new Error('Maintenance'), { code: 'recovery_lock_conflict' });
  for (const worker of [true, false]) {
    const value = fixture('library_scan', { assertMaintenanceWriteAllowed: async () => { throw failure; } });
    await assert.rejects(value.service.reconcileWantedReleases(worker ? value.input : {}),
      (error) => worker ? error.code === 'operation_run_paused' : error === failure);
    assert.equal(value.reads, 0); assert.equal(value.writes.length, 0);
  }
});
for (const [name, after] of [['before links', 3], ['after links', 4]]) {
  test(`late source change ${name} rolls back wanted rows and synchronized links`, async () => {
    const value = fixture(); value.afterRead(async (read) => { if (read === after) value.source.monitoring[0].minimumQuality = 'lossless'; });
    await assert.rejects(value.service.reconcileWantedReleases(value.input), { code: 'library_wanted_projection_stale' });
    assert.equal(value.events.includes('upsert'), true); assert.equal(value.events.includes('commit'), false);
    assert.deepEqual(value.committed, { keys: [pair(USER_A, uuid(99))], links: 'prior' });
  });
}
test('required link/write failures propagate once and malformed output never returns successful projection', async () => {
  const failure = new Error('Link sync failed'); let calls = 0;
  const value = fixture('library_scan', { libraryWantedReleaseStore: { replaceLibraryWantedReleases: async () => { calls += 1; throw failure; } } });
  await assert.rejects(value.service.reconcileWantedReleases(value.input), (error) => error === failure); assert.equal(calls, 1);
  for (const result of [null, {}, { wantedKeys: [pair(USER_A)], deletedWantedKeys: [] },
    { wantedKeys: [pair(USER_A), pair(USER_B)], deletedWantedKeys: [pair(USER_A)] }]) {
    const item = fixture('library_scan', { libraryWantedReleaseStore: { replaceLibraryWantedReleases: async () => result } });
    await assert.rejects(item.service.reconcileWantedReleases(item.input), { code: 'library_wanted_projection_incomplete' }); assert.equal(item.events.at(-1), 'rollback');
  }
});

test('actual reader, owner and legacy raw facade share one client for two-user wanted rows and required links', async () => {
  const value = fixture(); const queryable = value.queryable; const statements = []; let linkCalls = 0; let monitoringReads = 0;
  queryable.query = async (sql, values) => {
    statements.push(sql);
    if (/SELECT app_user_id, metadata_release_id FROM library_wanted_releases/u.test(sql)) return { rows: [{ app_user_id: USER_A, metadata_release_id: uuid(99) }] };
    if (/DELETE FROM library_wanted_releases/u.test(sql)) return { rowCount: 1, rows: [{ app_user_id: USER_A, metadata_release_id: uuid(99) }] };
    if (/INSERT INTO library_wanted_releases/u.test(sql)) return { rowCount: values[0].length,
      rows: values[0].map((appUserId, index) => ({ app_user_id: appUserId, metadata_release_id: values[3][index] })) };
    return { rows: [] };
  };
  const sameClient = (args) => { assert.equal(args.queryable, queryable); };
  const reader = createLibraryWantedReleaseReader({
    listOperatorArtistMonitoringSnapshot: async (args) => {
      sameClient(args); monitoringReads += 1;
      return [USER_A, USER_B].map((appUserId) => ({ appUserId, metadataArtistId: uuid(20), isMonitored: true,
        monitoredReleaseGroupTypes: ['album'], releaseScope: 'current_and_future', wantedAutomationMode: 'current_and_future_matching' }));
    },
    getMetadataArtist: async (args) => { sameClient(args); return { artist: { id: uuid(20) },
      releaseGroups: [{ id: uuid(21), primaryType: 'album', title: 'Album' }],
      releases: [{ id: RELEASE, releaseGroupId: uuid(21), title: 'Album', isCanonical: true, releaseDate: '2028', trackCount: 10, status: 'Official' }] }; },
    listOperatorReleaseGroupSelections: async (args) => { sameClient(args); return []; },
    listOperatorTrackOverrides: async (args) => { sameClient(args); return []; },
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async (args) => { sameClient(args); return []; },
  });
  const raw = createLibraryWantedReleaseStore({ getPoolFn: () => { assert.fail('Owning client already exists'); },
    libraryDiscoveryRequestWantedReleaseLinkStore: { async syncActiveWantedReleaseLinks({ client }) { assert.equal(client, queryable); linkCalls += 1; } },
  });
  const service = createLibraryWantedReleaseService({ ...value.options, projectionReader: reader, libraryWantedReleaseStore: raw });
  assert.deepEqual(await service.reconcileWantedReleases(value.input), { wantedKeys: [pair(USER_A), pair(USER_B)], deletedWantedKeys: [pair(USER_A, uuid(99))] });
  assert.equal(monitoringReads, 5); assert.equal(linkCalls, 1);
  assert.equal(statements.filter((sql) => /DELETE FROM library_wanted_releases/u.test(sql)).length, 1);
  assert.equal(statements.filter((sql) => /INSERT INTO library_wanted_releases/u.test(sql)).length, 1);
  assert.ok(statements.every((sql) => !/^(BEGIN|COMMIT|ROLLBACK)$/u.test(sql))); assert.equal(value.events.at(-1), 'commit');
});
