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
import { evaluateAbandonedPreparation } from '../../src/server/import-candidates/import-execution-preparation-closure-policy.js';
import { hasCertifiedPreProviderRefusal, validatePreProviderEpoch,
  isUnresolvedPreProviderPreparation } from '../../src/server/import-candidates/import-execution-pre-provider-policy.js';
import { evaluateUnusedExecutionAllocation } from '../../src/server/import-candidates/import-execution-origin-policy.js';

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
function rejectChanges(changes, options = {}) {
  for (const change of changes) {
    const f = fixture(options);
    change(f);
    assert.equal(evaluateAbandonedPreparation(f).eligible, false);
  }
}
function closeFixture(f) {
  const epoch = f.context.item.planningSnapshot.execution.handoff.preProviderEpoch;
  const closure = { version: 1, operationRunId: f.operationRunId, importCandidateId: f.importCandidateId,
    epochId: epoch.epochId, generation: epoch.generation, closedAt, reasonCode: 'preparation_abandoned',
    lease: { leaseKey: epoch.lease.leaseKey, ownerInstanceId: 'preparation-closure:fresh-owner',
      acquiredAt: '2026-10-09T20:10:01.000Z' }, cancelRequestedAt: null, cancelledAt: null };
  epoch.phase = 'refused';
  epoch.refusal = { reasonCode: closure.reasonCode, refusedAt: closedAt };
  epoch.closure = closure;
  f.context.run.status = 'cancelled';
  f.context.run.summary.downloadPreparationClosure = structuredClone(closure);
  f.context.item.itemStatus = 'blocked';
  f.context.item.planningSnapshot.execution.outcome = 'pre_provider_refused';
  f.context.item.planningSnapshot.execution.handoff.state = epoch.attemptId ? 'not_dispatched' : 'pre_provider_refused';
  return f;
}
function unused(f, leases = []) {
  return evaluateUnusedExecutionAllocation({ run: f.context.run, items: [f.context.item], leases,
    transferLinkCount: 0, importCandidateId: f.importCandidateId, now: Date.parse(closedAt) });
}

test('idle exact manual work permits inspection without mutating the observed preparing frame', () => {
  for (const status of ['pending', 'failed', 'completed', 'cancelled']) {
    for (const staged of [false, true]) {
      const f = fixture({ staged });
      f.context.run.status = status;
      const before = structuredClone(f);
      const result = evaluateAbandonedPreparation(f);
      assert.equal(result.eligible, true);
      assert.equal(result.reasonCode, status === 'cancelled' ? 'operation_cancelled' : 'preparation_abandoned');
      assert.deepEqual(f, before);
      assert.equal(hasCertifiedPreProviderRefusal(f.context), false);
    }
  }
  const f = fixture({ empty: true });
  f.context.run.summary.triggerSource = 'missing_music_manual';
  assert.equal(evaluateAbandonedPreparation(f).eligible, true);
});

test('only typed future protocol and exact single candidate/run/item counts permit closure', () => {
  rejectChanges([
    (f) => { delete f.context.run.summary.downloadPreparationProtocol; },
    (f) => { f.context.run.summary.downloadPreparationProtocol = null; },
    (f) => { f.context.run.summary.downloadPreparationProtocol = { version: 2 }; },
    (f) => { f.context.run.summary.executionMode = 'preview'; },
    (f) => { f.context.run.summary.selectedCandidateId = randomUUID(); },
    (f) => { f.context.run.summary.requestedCandidateCount = '1'; },
    (f) => { f.context.run.summary.requestedCandidateCount = 2; },
    (f) => { f.context.runItemCount = 2; },
    (f) => { f.context.runItemCount = undefined; },
    (f) => { f.context.run.id = randomUUID(); },
    (f) => { f.context.run.operationType = 'library_discovery'; },
    (f) => { f.context.item.operationRunId = randomUUID(); },
    (f) => { f.context.item.importCandidateId = randomUUID(); },
  ]);
});

test('reserved recovery/external scope and prior fences refuse even with explicit null markers', () => {
  for (const field of ['musicQueueRecovery', 'recoveryCascade', 'externalRequestReleaseIntentId',
    'sourceExternalRequestReleaseIntentId', 'downloadOriginSupersession', 'downloadPreparationClosure']) {
    for (const value of [null, {}]) {
      const f = fixture();
      f.context.run.summary[field] = value;
      assert.equal(evaluateAbandonedPreparation(f).eligible, false, field);
    }
  }
  for (const triggerSource of [null, 'auto_selection', 'music_queue_fallback_recovery', 'music_queue_manual_add']) {
    const f = fixture();
    f.context.run.summary.triggerSource = triggerSource;
    assert.equal(evaluateAbandonedPreparation(f).eligible, false);
  }
});

