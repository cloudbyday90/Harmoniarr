/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createExecutionWorkerHarness } from '../../testing/server/import-execution-worker-harness.js';
import { createApiError } from '../../src/server/auth.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { createOperatorDownloadAdoptionAttempt } from '../../src/server/slskd/slskd-download-adoption-policy.js';
import { evaluateStoredDownloadAdoption } from '../../src/server/import-candidates/import-execution-adoption-evidence-policy.js';
import { createImportCandidateExecutionSummaryService } from '../../src/server/import-candidates/import-candidate-execution-summary-service.js';
import { createImportCandidateRecoveryService } from '../../src/server/import-candidates/import-candidate-recovery-service.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';

const binding = { protocol: 'batch', version: '0.26.0', endpointFingerprint: 'a'.repeat(64) };
const batch = (attempt, state = 'InProgress', files = attempt.requestedFiles) => ({ id: attempt.attemptId,
  username: attempt.username, direction: 'Download', transfers: files.map((file) => ({ ...file, id: randomUUID(),
    username: attempt.username, direction: 'Download', batchId: attempt.attemptId, state, exception: '' })) });

test('the worker pins a verified provider binding in its durable attempt and only invokes the pinned dispatch', async (t) => {
  let posted;
  const enqueue = t.mock.fn(async ({ attempt }) => {
    posted = attempt;
    return { enqueued: batch(attempt).transfers, failed: [] };
  });
  const assertCurrent = t.mock.fn(async () => {});
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    prepareDownloadDispatch: async () => ({ binding, assertCurrent, enqueue }),
  } });
  await harness.run();
  assert.equal(enqueue.mock.callCount(), 1);
  assert.equal(assertCurrent.mock.callCount(), 1);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(posted.version, 2);
  assert.deepEqual(posted.providerBinding, binding);
  assert.equal(harness.candidateRows.get('candidate-1').status, 'downloading');
});

test('lost batch responses recover only from full progressed caller-owned GET evidence without another POST', async (t) => {
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    prepareDownloadDispatch: async () => ({ binding, assertCurrent: async () => {}, enqueue: async () => { throw createApiError(502, 'slskd_request_failed', 'Lost response'); } }),
  } });
  await harness.run();
  const item = harness.items.get('candidate-1');
  const attempt = item.planningSnapshot.execution.handoff.attempt;
  const resumed = createExecutionWorkerHarness(t, { existingItems: [item], workerOverrides: {
    prepareDownloadDispatch: async () => { throw new Error('Must not select another transport'); },
    findMatchingTransfers: async () => ({ providerEvidence: batch(attempt) }),
  } });
  await resumed.run();
  assert.equal(resumed.enqueueDownloads.mock.callCount(), 0);
  assert.equal(resumed.candidateRows.get('candidate-1').status, 'downloading');
  assert.equal(resumed.items.get('candidate-1').planningSnapshot.execution.handoff.attempt.attemptId, attempt.attemptId);
});

test('local-only, absent and wrong-batch lookup evidence cannot admit or resend an uncertain request', async (t) => {
  for (const evidence of [null, 'local', 'foreign']) {
    const original = createExecutionWorkerHarness(t, { workerOverrides: {
      prepareDownloadDispatch: async () => ({ binding, assertCurrent: async () => {}, enqueue: async () => { throw new Error('Lost response'); } }),
    } });
    await original.run();
    const item = original.items.get('candidate-1');
    const attempt = item.planningSnapshot.execution.handoff.attempt;
    const payload = evidence == null ? null : batch(attempt, evidence === 'local' ? 'Queued, Locally' : 'InProgress');
    if (evidence === 'foreign') payload.id = randomUUID();
    const resumed = createExecutionWorkerHarness(t, { existingItems: [item], workerOverrides: {
      findMatchingTransfers: async () => ({ providerEvidence: payload }),
    } });
    await resumed.run();
    assert.equal(resumed.enqueueDownloads.mock.callCount(), 0);
    assert.equal(resumed.candidateRows.get('candidate-1').status, 'selected');
    assert.equal(resumed.marks.completed.summary.awaitingConfirmationCount, 1);
  }
});

test('a pinned configuration refusal is known non-dispatch and cannot fall back to the legacy POST', async (t) => {
  const enqueue = t.mock.fn(async () => { throw new Error('Must not POST'); });
  const harness = createExecutionWorkerHarness(t, { workerOverrides: {
    prepareDownloadDispatch: async () => ({ binding, enqueue, assertCurrent: async () => { throw createApiError(409, 'slskd_provider_binding_changed', 'Changed'); } }),
  } });
  await harness.run();
  assert.equal(enqueue.mock.callCount(), 0);
  assert.equal(harness.enqueueDownloads.mock.callCount(), 0);
  assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.handoff.state, 'not_dispatched');
});

