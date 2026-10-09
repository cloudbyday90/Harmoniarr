/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryOrganizeMutationService } from '../../src/server/library/library-organize-mutation-service.js';
import { captureOrganizeMutation, isCurrentOrganizeFile, isVerifiedOrganizeMove } from '../../src/server/library/library-organize-mutation-policy.js';

const RUN_ID = '10000000-0000-4000-8000-000000000001';
const FILE_ID = '10000000-0000-4000-8000-000000000002';
const ROOT_ID = '10000000-0000-4000-8000-000000000003';
const TOKEN = '10000000-0000-4000-8000-000000000004';
const NOW = Date.parse('2026-10-09T12:00:00.000Z');

function inputForTest() {
  const root = '/library'; const source = '/library/old.flac'; const destination = '/library/Artist/01 Track.flac';
  return { runId: RUN_ID, expectedLease: { leaseKey: `library_organize_apply:${RUN_ID}`, ownerInstanceId: 'worker-a', acquisitionId: TOKEN },
    file: { fileId: FILE_ID, libraryRootId: ROOT_ID, libraryRootPath: root, currentPath: source,
      proposedPath: destination, proposedRelativePath: 'Artist/01 Track.flac' },
    plan: { sourcePath: source, sourceRoot: root, destinationPath: destination, destinationRoot: root,
      requestedMode: 'move', removeSourceAfterSuccess: true, fallbackMode: null } };
}
function verifiedResult() {
  return { transport: 'copy_then_remove', sourceRemoved: true,
    verification: { sourceRemoved: true, destinationExists: true, sourceExistsAfterSuccess: false,
      sourceSizeBytes: 42, destinationSizeBytes: 42 } };
}
function fixture(overrides = {}) {
  const input = inputForTest(); const events = []; const locked = []; const writes = [];
  const context = { run: { id: RUN_ID, operation_type: 'library_organize_apply', status: 'running', cancel_requested_at: null, cancelled_at: null },
    lease: { ...input.expectedLease, expiresAt: '2026-10-09T13:00:00.000Z', releasedAt: null },
    file: { id: FILE_ID, libraryRootId: ROOT_ID, rootPath: '/library', canonicalPath: '/library/old.flac', fileState: 'observed', deletedAt: null } };
  let openTransactions = 0; let now = NOW;
  const options = {
    store: {
      async lockContext({ prepared, queryable }) { events.push('lock'); locked.push({ prepared, queryable }); return context; },
      async readClock(queryable) { events.push('clock'); assert.equal(queryable, locked.at(-1).queryable); return now; },
      async updateCanonicalPath(value) { events.push('write'); writes.push(value); return true; },
    },
    async withTransaction(work) {
      const queryable = { transaction: events.length }; events.push('begin'); openTransactions += 1;
      try { const result = await work(queryable); events.push('commit'); return result; }
      catch (error) { events.push('rollback'); throw error; }
      finally { openTransactions -= 1; }
    },
    async assertMaintenanceWriteAllowed({ queryable }) { events.push('maintenance'); assert.equal(openTransactions, 1); assert.ok(queryable); },
    async applyExclusiveFileMutationPlan(plan, { beforeMutation }) {
      events.push('filesystem'); assert.equal(openTransactions, 0); assert.equal(Object.isFrozen(plan), true);
      for (const stage of ['prepare_destination', 'write_destination', 'remove_source']) {
        await beforeMutation({ stage }); assert.equal(openTransactions, 0); events.push(stage);
      }
      return verifiedResult();
    },
    ...overrides,
  };
  const service = createLibraryOrganizeMutationService(options);
  return { input, context, events, locked, writes, options, service, setNow(value) { now = value; } };
}