test('the observed epoch must equal its locked identity, lease, source and manifest', () => {
  rejectChanges([
    (f) => { f.expectedEpoch = null; },
    (f) => { f.expectedEpoch.epochId = randomUUID(); },
    (f) => { f.expectedEpoch.generation += 1; },
    (f) => { f.expectedEpoch.lease.ownerInstanceId = 'replacement'; },
    (f) => { f.expectedEpoch.sourceObservation.sourceSearchId = randomUUID(); },
    (f) => { f.expectedEpoch.requestedFiles[0].size += 1; },
    (f) => { f.context.item.planningSnapshot.execution.handoff.preProviderEpoch = null; },
  ]);
});

test('live/unverifiable leases, current claims and active statuses prevent closure', () => {
  for (const lease of ['expired', [], {}, { ownerInstanceId: 'unknown' }]) {
    const f = fixture();
    f.context.lease = lease;
    assert.equal(evaluateAbandonedPreparation(f).eligible, false);
  }
  rejectChanges([
    (f) => { f.context.lease.expiresAt = '2026-10-09T20:10:01.000Z'; },
    (f) => { f.context.lease.expiresAt = 'invalid'; },
    (f) => { f.context.lease.releasedAt = 'invalid'; },
    (f) => { f.context.lease.jobType = 'another-operation'; },
    (f) => { f.context.run.claimedAt = observedAt; },
    (f) => { f.context.run.claimedByInstanceId = 'queue-worker'; },
    (f) => { delete f.context.run.claimedAt; },
    (f) => { delete f.context.run.claimedByInstanceId; },
    (f) => { f.context.observedAt = 'invalid'; },
  ]);
  for (const status of ['running', 'paused', 'waiting', 'unknown']) {
    const f = fixture();
    f.context.run.status = status;
    assert.equal(evaluateAbandonedPreparation(f).eligible, false);
  }
});

test('missing/released/expired lease allows inspection but cannot alone create non-dispatch proof', () => {
  for (const current of ['missing', 'released', 'expired']) {
    const f = fixture();
    if (current === 'missing') f.context.lease = null;
    if (current === 'released') {
      f.context.lease.releasedAt = observedAt;
      f.context.lease.expiresAt = '2026-10-09T21:00:00.000Z';
    }
    if (current === 'expired') f.context.lease.expiresAt = observedAt;
    assert.equal(evaluateAbandonedPreparation(f).eligible, true);
    assert.equal(hasCertifiedPreProviderRefusal(f.context), false);
    delete f.context.item.planningSnapshot.execution.handoff.preProviderEpoch;
    assert.equal(evaluateAbandonedPreparation(f).eligible, false);
    assert.equal(hasCertifiedPreProviderRefusal(f.context), false);
  }
});

test('current source, physical files, ownership, selected status and execution manifest must agree', () => {
  rejectChanges([
    (f) => { f.context.candidate.status = 'downloading'; },
    (f) => { f.context.candidate.username = 'other-peer'; },
    (f) => { f.context.candidate.sourceSearchId = randomUUID(); },
    (f) => { f.context.candidate.folderPath = 'Other'; },
    (f) => { f.context.candidate.files[0].id = randomUUID(); },
    (f) => { f.context.candidate.files[0].sizeBytes += 1; },
    (f) => { f.context.candidate.normalizedPayload.requestOwnership = null; },
    (f) => { f.context.item.planningSnapshot.execution.requestedFiles = []; },
    (f) => { f.context.item.planningSnapshot.execution.handoff.state = 'awaiting_confirmation'; },
  ]);
});

test('staged work must carry only its own exact receipt-free attempt', () => {
  const alterAttempt = (change) => (f) => change(f.context.item.planningSnapshot.execution.handoff.attempt);
  rejectChanges([
    alterAttempt((a) => { a.operationRunId = randomUUID(); }),
    alterAttempt((a) => { a.importCandidateId = randomUUID(); }),
    alterAttempt((a) => { a.attemptId = randomUUID(); }),
    alterAttempt((a) => { a.username = 'other-peer'; }),
    alterAttempt((a) => { a.sourceObservation.folderPath = 'Other'; }),
    alterAttempt((a) => { a.requestedFiles[0].size += 1; }),
    alterAttempt((a) => { a.receipts = null; }),
    alterAttempt((a) => { a.failedFiles.push('Album\\01.flac'); }),
    alterAttempt((a) => { a.receipts.push({ ...a.requestedFiles[0], username: 'peer', id: randomUUID(), batchId: a.attemptId }); }),
    (f) => { delete f.context.item.planningSnapshot.execution.handoff.attempt; },
  ], { staged: true });
});

