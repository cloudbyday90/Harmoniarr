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
import { hasPreProviderProtocol, normalizePreparationFiles, preparationLeaseIdentity, hasCurrentPreparationLease,
  validatePreProviderEpoch, hasPreparationProviderEvidence, hasCertifiedPreProviderRefusal,
  isUnresolvedPreProviderPreparation, preProviderRefusalReason } from '../../src/server/import-candidates/import-execution-pre-provider-policy.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';

const preparedAt = '2026-10-09T20:00:00.000Z';
const refusedAt = '2026-10-09T20:00:01.000Z';
const providerBinding = { protocol: 'batch', version: '0.26.0', endpointFingerprint: 'a'.repeat(64) };

function fixture({ staged = false, empty = false } = {}) {
  const run = { id: randomUUID(), status: 'failed', summary: { downloadPreparationProtocol: { version: 1 } } };
  const candidate = { id: randomUUID(), status: 'selected', username: 'peer', sourceSearchId: randomUUID(),
    sourceProvider: 'slskd', sourceResponseKey: 'response-1', folderPath: 'Album', updatedAt: preparedAt,
    normalizedPayload: {}, files: [{ id: randomUUID(), filename: '01.flac', folderPath: 'Album', sizeBytes: 1000,
      rawPayload: { filename: 'Album/01.flac' }, extension: 'flac', isLocked: false }] };
  const sourceObservation = captureRecoveryObservation(candidate);
  const requestedFiles = empty ? [] : [{ filename: 'Album\\01.flac', size: 1000 }];
  const lease = { leaseKey: `import_candidate_execution_planning:${run.id}`, ownerInstanceId: 'worker-1', acquiredAt: preparedAt };
  const epoch = { version: 1, epochId: randomUUID(), operationRunId: run.id, importCandidateId: candidate.id,
    generation: 1, lease, sourceObservation, requestedFiles, preparedAt, phase: 'refused',
    refusal: { reasonCode: empty ? 'no_unlocked_files' : 'provider_version_unsupported', refusedAt } };
  const execution = { outcome: 'pre_provider_refused', requestedFiles,
    handoff: { state: staged ? 'not_dispatched' : 'pre_provider_refused', preProviderEpoch: epoch } };
  if (staged) {
    execution.handoff.attempt = createDownloadAttempt({ operationRunId: run.id, importCandidateId: candidate.id,
      username: candidate.username, requestedFiles, sourceObservation, providerBinding });
    epoch.attemptId = execution.handoff.attempt.attemptId;
  }
  const item = { operationRunId: run.id, importCandidateId: candidate.id, itemStatus: 'blocked', planningSnapshot: { execution } };
  return { run, item, candidate, epoch, execution, lease };
}

test('a future exact epoch validates and permits a genuine empty-manifest no-files refusal', () => {
  for (const empty of [false, true]) {
    const f = fixture({ empty });
    assert.equal(validatePreProviderEpoch(f.epoch, { runId: f.run.id, importCandidateId: f.candidate.id }), f.epoch);
    assert.equal(hasCertifiedPreProviderRefusal(f), true);
    assert.equal(isUnresolvedPreProviderPreparation(f), false);
  }
  assert.deepEqual(normalizePreparationFiles([]), []);
  assert.deepEqual(normalizePreparationFiles([{ filename: 'Album/01.flac', size: 1000 }]), [{ filename: 'Album\\01.flac', size: 1000 }]);
});

test('malformed epoch shapes, identities, generations and timestamps cannot certify refusal', () => {
  const f = fixture();
  const changes = [
    null, [], 'refused', { ...f.epoch, version: 2 }, { ...f.epoch, epochId: 'old-epoch' },
    { ...f.epoch, operationRunId: randomUUID() }, { ...f.epoch, importCandidateId: randomUUID() },
    { ...f.epoch, generation: 0 }, { ...f.epoch, generation: 1.5 }, { ...f.epoch, generation: 10001 },
    { ...f.epoch, preparedAt: null }, { ...f.epoch, preparedAt: 'not-a-time' },
    { ...f.epoch, sourceObservation: null }, { ...f.epoch, sourceObservation: [] },
    { ...f.epoch, sourceObservation: { ...f.epoch.sourceObservation, candidateId: randomUUID() } },
    { ...f.epoch, refusal: null }, { ...f.epoch, refusal: { reasonCode: 'unbounded_provider_body', refusedAt } },
    { ...f.epoch, refusal: { reasonCode: 'preparation_refused', refusedAt: '2026-10-09T19:59:59.000Z' } },
  ];
  for (const epoch of changes) {
    assert.equal(validatePreProviderEpoch(epoch, { runId: f.run.id, importCandidateId: f.candidate.id }), null);
    const copy = structuredClone(f);
    copy.execution.handoff.preProviderEpoch = epoch;
    assert.equal(hasCertifiedPreProviderRefusal(copy), false);
  }
});

