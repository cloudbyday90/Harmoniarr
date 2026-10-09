/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createDownloadAttempt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createImportExecutionPreparationClosureService } from '../../src/server/import-candidates/import-execution-preparation-closure-service.js';
import { hasCertifiedPreProviderRefusal } from '../../src/server/import-candidates/import-execution-pre-provider-policy.js';

const preparedAt = '2026-10-09T20:00:00.000Z';
const observedAt = '2026-10-09T20:10:00.000Z';
const closedAt = '2026-10-09T20:10:02.000Z';

function fixture({ staged = false, empty = false } = {}) {
  const operationRunId = randomUUID();
  const importCandidateId = randomUUID();
  const candidate = { id: importCandidateId, status: 'selected', username: 'peer', folderPath: 'Album',
    sourceSearchId: randomUUID(), sourceProvider: 'slskd', sourceResponseKey: 'response', updatedAt: preparedAt,
    normalizedPayload: {}, files: [{ id: randomUUID(), filename: '01.flac', folderPath: 'Album', extension: 'flac',
      sizeBytes: 1000, rawPayload: { filename: 'Album/01.flac' }, isLocked: empty }] };
  const requestedFiles = empty ? [] : [{ filename: 'Album\\01.flac', size: 1000 }];
  const lease = { leaseKey: 'import_candidate_execution_planning:' + operationRunId,
    ownerInstanceId: 'original-worker', acquiredAt: preparedAt };
  const epoch = { version: 1, epochId: randomUUID(), operationRunId, importCandidateId, generation: 1,
    preparedAt, phase: 'preparing', lease, sourceObservation: captureRecoveryObservation(candidate), requestedFiles };
  const execution = { requestedFiles, outcome: 'preparing', handoff: { state: 'preparing', preProviderEpoch: epoch } };
  if (staged) {
    execution.handoff.attempt = createDownloadAttempt({ operationRunId, importCandidateId, requestedFiles,
      username: 'peer', sourceObservation: epoch.sourceObservation,
      providerBinding: { protocol: 'batch', version: '0.26.0', endpointFingerprint: 'a'.repeat(64) } });
    epoch.attemptId = execution.handoff.attempt.attemptId;
    execution.handoff.state = 'dispatching';
  }
  const run = { id: operationRunId, operationType: 'import_candidate_execution_planning', status: 'failed',
    claimedAt: null, claimedByInstanceId: null, cancelRequestedAt: null, cancelledAt: null, attemptCount: 1,
    summary: { downloadPreparationProtocol: { version: 1 }, executionMode: 'download_enqueue',
      selectedCandidateId: importCandidateId, requestedCandidateCount: 1, triggerSource: 'manual' } };
  const item = { id: randomUUID(), operationRunId, importCandidateId, itemStatus: staged ? 'awaiting_confirmation' : 'ready',
    planningSnapshot: { execution } };
  return { context: { run, item, candidate, observedAt, runItemCount: 1, runTransferLinkCount: 0, transferLinkCount: 0,
    lease: { ...lease, jobType: run.operationType, expiresAt: '2026-10-09T20:01:00.000Z', releasedAt: null } },
  operationRunId, importCandidateId, expectedEpoch: structuredClone(epoch) };
}