test('organize mutation uses short current-owned transactions for every future effect and final path write', async () => {
  const value = fixture(); const result = await value.service.applyOrganizeMutation(value.input);
  assert.deepEqual(result, verifiedResult());
  assert.equal(value.locked.length, 4); assert.equal(value.writes.length, 1);
  const prepared = value.locked[0].prepared;
  assert.ok(value.locked.every((entry) => entry.prepared === prepared));
  assert.equal(value.writes[0].prepared, prepared);
  assert.equal(value.writes[0].context, value.context);
  assert.equal(value.writes[0].queryable, value.locked[3].queryable);
  assert.deepEqual(prepared.expectedLease, value.input.expectedLease);
  assert.equal(Object.isFrozen(prepared), true);
  assert.equal(Object.isFrozen(prepared.expectedLease), true);
  assert.equal(Object.isFrozen(prepared.file), true);
  assert.equal(value.events.filter((event) => event === 'commit').length, 4);
  for (let index = 0; index < value.events.length; index += 1) {
    if (value.events[index] === 'lock') assert.deepEqual(value.events.slice(index - 1, index + 2), ['maintenance', 'lock', 'clock']);
  }
  assert.deepEqual(value.events.slice(-3), ['clock', 'write', 'commit']);
});

test('organize captures file, roots, plan and acquisition before an awaited guard can observe mutated caller arguments', async () => {
  const value = fixture(); let lockedOnce = false;
  const originalLock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => {
    if (!lockedOnce) {
      lockedOnce = true;
      await Promise.resolve();
      value.input.expectedLease.acquisitionId = '10000000-0000-4000-8000-000000000005';
      value.input.file.currentPath = '/library/other.flac'; value.input.file.proposedPath = '/outside/other.flac';
      value.input.file.libraryRootId = '10000000-0000-4000-8000-000000000006';
      value.input.plan.sourcePath = '/library/other.flac'; value.input.plan.destinationRoot = '/outside';
    }
    return originalLock(args);
  };
  await value.service.applyOrganizeMutation(value.input);
  const prepared = value.writes[0].prepared;
  assert.equal(prepared.expectedLease.acquisitionId, TOKEN);
  assert.equal(prepared.file.currentPath, '/library/old.flac');
  assert.equal(prepared.file.libraryRootId, ROOT_ID);
  assert.equal(prepared.plan.sourcePath, '/library/old.flac');
  assert.equal(prepared.plan.destinationRoot, '/library');
  assert.equal(prepared.file.proposedPath, '/library/Artist/01 Track.flac');
  assert.notEqual(prepared.expectedLease, value.input.expectedLease);
  assert.notEqual(prepared.file, value.input.file); assert.notEqual(prepared.plan, value.input.plan);
});

test('organize requires every trusted guard and transport dependency', () => {
  const value = fixture();
  for (const name of ['withTransaction', 'applyExclusiveFileMutationPlan', 'assertMaintenanceWriteAllowed']) {
    assert.throws(() => createLibraryOrganizeMutationService({ ...value.options, [name]: null }), TypeError);
  }
  for (const name of ['lockContext', 'readClock', 'updateCanonicalPath']) {
    assert.throws(() => createLibraryOrganizeMutationService({ ...value.options, store: { ...value.options.store, [name]: null } }), TypeError);
  }
});

const invalidInputs = [
  ['missing acquisition', (input) => { delete input.expectedLease.acquisitionId; }],
  ['foreign lease key', (input) => { input.expectedLease.leaseKey = 'library_scan:other'; }],
  ['invalid run ID', (input) => { input.runId = 'run'; }],
  ['invalid file ID', (input) => { input.file.fileId = 'file'; }],
  ['missing root ID', (input) => { delete input.file.libraryRootId; }],
  ['relative current path', (input) => { input.file.currentPath = 'old.flac'; }],
  ['outside source', (input) => { input.file.currentPath = '/other/old.flac'; input.plan.sourcePath = input.file.currentPath; }],
  ['outside destination', (input) => { input.file.proposedPath = '/other/new.flac'; input.plan.destinationPath = input.file.proposedPath; }],
  ['different relative destination', (input) => { input.file.proposedRelativePath = 'Other/01 Track.flac'; }],
  ['different source plan', (input) => { input.plan.sourcePath = '/library/other.flac'; }],
  ['different plan root', (input) => { input.plan.destinationRoot = '/other'; }],
  ['copy plan', (input) => { input.plan.requestedMode = 'copy'; }],
  ['retained source plan', (input) => { input.plan.removeSourceAfterSuccess = false; }],
  ['fallback plan', (input) => { input.plan.fallbackMode = 'copy'; }],
];
for (const [name, mutate] of invalidInputs) {
  test(`organize refuses ${name} before invoking filesystem or acquiring write context`, async () => {
    const value = fixture(); mutate(value.input);
    await assert.rejects(value.service.applyOrganizeMutation(value.input), { code: 'library_organize_plan_stale' });
    assert.deepEqual(value.events, []); assert.equal(value.writes.length, 0);
  });
}