test('provider evidence and run-wide transfer ownership exclude closure', () => {
  rejectChanges([
    (f) => { f.context.runTransferLinkCount = 1; },
    (f) => { f.context.transferLinkCount = 1; },
    (f) => { f.context.item.planningSnapshot.execution.handoff.adoption = null; },
    (f) => { f.context.item.planningSnapshot.execution.handoff.originResolution = {}; },
    (f) => { f.context.item.planningSnapshot.execution.handoff.providerRespondedAt = observedAt; },
    (f) => { f.context.item.planningSnapshot.execution.acceptedCandidateObservation = {}; },
    (f) => { f.context.item.planningSnapshot.execution.enqueuedTransfers = [{ id: randomUUID() }]; },
  ]);
});

test('crossed and already refused work stays ineligible instead of inferred abandoned', () => {
  for (const phase of ['may_have_dispatched', 'refused']) {
    const f = fixture({ staged: true });
    const epoch = f.context.item.planningSnapshot.execution.handoff.preProviderEpoch;
    epoch.phase = phase;
    if (phase === 'may_have_dispatched') epoch.dispatchPossibleAt = observedAt;
    else epoch.refusal = { reasonCode: 'provider_changed', refusedAt: observedAt };
    f.expectedEpoch = structuredClone(epoch);
    assert.equal(validatePreProviderEpoch(epoch, { runId: f.operationRunId, importCandidateId: f.importCandidateId }), epoch);
    assert.equal(evaluateAbandonedPreparation(f).eligible, false);
  }
});

test('cancellation changes the reason but cannot bypass a live lease', () => {
  for (const field of ['cancelRequestedAt', 'cancelledAt']) {
    const f = fixture();
    f.context.run[field] = observedAt;
    assert.equal(evaluateAbandonedPreparation(f).reasonCode, 'operation_cancelled');
    f.context.lease.expiresAt = '2026-10-09T21:00:00.000Z';
    assert.equal(evaluateAbandonedPreparation(f).eligible, false);
  }
});

test('existing certificate/origin consumers accept only reciprocal closure on a cancelled parent', () => {
  for (const staged of [false, true]) {
    const f = closeFixture(fixture({ staged }));
    assert.equal(hasCertifiedPreProviderRefusal(f.context), true);
    assert.equal(isUnresolvedPreProviderPreparation(f.context), false);
    assert.equal(unused(f).eligible, true);
    for (const change of [
      (c) => { delete c.context.run.summary.downloadPreparationClosure; },
      (c) => { c.context.run.summary.downloadPreparationClosure = null; },
      (c) => { c.context.run.summary.downloadPreparationClosure.epochId = randomUUID(); },
      (c) => { c.context.run.summary.downloadPreparationClosure.generation += 1; },
      (c) => { c.context.run.status = 'failed'; },
      (c) => { delete c.context.item.planningSnapshot.execution.handoff.preProviderEpoch.closure; },
    ]) {
      const copy = structuredClone(f);
      change(copy);
      assert.equal(hasCertifiedPreProviderRefusal(copy.context), false);
      assert.equal(isUnresolvedPreProviderPreparation(copy.context), true);
      assert.equal(unused(copy).eligible, false);
    }
  }
});

test('malformed closure provenance fails even if both private copies are identical', () => {
  for (const change of [
    (c, e) => { c.lease = structuredClone(e.lease); },
    (c) => { c.lease = null; }, (c) => { c.lease.ownerInstanceId = ''; },
    (c) => { c.lease.acquiredAt = '2026-10-09T19:59:00.000Z'; },
    (c) => { c.lease.acquiredAt = '2026-10-09T20:11:00.000Z'; },
    (c) => { c.operationRunId = randomUUID(); }, (c) => { c.importCandidateId = randomUUID(); },
    (c) => { c.closedAt = observedAt; }, (c) => { delete c.cancelRequestedAt; },
    (c) => { c.cancelledAt = 'invalid'; },
  ]) {
    const f = closeFixture(fixture());
    const epoch = f.context.item.planningSnapshot.execution.handoff.preProviderEpoch;
    change(epoch.closure, epoch);
    f.context.run.summary.downloadPreparationClosure = structuredClone(epoch.closure);
    assert.equal(hasCertifiedPreProviderRefusal(f.context), false);
  }
});

test('orphan/null closure markers stay unresolved and cannot fall back to historical unused inference', () => {
  const control = fixture();
  control.context.run.status = 'pending';
  control.context.run.attemptCount = 0;
  control.context.item.planningSnapshot = {};
  assert.equal(unused(control).eligible, true);
  for (const marker of [null, [], {}, { version: 1 }]) {
    const f = structuredClone(control);
    f.context.run.summary.downloadPreparationClosure = marker;
    assert.equal(hasCertifiedPreProviderRefusal(f.context), false);
    assert.equal(isUnresolvedPreProviderPreparation(f.context), true);
    assert.equal(unused(f).eligible, false);
    f.context.run.status = 'cancelled';
    assert.equal(unused(f).eligible, false);
  }
});