// These explicit transaction/store doubles verify the owning service contract, not SQL locking.
function harness(options = {}) {
  const f = fixture(options);
  let committed = { context: f.context, audits: [], clock: closedAt };
  let working;
  let observedAtLock;
  const events = [];
  const queryable = { transaction: 'closure-test' };
  let transactionCount = 0;
  const mark = (name, receivedQueryable) => {
    assert.equal(receivedQueryable, queryable);
    events.push(name);
    if (options.throwAt === name) throw options.failure;
  };
  const withTransaction = async (callback) => {
    transactionCount += 1;
    working = structuredClone(committed);
    try {
      const result = await callback(queryable);
      committed = working;
      return result;
    } finally {
      working = null;
    }
  };
  const store = {
    lockContext: async ({ runId, importCandidateId, queryable: supplied }) => {
      mark('lock', supplied);
      assert.equal(runId, f.operationRunId);
      assert.equal(importCandidateId, f.importCandidateId);
      options.onLock?.(working.context);
      observedAtLock = structuredClone(working.context);
      return working.context;
    },
    acquireClosureLease: async ({ runId, ownerInstanceId, queryable: supplied }) => {
      mark('acquire', supplied);
      assert.equal(runId, f.operationRunId);
      const lease = { leaseKey: 'import_candidate_execution_planning:' + runId, ownerInstanceId, acquisitionId: randomUUID(),
        acquiredAt: '2026-10-09T20:10:01.000Z', expiresAt: '2026-10-09T20:11:01.000Z',
        releasedAt: null, jobType: 'import_candidate_execution_planning' };
      working.context.lease = options.leaseOverride ? options.leaseOverride(lease, f) : lease;
      return working.context.lease;
    },
    readClock: async (supplied) => { mark('clock', supplied); return options.readClock ?? working.clock; },
    saveEpoch: async ({ context, epoch, itemStatus, outcome, handoffState, statusMessage, queryable: supplied }) => {
      mark('epoch', supplied);
      if (options.failAt === 'epoch') return false;
      assert.equal(context, working.context);
      const execution = context.item.planningSnapshot.execution;
      execution.requestedFiles = structuredClone(epoch.requestedFiles);
      execution.outcome = outcome;
      execution.handoff.preProviderEpoch = structuredClone(epoch);
      execution.handoff.state = handoffState;
      context.item.itemStatus = itemStatus;
      context.item.statusMessage = statusMessage;
      return true;
    },
    saveClosureFence: async ({ context, closure, queryable: supplied }) => {
      mark('fence', supplied);
      if (options.failAt === 'fence') return false;
      assert.equal(context, working.context);
      context.run.status = 'cancelled';
      context.run.cancelRequestedAt ??= closure.closedAt;
      context.run.cancelledAt ??= closure.closedAt;
      context.run.summary.downloadPreparationClosure = structuredClone(closure);
      return true;
    },
    releaseClosureLease: async ({ runId, lease, queryable: supplied }) => {
      mark('release', supplied);
      assert.equal(runId, f.operationRunId);
      if (options.failAt === 'release' || Date.parse(lease.expiresAt) <= Date.parse(working.clock)) return false;
      working.context.lease.releasedAt = working.clock;
      return true;
    },
  };
  const recordAuditEventFn = async (event, supplied) => {
    mark('audit', supplied);
    working.audits.push(structuredClone(event));
    if (options.advanceClockDuringAudit) working.clock = '2026-10-09T20:11:02.000Z';
  };
  const service = createImportExecutionPreparationClosureService({ store, withTransaction, recordAuditEventFn });
  return { service, input: { operationRunId: f.operationRunId, importCandidateId: f.importCandidateId, expectedEpoch: f.expectedEpoch },
    events, get state() { return structuredClone(committed); },
    get observedAtLock() { return structuredClone(observedAtLock); }, get transactionCount() { return transactionCount; } };
}

