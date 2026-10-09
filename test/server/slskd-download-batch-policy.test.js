import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createDownloadAttempt, evaluateDownloadReceipt, evaluateStoredDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { decodeSlskdDownloadBatchResponse, evaluateBatchDownloadEvidence } from '../../src/server/slskd/slskd-download-batch-policy.js';
import { hasProgressedDownloadEvidence, hasProviderRestartEvidence } from '../../src/server/slskd/slskd-download-evidence-policy.js';
import { validateDownloadAdoptionSelection, createOperatorDownloadAdoptionAttempt } from '../../src/server/slskd/slskd-download-adoption-policy.js';
import { createSlskdProviderBinding, selectSlskdDownloadProtocol, validateSlskdProviderBinding } from '../../src/server/slskd/slskd-download-protocol-policy.js';

function fixture() {
  const binding = createSlskdProviderBinding({ config: { baseUrl: 'http://localhost:5030' }, version: '0.26.0' });
  const attempt = createDownloadAttempt({ providerBinding: binding, importCandidateId: 'candidate', operationRunId: 'run',
    username: 'peer', sourceObservation: { username: 'peer' }, requestedFiles: [
      { filename: 'Album/01.flac', size: 1000 }, { filename: 'Album/02.flac', size: 2000 },
    ] });
  const batch = { id: attempt.attemptId, username: 'peer', direction: 'Download', options: {},
    transfers: attempt.requestedFiles.map((file) => ({ ...file, username: 'peer', direction: 'Download', batchId: attempt.attemptId,
      id: randomUUID(), state: 'Queued, Locally', removed: false })) };
  return { attempt, batch, binding };
}

test('verified stable protocol selection refuses future, prerelease and malformed versions', () => {
  assert.equal(selectSlskdDownloadProtocol('0.25.1'), 'legacy');
  assert.equal(selectSlskdDownloadProtocol('0.26.0'), 'batch');
  for (const version of [undefined, null, 0.26, '0.26.1', '0.27.0', '0.26.0-dev', 'v0.26.0', '0.26.0+metadata', 'garbage']) {
    assert.throws(() => selectSlskdDownloadProtocol(version), { code: 'slskd_download_version_unsupported' });
  }
  assert.equal(validateSlskdProviderBinding({ endpointFingerprint: 'a'.repeat(64) }), false);
});

test('an explicit complete POST receipt proves admission before remote progress without retaining provider extras', () => {
  const { attempt, batch } = fixture();
  batch.transfers[0].providerSecret = 'discarded';
  const response = decodeSlskdDownloadBatchResponse({ attempt, payload: { batch, failures: [] } });
  assert.equal(Object.hasOwn(response.enqueued[0], 'providerSecret'), false);
  const proof = evaluateDownloadReceipt({ attempt, enqueueResult: response });
  assert.equal(proof.disposition, 'confirmed');
  assert.equal(proof.attempt.receipts[0].batchId, attempt.attemptId);
  assert.equal(evaluateStoredDownloadReceipt({ attempt: proof.attempt, ...proof.attempt }).disposition, 'confirmed');
});

test('direct partial and all-file failures do not treat failed DB rows as enqueued receipts', () => {
  const { attempt, batch } = fixture();
  const failures = [{ filename: batch.transfers[1].filename, message: 'Failed to schedule' }];
  batch.transfers[1].state = 'Completed, Errored';
  const partial = evaluateDownloadReceipt({ attempt, enqueueResult: decodeSlskdDownloadBatchResponse({ attempt, payload: { batch, failures } }) });
  assert.equal(partial.disposition, 'partial');
  assert.equal(partial.attempt.receipts.length, 1);
  failures.push({ filename: batch.transfers[0].filename, message: 'Failed to schedule' });
  const rejected = evaluateDownloadReceipt({ attempt, enqueueResult: decodeSlskdDownloadBatchResponse({ attempt, payload: { batch, failures } }) });
  assert.equal(rejected.disposition, 'rejected');
  assert.deepEqual(rejected.attempt.receipts, []);
});

for (const state of ['Queued, Locally', 'Requested', 'Initializing', 'Completed, Errored', 'Completed, Rejected', 'None',
  'Unknown', 'NotCompleted, NotSucceeded', 'Queued, Remotely, Errored', 'InProgress, Completed', '8']) {
  test(`GET record state ${state} cannot restore an uncertain admission`, () => {
    const { attempt, batch } = fixture();
    for (const row of batch.transfers) row.state = state;
    const proof = evaluateBatchDownloadEvidence({ attempt, providerEvidence: batch });
    assert.equal(proof.allRequestedFilesMatched, false);
    assert.notEqual(proof.disposition, 'confirmed');
  });
}