test('null, malformed and noncanonical lease or file manifests are not valid epoch evidence', () => {
  const f = fixture();
  const leases = [null, [], {}, { ...f.lease, leaseKey: 'another-operation' }, { ...f.lease, ownerInstanceId: null },
    { ...f.lease, ownerInstanceId: `worker${String.fromCharCode(0)}other` }, { ...f.lease, acquiredAt: 'invalid' },
    { ...f.lease, expiresAt: refusedAt }];
  const manifests = [null, {}, [null], [{ filename: 'Album\\01.flac', size: 0 }],
    [{ filename: 'Album\\01.flac', size: '1000' }], [{ filename: 'Album/01.flac', size: 1000 }],
    [{ filename: 'Album\\01.flac', size: 1000 }, { filename: 'Album\\01.flac', size: 2000 }]];
  for (const lease of leases) assert.equal(validatePreProviderEpoch({ ...f.epoch, lease },
    { runId: f.run.id, importCandidateId: f.candidate.id }), null);
  for (const requestedFiles of manifests) assert.equal(validatePreProviderEpoch({ ...f.epoch, requestedFiles },
    { runId: f.run.id, importCandidateId: f.candidate.id }), null);
});

test('only the same live lease identity owns preparation; expiry, release and reacquisition refuse', () => {
  const f = fixture();
  const now = Date.parse(refusedAt);
  const expectedLease = { ...f.lease, acquisitionId: randomUUID() };
  const current = { ...expectedLease, releasedAt: null, expiresAt: '2026-10-09T20:00:02.000Z' };
  assert.deepEqual(preparationLeaseIdentity(current, f.run.id), expectedLease);
  assert.equal(hasCurrentPreparationLease(current, expectedLease, f.run.id, now), true);
  for (const change of [{ expiresAt: refusedAt }, { expiresAt: 'invalid' }, { releasedAt: refusedAt },
    { ownerInstanceId: 'worker-2' }, { acquiredAt: refusedAt }, { leaseKey: 'another-operation' }]) {
    assert.equal(hasCurrentPreparationLease({ ...current, ...change }, expectedLease, f.run.id, now), false);
  }
  assert.equal(hasCurrentPreparationLease(current, expectedLease, randomUUID(), now), false);
  assert.equal(hasCurrentPreparationLease(current, null, f.run.id, now), false);
  assert.equal(hasCurrentPreparationLease(current, expectedLease, f.run.id, Number.NaN), false);
});

test('refused and crossed phases cannot be combined to turn uncertainty into a certificate', () => {
  const f = fixture({ staged: true });
  const crossed = { ...f.epoch, phase: 'may_have_dispatched', dispatchPossibleAt: refusedAt };
  delete crossed.refusal;
  assert.equal(validatePreProviderEpoch(crossed, { runId: f.run.id, importCandidateId: f.candidate.id }), crossed);
  f.execution.handoff.preProviderEpoch = crossed;
  assert.equal(hasCertifiedPreProviderRefusal(f), false);
  assert.equal(isUnresolvedPreProviderPreparation(f), true);
  assert.equal(validatePreProviderEpoch({ ...crossed, refusal: { reasonCode: 'provider_unavailable', refusedAt } },
    { runId: f.run.id, importCandidateId: f.candidate.id }), null);
  assert.equal(validatePreProviderEpoch({ ...crossed, phase: 'refused', refusal: { reasonCode: 'provider_unavailable', refusedAt } },
    { runId: f.run.id, importCandidateId: f.candidate.id }), null);
  assert.equal(validatePreProviderEpoch({ ...crossed, attemptId: null },
    { runId: f.run.id, importCandidateId: f.candidate.id }), null);
});

