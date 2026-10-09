import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdDownloadHandoffReconciliationService } from '../../src/server/slskd/slskd-download-handoff-reconciliation-service.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';

function context() {
  const request = {
    importCandidateId: 'candidate-1', operationRunId: 'run-1', username: 'peer',
    requestedFiles: [{ filename: 'Album\\01.flac', size: 123 }],
    sourceObservation: { id: 'candidate-1', username: 'peer', status: 'selected' },
  };
  return { ...request, attempt: createDownloadAttempt(request) };
}

test('historical matching completed/removed files cannot confirm an interrupted request', async () => {
  let historyCalls = 0;
  const service = createSlskdDownloadHandoffReconciliationService({
    getDownloads: async () => {
      historyCalls += 1;
      return [{ username: 'peer', directories: [{ files: [{ id: 'old', filename: 'Album\\01.flac', size: 123, state: 'Completed', removed: true }] }] }];
    },
  });
  const request = context();
  for (const attempt of [undefined, request.attempt]) {
    const result = await service.findMatchingTransfers({ ...request, attempt });
    assert.equal(result.allRequestedFilesMatched, false);
    assert.equal(result.disposition, 'unknown');
    assert.deepEqual(result.matchedTransfers, []);
  }
  assert.equal(historyCalls, 0);
});

test('a durable exact receipt confirms only its owning attempt and manifest', async () => {
  const request = context();
  const { attempt } = evaluateDownloadReceipt({ attempt: request.attempt, enqueueResult: {
    enqueued: [{ ...request.requestedFiles[0], id: 'ba81acde-d7a5-4b30-a5fd-57cfc91d47b0', username: 'peer' }], failed: [],
  } });
  const service = createSlskdDownloadHandoffReconciliationService();
  const result = await service.findMatchingTransfers({ ...request, attempt });
  assert.equal(result.allRequestedFilesMatched, true);
  assert.equal(result.disposition, 'confirmed');
  assert.deepEqual(result.matchedTransfers.map((row) => row.id), ['ba81acde-d7a5-4b30-a5fd-57cfc91d47b0']);
  assert.equal((await service.findMatchingTransfers({ ...request, attempt, operationRunId: 'new-run' })).allRequestedFilesMatched, false);
});

test('partial, malformed or ID-less saved receipts never become full proof', async () => {
  const request = context();
  const service = createSlskdDownloadHandoffReconciliationService();
  const row = { ...request.requestedFiles[0], id: 'ba81acde-d7a5-4b30-a5fd-57cfc91d47b0', username: 'peer' };
  for (const attempt of [
    { ...request.attempt, receipts: [row], receiptDisposition: 'partial' },
    { ...request.attempt, receipts: [row], receiptDisposition: 'unknown' },
    { ...request.attempt, receipts: [{ ...row, id: null }], receiptDisposition: 'confirmed' },
    { ...request.attempt, receipts: [{ ...row, size: 0 }], receiptDisposition: 'confirmed' },
  ]) {
    const result = await service.findMatchingTransfers({ ...request, attempt });
    assert.equal(result.allRequestedFilesMatched, false);
    assert.deepEqual(result.matchedTransfers, []);
  }
});