const invalidContexts = [
  ['replaced acquisition', (value) => { value.context.lease.acquisitionId = '10000000-0000-4000-8000-000000000005'; }, 'operation_run_lease_lost'],
  ['foreign owner', (value) => { value.context.lease.ownerInstanceId = 'worker-b'; }, 'operation_run_lease_lost'],
  ['released acquisition', (value) => { value.context.lease.releasedAt = '2026-10-09T11:59:00.000Z'; }, 'operation_run_lease_lost'],
  ['expired acquisition', (value) => { value.context.lease.expiresAt = '2026-10-09T12:00:00.000Z'; }, 'operation_run_lease_lost'],
  ['missing run', (value) => { value.context.run = null; }, 'operation_run_lease_lost'],
  ['foreign run', (value) => { value.context.run.id = '10000000-0000-4000-8000-000000000005'; }, 'operation_run_lease_lost'],
  ['foreign operation', (value) => { value.context.run.operation_type = 'library_scan'; }, 'operation_run_lease_lost'],
  ['terminal run', (value) => { value.context.run.status = 'completed'; }, 'operation_run_lease_lost'],
  ['cancelled run', (value) => { value.context.run.cancelled_at = '2026-10-09T11:59:00.000Z'; }, 'operation_run_cancelled'],
  ['requested cancellation', (value) => { value.context.run.cancel_requested_at = '2026-10-09T11:59:00.000Z'; }, 'operation_run_cancelled'],
  ['missing file', (value) => { value.context.file = null; }, 'library_organize_plan_stale'],
  ['changed source', (value) => { value.context.file.canonicalPath = '/library/other.flac'; }, 'library_organize_plan_stale'],
  ['changed root', (value) => { value.context.file.rootPath = '/other'; }, 'library_organize_plan_stale'],
  ['changed root identity', (value) => { value.context.file.libraryRootId = '10000000-0000-4000-8000-000000000006'; }, 'library_organize_plan_stale'],
  ['deleted file', (value) => { value.context.file.deletedAt = '2026-10-09T11:59:00.000Z'; }, 'library_organize_plan_stale'],
  ['unobserved file', (value) => { value.context.file.fileState = 'missing'; }, 'library_organize_plan_stale'],
];
for (const [name, mutate, code] of invalidContexts) {
  test(`organize ${name} stops before the first authorized filesystem effect`, async () => {
    const value = fixture(); mutate(value);
    await assert.rejects(value.service.applyOrganizeMutation(value.input), { code });
    assert.equal(value.events.includes('prepare_destination'), false);
    assert.equal(value.events.includes('write'), false);
    assert.equal(value.events.at(-1), 'rollback');
  });
}

test('organize checks a fresh authoritative clock after context waits', async () => {
  const value = fixture(); const originalLock = value.options.store.lockContext;
  value.options.store.lockContext = async (args) => { await Promise.resolve(); value.setNow(Date.parse(value.context.lease.expiresAt)); return originalLock(args); };
  await assert.rejects(value.service.applyOrganizeMutation(value.input), { code: 'operation_run_lease_lost' });
  assert.deepEqual(value.events.slice(-3), ['lock', 'clock', 'rollback']);
  assert.equal(value.events.includes('prepare_destination'), false);
});

test('organize converts a current maintenance conflict to a pause before reading mutation context', async () => {
  const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw Object.assign(new Error('Maintenance'), { code: 'recovery_lock_conflict' }); } });
  await assert.rejects(value.service.applyOrganizeMutation(value.input), { code: 'operation_run_paused', runId: RUN_ID });
  assert.equal(value.locked.length, 0); assert.equal(value.writes.length, 0);
  assert.equal(value.events.at(-1), 'rollback');
});

test('organize preserves maintenance read failures rather than treating an outage as authority', async () => {
  const failure = new Error('Database unavailable');
  const value = fixture({ assertMaintenanceWriteAllowed: async () => { throw failure; } });
  await assert.rejects(value.service.applyOrganizeMutation(value.input), (error) => error === failure);
  assert.equal(value.locked.length, 0); assert.equal(value.writes.length, 0);
});