test('closure commits the blocked item, reciprocal cancelled parent, fresh released lease and required audit together', async () => {
  for (const staged of [false, true]) {
    const h = harness({ staged });
    const before = h.state;
    const originalInput = structuredClone(h.input);
    assert.deepEqual(await h.service.closeAbandonedPreparation(h.input), { closed: true });
    const state = h.state;
    const epoch = state.context.item.planningSnapshot.execution.handoff.preProviderEpoch;
    assert.equal(state.context.item.itemStatus, 'blocked');
    assert.equal(state.context.run.status, 'cancelled');
    assert.equal(epoch.phase, 'refused');
    assert.equal(epoch.refusal.reasonCode, 'preparation_abandoned');
    assert.deepEqual(epoch.closure, state.context.run.summary.downloadPreparationClosure);
    assert.deepEqual(epoch.lease, before.context.item.planningSnapshot.execution.handoff.preProviderEpoch.lease);
    assert.notDeepEqual(epoch.closure.lease, epoch.lease);
    assert.equal(epoch.closure.lease.ownerInstanceId, state.context.lease.ownerInstanceId);
    assert.equal(epoch.closure.lease.acquisitionId, state.context.lease.acquisitionId);
    assert.equal(Object.hasOwn(epoch.lease, 'acquisitionId'), false);
    assert.equal(state.context.lease.releasedAt, closedAt);
    assert.deepEqual(state.context.item.planningSnapshot.execution.handoff.attempt,
      before.context.item.planningSnapshot.execution.handoff.attempt);
    assert.equal(hasCertifiedPreProviderRefusal(state.context), true);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0].actorType, 'system');
    assert.equal(state.audits[0].actorUserId, null);
    assert.equal(state.audits[0].eventType, 'import_execution_preparation_closed');
    assert.equal(state.audits[0].entityId, h.input.operationRunId);
    assert.deepEqual(state.audits[0].details, { importCandidateId: h.input.importCandidateId,
      epochId: epoch.epochId, generation: epoch.generation, reasonCode: 'preparation_abandoned' });
    assert.deepEqual(h.input, originalInput);
    assert.equal(h.transactionCount, 1);
  }
});

test('current cancellation observed under the owner records its bounded provenance without restoring or rearming', async () => {
  const cancellationTime = '2026-10-09T20:05:00.000Z';
  const h = harness({ onLock: (context) => {
    context.run.cancelRequestedAt = new Date(cancellationTime);
    context.run.cancelledAt = new Date(cancellationTime);
  } });
  assert.deepEqual(await h.service.closeAbandonedPreparation(h.input), { closed: true });
  const state = h.state;
  const epoch = state.context.item.planningSnapshot.execution.handoff.preProviderEpoch;
  assert.equal(epoch.refusal.reasonCode, 'operation_cancelled');
  assert.equal(epoch.closure.cancelRequestedAt, cancellationTime);
  assert.equal(epoch.closure.cancelledAt, cancellationTime);
  assert.equal(state.context.candidate.status, 'selected');
  assert.deepEqual(state.context.item.planningSnapshot.execution.requestedFiles, h.input.expectedEpoch.requestedFiles);
  assert.equal(state.context.item.planningSnapshot.execution.handoff.attempt, undefined);
  assert.equal(hasCertifiedPreProviderRefusal(state.context), true);
});

test('malformed or crossed observed epochs refuse before opening a transaction', async () => {
  for (const transform of [
    () => null, (epoch) => ({ ...epoch, epochId: 'not-an-epoch' }),
    (epoch) => ({ ...epoch, phase: 'may_have_dispatched', attemptId: randomUUID(), dispatchPossibleAt: closedAt }),
    (epoch) => ({ ...epoch, phase: 'refused', refusal: { reasonCode: 'provider_changed', refusedAt: closedAt } }),
  ]) {
    const h = harness();
    h.input.expectedEpoch = transform(h.input.expectedEpoch);
    assert.deepEqual(await h.service.closeAbandonedPreparation(h.input),
      { closed: false, reasonCode: 'preparation_not_eligible' });
    assert.equal(h.transactionCount, 0);
    assert.deepEqual(h.events, []);
  }
});

test('locked source/epoch/claim/lease/old protocol changes refuse with no write, lease acquisition or audit', async () => {
  for (const [label, onLock] of Object.entries({
    currentClaim: (c) => { c.run.claimedByInstanceId = 'new-worker'; },
    liveLease: (c) => { c.lease.expiresAt = '2026-10-09T20:11:00.000Z'; },
    currentSearch: (c) => { c.candidate.sourceSearchId = randomUUID(); },
    newerEpoch: (c) => { c.item.planningSnapshot.execution.handoff.preProviderEpoch.generation += 1; },
    oldProtocol: (c) => { delete c.run.summary.downloadPreparationProtocol; },
    nullClosureMarker: (c) => { c.run.summary.downloadPreparationClosure = null; },
    reservedRecovery: (c) => { c.run.summary.musicQueueRecovery = {}; },
  })) {
    const h = harness({ onLock });
    const result = await h.service.closeAbandonedPreparation(h.input);
    assert.equal(result.closed, false, label);
    assert.deepEqual(h.events, ['lock'], label);
    assert.equal(h.state.audits.length, 0, label);
    assert.deepEqual(h.state.context, h.observedAtLock, label);
  }
});

