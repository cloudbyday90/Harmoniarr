import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDownloadAttempt, evaluateDownloadReceipt, evaluateStoredDownloadReceipt, matchesDownloadReceipt, validateDownloadAttempt,
} from '../../src/server/slskd/slskd-download-attempt-policy.js';

function makeAttempt(overrides = {}) {
  return createDownloadAttempt({
    importCandidateId: 'candidate-1', operationRunId: 'run-1', username: 'peer',
    sourceObservation: { id: 'candidate-1', username: 'peer', status: 'selected' },
    requestedFiles: [{ filename: 'Album/01.flac', size: 123 }, { filename: 'Album/02.flac', size: 456 }],
    ...overrides,
  });
}

function receipt(attempt, index) {
  return { ...attempt.requestedFiles[index], id: `ba81acde-d7a5-4b30-a5fd-57cfc91d47b${index}`, username: attempt.username, state: 'Queued' };
}

test('an attempt owns an independent immutable request and source snapshot', () => {
  const requestedFiles = [{ filename: 'Album/01.flac', size: 123 }];
  const sourceObservation = { username: 'peer', files: [{ size: 123 }] };
  const attempt = makeAttempt({ requestedFiles, sourceObservation });
  requestedFiles[0].size = 999;
  sourceObservation.files[0].size = 999;
  assert.deepEqual(attempt.requestedFiles, [{ filename: 'Album\\01.flac', size: 123 }]);
  assert.equal(attempt.sourceObservation.files[0].size, 123);
  assert.notEqual(attempt.attemptId, makeAttempt().attemptId);
});

for (const size of [undefined, null, '', '123', 0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`attempt refuses invalid file size ${String(size)}`, () => {
    assert.throws(() => makeAttempt({ requestedFiles: [{ filename: 'a.flac', size }] }), TypeError);
  });
}

test('attempt refuses duplicate filenames even with different advertised sizes', () => {
  assert.throws(() => makeAttempt({ requestedFiles: [
    { filename: 'Album/01.flac', size: 123 }, { filename: 'Album\\01.flac', size: 456 },
  ] }), TypeError);
});

test('complete exact direct receipts retain only bounded private identities', () => {
  const attempt = makeAttempt();
  const result = evaluateDownloadReceipt({ attempt, enqueueResult: {
    enqueued: [receipt(attempt, 1), { ...receipt(attempt, 0), providerSecret: 'excluded' }], failed: [],
  } });
  assert.equal(result.disposition, 'confirmed');
  assert.equal(result.allRequestedFilesMatched, true);
  assert.equal(result.attempt.receipts.length, 2);
  assert.equal('providerSecret' in result.attempt.receipts[1], false);
  assert.deepEqual(result.missingFiles, []);
  assert.equal(attempt.receipts.length, 0);
});

test('partial explicit acceptance stays incomplete even with a definitive rejected remainder', () => {
  const attempt = makeAttempt();
  const result = evaluateDownloadReceipt({ attempt, enqueueResult: {
    enqueued: [receipt(attempt, 0)], failed: [attempt.requestedFiles[1].filename],
  } });
  assert.equal(result.disposition, 'partial');
  assert.equal(result.allRequestedFilesMatched, false);
  assert.deepEqual(result.missingFiles, [attempt.requestedFiles[1]]);
});

test('only an exact all-file rejection establishes a definitive refusal', () => {
  const attempt = makeAttempt();
  const result = evaluateDownloadReceipt({ attempt, enqueueResult: {
    enqueued: [], failed: attempt.requestedFiles.map((file) => file.filename),
  } });
  assert.equal(result.disposition, 'rejected');
  assert.equal(result.allRequestedFilesMatched, false);
  assert.equal(evaluateDownloadReceipt({ attempt, enqueueResult: { enqueued: [], failed: [] } }).disposition, 'unknown');
});

for (const [name, mutate] of [
  ['missing ID', (row) => ({ ...row, id: null })],
  ['foreign peer', (row) => ({ ...row, username: 'other' })],
  ['wrong filename', (row) => ({ ...row, filename: 'other.flac' })],
  ['wrong size', (row) => ({ ...row, size: 999 })],
  ['coerced size', (row) => ({ ...row, size: '123' })],
]) {
  test(`HTTP success with ${name} does not prove full acceptance`, () => {
    const attempt = makeAttempt();
    const result = evaluateDownloadReceipt({ attempt, enqueueResult: {
      enqueued: [mutate(receipt(attempt, 0)), receipt(attempt, 1)], failed: [],
    } });
    assert.equal(result.disposition, 'unknown');
    assert.equal(result.allRequestedFilesMatched, false);
  });
}