test('organize rechecks cancellation after a prior stage has committed', async () => {
  const value = fixture({ applyExclusiveFileMutationPlan: async (plan, { beforeMutation }) => {
    await beforeMutation({ stage: 'prepare_destination' });
    value.context.run.cancel_requested_at = '2026-10-09T12:00:00.000Z';
    await beforeMutation({ stage: 'write_destination' });
    assert.fail('Cancelled mutation must not reach destination write');
  } });
  await assert.rejects(value.service.applyOrganizeMutation(value.input), { code: 'operation_run_cancelled' });
  assert.equal(value.events.filter((event) => event === 'commit').length, 1);
  assert.equal(value.writes.length, 0);
});

test('organize rechecks ownership before catalogue persistence after a verified filesystem effect', async () => {
  const value = fixture({ applyExclusiveFileMutationPlan: async (plan, { beforeMutation }) => {
    await beforeMutation({ stage: 'prepare_destination' });
    value.context.lease.acquisitionId = '10000000-0000-4000-8000-000000000005';
    return verifiedResult();
  } });
  await assert.rejects(value.service.applyOrganizeMutation(value.input), { code: 'operation_run_lease_lost' });
  assert.equal(value.writes.length, 0);
  assert.equal(value.events.filter((event) => event === 'commit').length, 1);
  assert.equal(value.events.at(-1), 'rollback');
});

test('organize zero-row path CAS is a rolled-back stale refusal without success', async () => {
  const value = fixture();
  value.options.store.updateCanonicalPath = async (args) => { value.writes.push(args); value.events.push('write'); return false; };
  await assert.rejects(value.service.applyOrganizeMutation(value.input), { code: 'library_organize_plan_stale' });
  assert.equal(value.writes.length, 1); assert.equal(value.events.at(-1), 'rollback');
  assert.equal(value.events.filter((event) => event === 'commit').length, 3);
});

test('organize refuses incomplete or inconsistent native verification before updating the catalogue', async () => {
  for (const mutate of [
    (result) => { result.sourceRemoved = false; },
    (result) => { result.verification.sourceRemoved = false; },
    (result) => { result.verification.destinationExists = false; },
    (result) => { result.verification.sourceExistsAfterSuccess = true; },
    (result) => { result.verification.destinationSizeBytes = 41; },
    (result) => { result.verification.sourceSizeBytes = -1; result.verification.destinationSizeBytes = -1; },
    (result) => { result.verification.sourceSizeBytes = 1.5; result.verification.destinationSizeBytes = 1.5; },
  ]) {
    const result = verifiedResult(); mutate(result);
    const value = fixture({ applyExclusiveFileMutationPlan: async () => result });
    await assert.rejects(value.service.applyOrganizeMutation(value.input), { code: 'library_organize_move_unverified' });
    assert.equal(value.writes.length, 0); assert.equal(value.locked.length, 0);
  }
});

test('organize policy binds Windows absolute roots, relative destination and current file identity', () => {
  const input = inputForTest();
  Object.assign(input.file, { libraryRootPath: 'D:\\Music', currentPath: 'D:\\Music\\old.flac',
    proposedPath: 'D:\\Music\\Artist\\01 Track.flac', proposedRelativePath: 'Artist/01 Track.flac' });
  Object.assign(input.plan, { sourceRoot: 'D:\\Music', destinationRoot: 'D:\\Music',
    sourcePath: input.file.currentPath, destinationPath: input.file.proposedPath });
  const prepared = captureOrganizeMutation(input); assert.ok(prepared);
  assert.equal(prepared.file.filename, '01 Track.flac');
  assert.equal(isCurrentOrganizeFile({ id: FILE_ID, libraryRootId: ROOT_ID, fileState: 'observed', deletedAt: null,
    rootPath: 'd:\\music', canonicalPath: 'd:\\music\\OLD.flac' }, prepared), true);
  input.file.proposedRelativePath = 'Other/01 Track.flac'; assert.equal(captureOrganizeMutation(input), null);
  assert.equal(isVerifiedOrganizeMove(verifiedResult()), true);
});