test('a staged empty attempt certifies only its exact run, peer, source and requested manifest', () => {
  const f = fixture({ staged: true });
  assert.equal(hasCertifiedPreProviderRefusal(f), true);
  const changes = [
    (c) => { c.item.operationRunId = randomUUID(); },
    (c) => { c.execution.handoff.attempt.operationRunId = randomUUID(); },
    (c) => { c.execution.handoff.attempt.importCandidateId = randomUUID(); },
    (c) => { c.execution.handoff.attempt.attemptId = randomUUID(); },
    (c) => { c.execution.handoff.attempt.username = 'other-peer'; },
    (c) => { c.execution.handoff.attempt.sourceObservation.folderPath = 'Other'; },
    (c) => { c.execution.handoff.attempt.sourceObservation.requestOwnership = { present: true, value: null }; },
    (c) => { c.execution.handoff.attempt.requestedFiles[0].size += 1; },
    (c) => { c.execution.handoff.state = 'dispatching'; },
    (c) => { c.item.itemStatus = 'awaiting_confirmation'; },
    (c) => { c.execution.outcome = 'unknown'; },
    (c) => { delete c.execution.handoff.attempt; },
  ];
  for (const change of changes) {
    const copy = structuredClone(f);
    change(copy);
    assert.equal(hasCertifiedPreProviderRefusal(copy), false);
  }
});

test('a certificate refuses execution manifest drift even without a staged attempt', () => {
  for (const staged of [false, true]) {
    const f = fixture({ staged });
    f.execution.requestedFiles = [{ filename: 'Other\\01.flac', size: 1000 }];
    assert.equal(hasCertifiedPreProviderRefusal(f), false);
  }
  const f = fixture({ empty: true });
  f.execution.requestedFiles = [{ filename: 'Album\\01.flac', size: 1000 }];
  assert.equal(hasCertifiedPreProviderRefusal(f), false);
});

test('partial, accepted, rejected, adopted or malformed provider evidence never becomes local negative proof', () => {
  const f = fixture({ staged: true });
  const changes = [
    (c) => { c.execution.handoff.attempt.receipts.push({ ...c.epoch.requestedFiles[0], id: randomUUID(),
      username: 'peer', batchId: c.epoch.attemptId }); },
    (c) => { c.execution.handoff.attempt.failedFiles.push(c.epoch.requestedFiles[0].filename); },
    (c) => { c.execution.handoff.attempt.receiptDisposition = 'confirmed'; },
    (c) => { c.execution.handoff.attempt.receipts = null; },
    (c) => { c.execution.handoff.adoption = null; },
    (c) => { c.execution.handoff.originResolution = {}; },
    (c) => { c.execution.handoff.providerRespondedAt = refusedAt; },
    (c) => { c.execution.handoff.confirmedAt = refusedAt; },
    (c) => { c.execution.enqueuedTransfers = [{ id: randomUUID() }]; },
    (c) => { c.execution.enqueuedTransfers = null; },
    (c) => { c.execution.acceptedCandidateObservation = null; },
    (c) => { c.execution.latestTransferSnapshot = {}; },
    (c) => { c.execution.missingTransfer = true; },
  ];
  for (const change of changes) {
    const copy = structuredClone(f);
    change(copy);
    assert.equal(hasPreparationProviderEvidence(copy.execution, { stagedAttemptId: copy.epoch.attemptId }), true);
    assert.equal(hasCertifiedPreProviderRefusal(copy), false);
  }
  assert.equal(hasPreparationProviderEvidence(null), true);
  assert.equal(hasPreparationProviderEvidence({ handoff: [] }), true);
});

test('only a full causal receipt for the crossed attempt resolves preparation uncertainty', () => {
  for (const accepted of [true, false]) {
    const f = fixture({ staged: true });
    const epoch = { ...f.epoch, phase: 'may_have_dispatched', dispatchPossibleAt: refusedAt };
    delete epoch.refusal;
    f.execution.handoff.preProviderEpoch = epoch;
    const attempt = f.execution.handoff.attempt;
    const receipt = evaluateDownloadReceipt({ attempt, enqueueResult: accepted
      ? { enqueued: [{ ...attempt.requestedFiles[0], id: randomUUID(), username: attempt.username,
        batchId: attempt.attemptId, direction: 'Download' }], failed: [] }
      : { enqueued: [], failed: attempt.requestedFiles.map((file) => file.filename) } });
    f.execution.handoff.attempt = receipt.attempt;
    f.execution.handoff.state = 'confirmed';
    assert.equal(isUnresolvedPreProviderPreparation(f), false);
    f.execution.handoff.attempt.attemptId = randomUUID();
    assert.equal(isUnresolvedPreProviderPreparation(f), true);
  }
});