test('missing, expired, released, malformed or reused acquired closure lease cannot authorize sealing', async () => {
  for (const leaseOverride of [
    () => null, () => ({}), (lease) => ({ ...lease, expiresAt: closedAt }),
    (lease) => ({ ...lease, releasedAt: closedAt }),
    (lease) => ({ ...lease, ownerInstanceId: '' }),
    (lease, f) => {
      const historical = { ...lease, ...f.expectedEpoch.lease };
      delete historical.acquisitionId;
      return historical;
    },
    (lease) => ({ ...lease, acquiredAt: '2026-10-09T20:11:00.000Z' }),
  ]) {
    const h = harness({ leaseOverride });
    const before = h.state;
    await assert.rejects(h.service.closeAbandonedPreparation(h.input), { code: 'import_execution_preparation_closure_stale' });
    assert.deepEqual(h.state, before);
    assert.equal(h.events.includes('epoch'), false);
    assert.equal(h.events.includes('audit'), false);
  }
});

test('an invalid final clock refuses the acquired owner without any committed mutation', async () => {
  const h = harness({ readClock: 'not-a-clock' });
  const before = h.state;
  await assert.rejects(h.service.closeAbandonedPreparation(h.input), { code: 'import_execution_preparation_closure_stale' });
  assert.deepEqual(h.state, before);
  assert.equal(h.events.includes('epoch'), false);
});

for (const failAt of ['epoch', 'fence', 'release']) {
  test('failed ' + failAt + ' CAS throws and rolls back every closure change', async () => {
    const h = harness({ failAt });
    const before = h.state;
    await assert.rejects(h.service.closeAbandonedPreparation(h.input), { code: 'import_execution_preparation_closure_stale' });
    assert.deepEqual(h.state, before);
    assert.equal(hasCertifiedPreProviderRefusal(h.state.context), false);
    assert.equal(h.transactionCount, 1);
  });
}

test('required audit failure rolls back item/parent/lease and is not retried through an alternate seal', async () => {
  const failure = new Error('Controlled required audit refusal');
  const h = harness({ throwAt: 'audit', failure });
  const before = h.state;
  await assert.rejects(h.service.closeAbandonedPreparation(h.input), (error) => error === failure);
  assert.deepEqual(h.state, before);
  assert.equal(h.events.filter((event) => event === 'epoch').length, 1);
  assert.equal(h.events.filter((event) => event === 'fence').length, 1);
  assert.equal(h.events.filter((event) => event === 'audit').length, 1);
  assert.equal(h.events.includes('release'), false);
  assert.equal(h.transactionCount, 1);
});

test('expiry during required audit makes the final lease release fail and rolls back the certificate', async () => {
  const h = harness({ advanceClockDuringAudit: true });
  const before = h.state;
  await assert.rejects(h.service.closeAbandonedPreparation(h.input), { code: 'import_execution_preparation_closure_stale' });
  assert.equal(h.events.includes('audit'), true);
  assert.equal(h.events.includes('release'), true);
  assert.deepEqual(h.state, before);
  assert.equal(hasCertifiedPreProviderRefusal(h.state.context), false);
});

test('repeating a closed observation performs no additional audit or lease acquisition', async () => {
  const h = harness();
  assert.deepEqual(await h.service.closeAbandonedPreparation(h.input), { closed: true });
  const committed = h.state;
  const eventCount = h.events.length;
  assert.equal((await h.service.closeAbandonedPreparation(h.input)).closed, false);
  assert.deepEqual(h.state, committed);
  assert.deepEqual(h.events.slice(eventCount), ['lock']);
  assert.equal(h.state.audits.length, 1);
});