test('a changed saved provider binding cannot certify an earlier endpoint response even when its attempt UUID is unchanged', async (t) => {
  let harness;
  harness = createExecutionWorkerHarness(t, { workerOverrides: {
    prepareDownloadDispatch: async () => ({ binding, assertCurrent: async () => {}, enqueue: async ({ attempt }) => {
      const item = harness.items.get('candidate-1');
      item.planningSnapshot.execution.handoff.attempt = { ...item.planningSnapshot.execution.handoff.attempt,
        providerBinding: { ...binding, endpointFingerprint: 'c'.repeat(64) } };
      return { enqueued: batch(attempt).transfers, failed: [] };
    } }),
  } });
  await harness.run();
  assert.equal(harness.candidateRows.get('candidate-1').status, 'selected');
  assert.equal(harness.recordConfirmedTransfers.mock.callCount(), 0);
  assert.equal(harness.items.get('candidate-1').planningSnapshot.execution.handoff.attempt.receipts.length, 0);
});

test('operator tracking proof remains separately attributed and refuses corrupted provenance', () => {
  const attempt = createDownloadAttempt({ importCandidateId: 'candidate', operationRunId: 'run', username: 'peer',
    requestedFiles: [{ filename: 'Album\\01.flac', size: 123 }], sourceObservation: { id: 'candidate' } });
  const transfers = batch(attempt).transfers;
  const proof = createOperatorDownloadAdoptionAttempt({ attempt, providerBinding: binding, transfers,
    actorUserId: 'admin', acceptedRequestHash: 'b'.repeat(64) });
  const adoption = { adoptionId: proof.attempt.attemptId, source: 'operator_adoption', actorUserId: 'admin', requestHash: 'b'.repeat(64),
    originalUncertainty: true, automaticRecoveryAllowed: false, proof: proof.attempt };
  const context = { adoption, importCandidateId: 'candidate', operationRunId: 'run', requestedFiles: attempt.requestedFiles, username: 'peer' };
  assert.equal(evaluateStoredDownloadAdoption(context).disposition, 'operator_adopted');
  assert.equal(attempt.receipts.length, 0);
  assert.equal(evaluateStoredDownloadAdoption({ ...context, adoption: { ...adoption, originalUncertainty: false } }), null);
});

test('adopted transfers can complete from exact IDs but adverse observations remain review-only', async () => {
  const attempt = createDownloadAttempt({ importCandidateId: 'candidate', operationRunId: 'run', username: 'peer',
    requestedFiles: [{ filename: 'Album\\01.flac', size: 123 }], sourceObservation: { id: 'candidate' } });
  const transfers = batch(attempt).transfers;
  const proof = createOperatorDownloadAdoptionAttempt({ attempt, providerBinding: binding, transfers,
    actorUserId: 'admin', acceptedRequestHash: 'b'.repeat(64) });
  const adoption = { adoptionId: proof.attempt.attemptId, source: 'operator_adoption', actorUserId: 'admin', requestHash: 'b'.repeat(64),
    originalUncertainty: true, automaticRecoveryAllowed: false, proof: proof.attempt };
  for (const state of ['Completed, Succeeded', 'Completed, Errored']) {
    const service = createImportCandidateExecutionSummaryService({
      importCandidateExecutionRunStore: { getLatestRun: async () => ({ id: 'run', status: 'completed', summary: {} }), getActiveRun: async () => null },
      listImportExecutionRunItemsFn: async () => [{ importCandidateId: 'candidate', itemStatus: 'queued',
        planningSnapshot: { execution: { requestedFiles: attempt.requestedFiles, handoff: { state: 'operator_adopted', attempt, adoption } } } }],
      buildTransferSnapshot: async () => ({ getTransfer: () => ({ ...transfers[0], state, exception: state.includes('Errored') ? 'Failed' : '' }) }),
    });
    const summary = await service.buildImportCandidateExecutionSummary();
    const item = summary.currentRun.items[0];
    assert.equal(item.automaticFailureRecoveryAllowed, false);
    assert.equal(item.downloadReviewRequired, state.includes('Errored'));
    assert.equal(item.liveTransferSummary.status, state.includes('Errored') ? 'failed' : 'completed');
  }
});

