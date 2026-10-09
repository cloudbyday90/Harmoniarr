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
