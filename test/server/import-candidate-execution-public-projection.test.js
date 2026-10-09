import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicImportCandidateExecution } from '../../src/server/import-candidates/import-candidate-execution-public-projection.js';

test('execution API omits durable attempts and older internal work while retaining bounded confirmation and existing diagnostics', () => {
  const item = { id: 'item', itemStatus: 'awaiting_confirmation', transferObservationPending: true,
    planningSnapshot: { execution: { requestedFiles: [{ filename: 'Existing diagnostic.mp3', size: 1000 }],
      handoff: { state: 'awaiting_confirmation', attempt: { version: 1, attemptId: 'private-attempt-uuid', receipts: [{ id: 'private-receipt' }], sourceObservation: 'private-source' } } } },
    handoffConfirmation: { disposition: 'partial', allRequestedFilesMatched: false, requestedFileCount: 2,
      matchedTransfers: [{ id: 'private-receipt' }], attempt: { attemptId: 'private-attempt-uuid' }, rawProviderPayload: 'private-provider', checkedAt: '2026-10-09T00:00:00Z' } };
  const run = { id: 'run', items: [item] };
  const internal = { currentRun: run, run, recentRuns: [run], confirmationPending: true, pendingConfirmationCount: 2,
    unconfirmedRuns: [{ private: 'private-older-run' }] };
  const publicValue = buildPublicImportCandidateExecution(internal);
  assert.doesNotMatch(JSON.stringify(publicValue), /private-|attemptId|rawProviderPayload|unconfirmedRuns|transferObservationPending/u);
  assert.deepEqual(publicValue.currentRun.items[0].handoffConfirmation, { disposition: 'partial', allRequestedFilesMatched: false,
    checkedAt: '2026-10-09T00:00:00Z', requestedFileCount: 2, matchedTransferCount: 1, providerUnavailable: false });
  assert.equal(publicValue.confirmationPending, true);
  assert.equal(publicValue.pendingConfirmationCount, 2);
  assert.equal(publicValue.currentRun.items[0].planningSnapshot.execution.requestedFiles[0].filename, 'Existing diagnostic.mp3');
  assert.equal(internal.currentRun.items[0].planningSnapshot.execution.handoff.attempt.attemptId, 'private-attempt-uuid', 'heartbeat source remains intact');
  assert.equal(internal.unconfirmedRuns.length, 1);
});

test('admin unresolved review references are bounded, deduped and contain only exact row identifiers', () => {
  const unconfirmedRuns = Array.from({ length: 30 }, (_, index) => ({ id: `older-${index}`, items: [{ importCandidateId: `candidate-${index}`,
    itemStatus: 'awaiting_confirmation', planningSnapshot: { execution: { handoff: { state: 'awaiting_confirmation',
      adoption: { adoptionId: 'private-adoption', receipts: ['private-receipt'], originalUncertainDispatch: 'private-source', providerBinding: 'private-provider' } } } } }] }));
  const internal = { summary: { status: 'attention' }, unconfirmedRuns, currentRun: unconfirmedRuns[0] };
  const result = buildPublicImportCandidateExecution(internal);
  assert.equal(result.downloadAdoptionReviewReferences.length, 20);
  assert.deepEqual(result.downloadAdoptionReviewReferences[0], { operationRunId: 'older-0', importCandidateId: 'candidate-0' });
  assert.deepEqual(result.summary.downloadAdoptionReviewReferences, result.downloadAdoptionReviewReferences);
  assert.doesNotMatch(JSON.stringify(result), /private-|adoptionId|providerBinding|originalUncertainDispatch|unconfirmedRuns/u);
  assert.equal(internal.unconfirmedRuns[0].items[0].planningSnapshot.execution.handoff.adoption.adoptionId, 'private-adoption');
});

test('older unresolved rows retain review references when the visible current run has many items', () => {
  const older = { id: 'outside-recent-five', items: [{ importCandidateId: 'older-candidate', itemStatus: 'awaiting_confirmation' }] };
  const current = { id: 'current', items: Array.from({ length: 25 }, (_, index) => ({ importCandidateId: `current-${index}`, itemStatus: 'awaiting_confirmation' })) };
  const result = buildPublicImportCandidateExecution({ currentRun: current, unconfirmedRuns: [older], recentRuns: [current] });
  assert.deepEqual(result.downloadAdoptionReviewReferences[0], { operationRunId: older.id, importCandidateId: 'older-candidate' });
  assert.equal(result.downloadAdoptionReviewReferences.length, 20);
  assert.equal(result.currentRun.items.length, 25, 'current rows remain available directly');
});

test('adopted downloads expose review-only references on later adverse evidence without exposing adoption authority', () => {
  const run = { id: 'adopted-run', items: [{ importCandidateId: 'candidate', itemStatus: 'queued', downloadReviewRequired: true,
    planningSnapshot: { execution: { handoff: { state: 'operator_adopted', adoption: { proof: 'private-proof' } } } } }] };
  const result = buildPublicImportCandidateExecution({ currentRun: run });
  assert.deepEqual(result.downloadAdoptionReviewReferences, [{ operationRunId: 'adopted-run', importCandidateId: 'candidate' }]);
  assert.doesNotMatch(JSON.stringify(result), /private-proof|adoption|proof/u);
  assert.equal(result.currentRun.items[0].downloadReviewRequired, true);
});