test('every automatic recovery adapter leaves an adopted episode in review without consuming attempts or creating new work', async (t) => {
  const genericSideEffect = t.mock.fn(async () => { throw new Error('An adopted episode cannot acquire again'); });
  const service = createImportCandidateRecoveryService({ getImportCandidate: async () => ({ id: 'candidate', normalizedPayload: {} }),
    musicQueueRecoveryService: { isAdoptedDownloadEpisode: async () => true, ownsRecoveryCandidate: genericSideEffect,
      handleMusicQueueRecovery: genericSideEffect }, incrementImportCandidateDownloadAttemptCountFn: genericSideEffect,
    findNextImportCandidateForRecoveryFn: genericSideEffect, createRecoveryExecutionRun: genericSideEffect,
  });
  for (const handler of [service.handleImportCandidateDownloadFailure, service.handleImportCandidateQualityFailure,
    service.handleImportCandidateImportBlocker, service.handleImportCandidateRejectedTransfer]) {
    const result = await handler({ failedCandidateId: 'candidate', operationRunId: 'run' });
    assert.equal(result.requiresOperator, true);
    assert.equal(result.recovered, false);
    assert.equal(result.reason, 'adopted_download_requires_review');
  }
  assert.equal(genericSideEffect.mock.callCount(), 0);
});

test('provider restart evidence persists review without marking a failure or starting any automatic recovery', async (t) => {
  const attempt = createDownloadAttempt({ importCandidateId: 'candidate', operationRunId: 'run', username: 'peer', providerBinding: binding,
    requestedFiles: [{ filename: 'Album\\01.flac', size: 123 }], sourceObservation: { id: 'candidate' } });
  const transfers = batch(attempt).transfers;
  const proof = evaluateDownloadReceipt({ attempt, enqueueResult: { enqueued: transfers, failed: [] } });
  const summaryService = createImportCandidateExecutionSummaryService({
    importCandidateExecutionRunStore: { getLatestRun: async () => ({ id: 'run', status: 'completed', summary: {} }), getActiveRun: async () => null },
    listImportExecutionRunItemsFn: async () => [{ importCandidateId: 'candidate', itemStatus: 'queued',
      planningSnapshot: { execution: { requestedFiles: attempt.requestedFiles, handoff: { state: 'confirmed', attempt: proof.attempt } } } }],
    buildTransferSnapshot: async () => ({ getTransfer: () => ({ ...transfers[0], state: 'Completed, Errored', exception: 'Application shut down' }) }),
  });
  const summary = await summaryService.buildImportCandidateExecutionSummary();
  const item = summary.currentRun.items[0];
  assert.equal(item.downloadReviewRequired, true);
  assert.equal(item.automaticFailureRecoveryAllowed, false);
  const update = t.mock.fn(async (input) => input);
  const noRecovery = t.mock.fn(async () => assert.fail('Restart uncertainty cannot acquire new work'));
  const reconciliation = createImportCandidateExecutionReconciliationService({ updateImportExecutionRunItem: update,
    getImportCandidate: noRecovery, markImportCandidateDownloadFailed: noRecovery,
    handleImportCandidateDownloadFailure: noRecovery, handleImportCandidateRejectedTransfer: noRecovery });
  await reconciliation.reconcileImportCandidateExecutionSummary({ executionSummary: summary });
  assert.equal(update.mock.calls[0].arguments[0].planningSnapshot.execution.downloadReviewRequired, true);
  assert.equal(noRecovery.mock.callCount(), 0);
});

test('an unavailable exact legacy receipt stays in review instead of becoming a missing-transfer failure', async () => {
  const transfer = { id: randomUUID(), username: 'peer' };
  const service = createImportCandidateExecutionSummaryService({
    importCandidateExecutionRunStore: { getLatestRun: async () => ({ id: 'run', status: 'completed', summary: {} }), getActiveRun: async () => null },
    listImportExecutionRunItemsFn: async () => [{ importCandidateId: 'candidate', itemStatus: 'queued',
      planningSnapshot: { execution: { enqueuedTransfers: [transfer], handoff: { state: 'confirmed' } } } }],
    buildTransferSnapshot: async () => ({ getTransfer: () => null, isObservationPending: () => true }),
  });
  const summary = await service.buildImportCandidateExecutionSummary();
  assert.equal(summary.currentRun.items[0].liveTransferSummary, null);
  assert.equal(summary.currentRun.items[0].downloadReviewRequired, true);
});