test('duplicate receipt IDs, repeated files and conflicting failed lists stay unknown', () => {
  const attempt = makeAttempt();
  for (const enqueued of [
    [receipt(attempt, 0), { ...receipt(attempt, 1), id: receipt(attempt, 0).id.toUpperCase() }],
    [receipt(attempt, 0), receipt(attempt, 0)],
  ]) assert.equal(evaluateDownloadReceipt({ attempt, enqueueResult: { enqueued, failed: [] } }).disposition, 'unknown');
  assert.equal(evaluateDownloadReceipt({ attempt, enqueueResult: {
    enqueued: [receipt(attempt, 0), receipt(attempt, 1)], failed: [attempt.requestedFiles[0].filename],
  } }).disposition, 'unknown');
});

for (const id of ['', 'opaque-id', '00000000-0000-0000-0000-000000000000', 'ba81acde-d7a5-4b30-a5fd-57cfc91d47b']) {
  test(`provider receipt refuses invalid UUID ${id || '(blank)'}`, () => {
    const attempt = makeAttempt();
    const result = evaluateDownloadReceipt({ attempt, enqueueResult: {
      enqueued: [{ ...receipt(attempt, 0), id }, receipt(attempt, 1)], failed: [],
    } });
    assert.equal(result.disposition, 'unknown');
    assert.deepEqual(result.attempt.receipts, []);
  });
}

test('malformed provider envelope cannot be repaired by otherwise valid receipt rows', () => {
  const attempt = makeAttempt();
  for (const enqueueResult of [null, {}, { enqueued: [], failed: null }, {
    enqueued: [receipt(attempt, 0), receipt(attempt, 1)], failed: [], receiptMalformed: true,
  }]) assert.equal(evaluateDownloadReceipt({ attempt, enqueueResult }).disposition, 'unknown');
});

test('saved evidence cannot be moved to another run, candidate, peer or manifest', () => {
  const attempt = makeAttempt();
  const context = { attempt, ...attempt };
  assert.ok(validateDownloadAttempt(context));
  for (const mutation of [
    { operationRunId: 'run-2' }, { importCandidateId: 'candidate-2' }, { username: 'other' },
    { requestedFiles: [{ filename: 'Album/01.flac', size: 999 }] },
    { attempt: { ...attempt, attemptId: 'not-a-uuid' } },
  ]) assert.equal(validateDownloadAttempt({ ...context, ...mutation }), null);
});

test('a malformed full-looking receipt remains unknown after bounded persistence', () => {
  const initial = makeAttempt();
  const malformed = evaluateDownloadReceipt({ attempt: initial, enqueueResult: {
    enqueued: [receipt(initial, 0), receipt(initial, 1), { id: 'unexpected' }], failed: [],
  } });
  assert.deepEqual(malformed.attempt.receipts, []);
  assert.deepEqual(malformed.matchedTransfers, []);
  const attempt = { ...initial, receipts: [receipt(initial, 0), receipt(initial, 1)], receiptDisposition: 'unknown' };
  assert.equal(attempt.receiptDisposition, 'unknown');
  const result = evaluateStoredDownloadReceipt({ attempt, ...attempt });
  assert.equal(result.disposition, 'unknown');
  assert.equal(result.allRequestedFilesMatched, false);
  assert.deepEqual(result.matchedTransfers, []);
  assert.equal(result.attempt.receiptDisposition, 'unknown');
  assert.equal(evaluateStoredDownloadReceipt({ attempt: result.attempt, ...result.attempt }).disposition, 'unknown');
});

test('a persisted exact rejection can be resumed without a new provider POST', () => {
  const initial = makeAttempt();
  const { attempt } = evaluateDownloadReceipt({ attempt: initial, enqueueResult: {
    enqueued: [], failed: initial.requestedFiles.map((file) => file.filename),
  } });
  const result = evaluateStoredDownloadReceipt({ attempt, ...attempt });
  assert.equal(result.disposition, 'rejected');
  assert.equal(result.allRequestedFilesMatched, false);
  assert.deepEqual(result.attempt.failedFiles, initial.requestedFiles.map((file) => file.filename));
});

test('live state must preserve the exact accepted identity and download direction', () => {
  const expected = receipt(makeAttempt(), 0);
  assert.equal(matchesDownloadReceipt({ receipt: expected, transfer: { ...expected, id: expected.id.toUpperCase(), direction: 'Download' } }), true);
  for (const change of [{ username: 'foreign' }, { filename: 'Other.flac' }, { size: 124 },
    { id: receipt(makeAttempt(), 1).id }, { direction: 'Upload' }, { direction: null }, { direction: 0 }]) {
    assert.equal(matchesDownloadReceipt({ receipt: expected, transfer: { ...expected, ...change } }), false);
  }
});