test('confirmed text or an empty lookup does not resolve a crossed epoch', () => {
  const f = fixture({ staged: true });
  f.execution.handoff.preProviderEpoch = { ...f.epoch, phase: 'may_have_dispatched', dispatchPossibleAt: refusedAt };
  delete f.execution.handoff.preProviderEpoch.refusal;
  f.execution.handoff.state = 'confirmed';
  assert.equal(isUnresolvedPreProviderPreparation(f), true);
  const partial = evaluateDownloadReceipt({ attempt: f.execution.handoff.attempt, enqueueResult: { enqueued: [], failed: [] } });
  f.execution.handoff.attempt = partial.attempt;
  assert.equal(partial.disposition, 'unknown');
  assert.equal(isUnresolvedPreProviderPreparation(f), true);
  assert.equal(hasCertifiedPreProviderRefusal(f), false);
});

test('a real partial causal receipt leaves the crossed epoch unresolved', () => {
  const f = fixture({ staged: true });
  f.candidate.files.push({ ...f.candidate.files[0], id: randomUUID(), filename: '02.flac',
    rawPayload: { filename: 'Album/02.flac' } });
  const sourceObservation = captureRecoveryObservation(f.candidate);
  const requestedFiles = [...f.epoch.requestedFiles, { filename: 'Album\\02.flac', size: 1000 }];
  const attempt = createDownloadAttempt({ operationRunId: f.run.id, importCandidateId: f.candidate.id,
    username: 'peer', sourceObservation, requestedFiles, providerBinding });
  const proof = evaluateDownloadReceipt({ attempt, enqueueResult: { enqueued: [{ ...attempt.requestedFiles[0],
    id: randomUUID(), username: 'peer', direction: 'Download', batchId: attempt.attemptId }], failed: [] } });
  f.execution.requestedFiles = attempt.requestedFiles;
  f.execution.handoff.attempt = proof.attempt;
  f.execution.handoff.state = 'awaiting_confirmation';
  f.execution.handoff.preProviderEpoch = { ...f.epoch, sourceObservation, requestedFiles: attempt.requestedFiles,
    attemptId: attempt.attemptId, phase: 'may_have_dispatched', dispatchPossibleAt: refusedAt };
  delete f.execution.handoff.preProviderEpoch.refusal;
  assert.equal(proof.disposition, 'partial');
  assert.equal(proof.attempt.receipts.length, 1);
  assert.equal(hasCertifiedPreProviderRefusal(f), false);
  assert.equal(isUnresolvedPreProviderPreparation(f), true);
});

test('old protocols, explicit malformed protocol markers and absent epochs cannot acquire certificates', () => {
  for (const summary of [{}, { downloadPreparationProtocol: null }, { downloadPreparationProtocol: [] },
    { downloadPreparationProtocol: { version: 2 } }, { downloadPreparationProtocol: { version: 1, inferred: true } }]) {
    const f = fixture();
    f.run.summary = summary;
    assert.equal(hasPreProviderProtocol(f.run), false);
    assert.equal(hasCertifiedPreProviderRefusal(f), false);
    assert.equal(isUnresolvedPreProviderPreparation(f), true);
  }
  const f = fixture();
  delete f.execution.handoff.preProviderEpoch;
  assert.equal(hasCertifiedPreProviderRefusal(f), false);
  assert.equal(isUnresolvedPreProviderPreparation(f), false);
  f.execution.handoff.preProviderEpoch = null;
  assert.equal(hasCertifiedPreProviderRefusal(f), false);
  assert.equal(isUnresolvedPreProviderPreparation(f), true);
});

test('preparation errors map to bounded reasons without exposing provider bodies or credentials', () => {
  for (const [code, reason] of [
    ['slskd_download_version_unsupported', 'provider_version_unsupported'],
    ['slskd_download_provider_changed', 'provider_changed'], ['slskd_unavailable', 'provider_unavailable'],
    ['operation_run_cancelled', 'operation_cancelled'], ['worker_paused', 'operation_paused'],
    ['execution_lease_stale', 'lease_changed'], ['music_queue_recovery_not_current', 'authority_refused'],
    ['unknown', 'preparation_refused'],
  ]) assert.equal(preProviderRefusalReason({ code, message: 'private API key and raw remote response' }), reason);
  assert.equal(preProviderRefusalReason(null), 'preparation_refused');
});