for (const state of ['Queued, Remotely', 'InProgress', 'Completed, Succeeded']) {
  test(`full owned GET ${state} evidence recovers admission and remains attributable after persistence`, () => {
    const { attempt, batch } = fixture();
    for (const row of batch.transfers) row.state = state;
    const proof = evaluateBatchDownloadEvidence({ attempt, providerEvidence: batch });
    assert.equal(proof.disposition, 'confirmed');
    assert.equal(proof.attempt.receiptOrigin, 'batch_lookup');
    assert.equal(evaluateStoredDownloadReceipt({ attempt: proof.attempt, ...proof.attempt }).disposition, 'confirmed');
  });
}

test('partial, empty and removed active records do not establish complete batch admission', () => {
  const { attempt, batch } = fixture();
  for (const row of batch.transfers) row.state = 'InProgress';
  assert.equal(evaluateBatchDownloadEvidence({ attempt, providerEvidence: { ...batch, transfers: [] } }).disposition, 'unknown');
  assert.equal(evaluateBatchDownloadEvidence({ attempt, providerEvidence: { ...batch, transfers: [batch.transfers[0]] } }).disposition, 'partial');
  batch.transfers[0].removed = true;
  assert.equal(evaluateBatchDownloadEvidence({ attempt, providerEvidence: batch }).allRequestedFilesMatched, false);
  for (const row of batch.transfers) { row.state = 'Completed, Succeeded'; row.removed = true; }
  assert.equal(evaluateBatchDownloadEvidence({ attempt, providerEvidence: batch }).disposition, 'confirmed');
});

for (const [name, change] of [
  ['foreign batch', (batch) => { batch.id = randomUUID(); }],
  ['foreign peer', (batch) => { batch.username = 'other'; }],
  ['upload direction', (batch) => { batch.direction = 'Upload'; }],
  ['unowned file', (batch) => { batch.transfers[0].batchId = randomUUID(); }],
  ['missing batch ownership', (batch) => { delete batch.transfers[0].batchId; }],
  ['duplicate UUID case', (batch) => { batch.transfers[1].id = batch.transfers[0].id.toUpperCase(); }],
  ['extra file', (batch) => { batch.transfers.push({ ...batch.transfers[0], id: randomUUID() }); }],
  ['changed size', (batch) => { batch.transfers[0].size += 1; }],
  ['unexpected destination', (batch) => { batch.options.destination = 'other'; }],
  ['malformed options', (batch) => { batch.options = 'other'; }],
]) {
  test(`${name} cannot produce POST or GET confirmation`, () => {
    const { attempt, batch } = fixture();
    for (const row of batch.transfers) row.state = 'InProgress';
    change(batch);
    const post = evaluateDownloadReceipt({ attempt, enqueueResult: decodeSlskdDownloadBatchResponse({ attempt, payload: { batch, failures: [] } }) });
    const get = evaluateBatchDownloadEvidence({ attempt, providerEvidence: batch });
    assert.equal(post.disposition, 'unknown');
    assert.equal(get.disposition, 'unknown');
    assert.deepEqual(post.attempt.receipts, []);
    assert.deepEqual(get.attempt.receipts, []);
  });
}

test('restart and adverse exception evidence cannot be mistaken for remote progress', () => {
  const { attempt, batch } = fixture();
  for (const row of batch.transfers) { row.state = 'InProgress'; row.exception = 'Application shut down'; }
  assert.equal(hasProviderRestartEvidence(batch.transfers[0]), true);
  assert.equal(hasProgressedDownloadEvidence(batch.transfers[0]), false);
  assert.equal(evaluateBatchDownloadEvidence({ attempt, providerEvidence: batch }).disposition, 'unknown');
  assert.equal(decodeSlskdDownloadBatchResponse({ attempt, payload: { batch, failures: [] } }).receiptMalformed, true);
});

test('operator adoption requires a unique complete current selection and preserves distinct provenance', () => {
  const { attempt, batch, binding } = fixture();
  for (const row of batch.transfers) row.state = 'InProgress';
  const input = { requestedFiles: attempt.requestedFiles, username: attempt.username, transferIds: batch.transfers.map((row) => row.id),
    transfers: batch.transfers, providerBinding: binding };
  const selected = validateDownloadAdoptionSelection(input);
  const proof = createOperatorDownloadAdoptionAttempt({ attempt, providerBinding: binding, transfers: selected.receipts,
    actorUserId: 'admin', acceptedRequestHash: 'a'.repeat(64) });
  assert.equal(proof.attempt.receiptOrigin, 'operator_adoption');
  assert.equal(proof.attempt.originalDispatchUnresolved, true);
  assert.equal(evaluateStoredDownloadReceipt({ attempt: proof.attempt, ...proof.attempt }).disposition, 'confirmed');
  for (const change of [{ transfers: [batch.transfers[0]] }, { transferIds: [input.transferIds[0], input.transferIds[0]] },
    { transfers: [...batch.transfers, { ...batch.transfers[0], id: randomUUID() }] },
    { transfers: batch.transfers.map((row) => ({ ...row, removed: true })) }]) {
    assert.throws(() => validateDownloadAdoptionSelection({ ...input, ...change }), { code: 'import_execution_download_adoption_evidence_not_current' });
  }
});
