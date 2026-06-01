import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySlskdTransferState } from '../../src/server/import-candidates/import-candidate-transfer-state-policy.js';

test('classifySlskdTransferState maps slskd terminal states to Harmoniarr recovery classes', () => {
  assert.equal(classifySlskdTransferState({ state: 'Queued, Remotely' }).code, 'queued');
  assert.equal(classifySlskdTransferState({ state: 'Downloading' }).code, 'active');
  assert.equal(classifySlskdTransferState({ state: 'Completed, Succeeded' }).code, 'succeeded');
  assert.equal(classifySlskdTransferState({ state: 'Completed, Rejected' }).code, 'rejected');
  assert.equal(classifySlskdTransferState({ state: 'Completed, Errored' }).code, 'failed');
  assert.equal(classifySlskdTransferState({ state: 'Completed, Cancelled' }).code, 'failed');
  assert.equal(classifySlskdTransferState({ state: 'Completed, TimedOut' }).code, 'failed');
  assert.equal(classifySlskdTransferState({ state: 'Completed, Aborted' }).code, 'failed');
  assert.equal(classifySlskdTransferState({
    exception: 'Remote reset the connection',
    state: 'Completed',
  }).code, 'failed');
});
