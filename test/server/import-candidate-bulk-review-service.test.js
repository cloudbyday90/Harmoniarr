import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateBulkReviewService } from '../../src/server/import-candidates/import-candidate-bulk-review-service.js';

function createRecordedHandler(name) {
  const calls = [];
  const handler = async (params) => {
    calls.push(params);
    return { [name]: true, importCandidateId: params.importCandidateId };
  };
  return { calls, handler };
}

test('bulkReviewImportCandidates rejects non-array importCandidateIds', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'select', importCandidateIds: 'not-array' }),
    { code: 'validation_error', message: 'importCandidateIds must be an array' },
  );
});

test('bulkReviewImportCandidates rejects empty importCandidateIds', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'select', importCandidateIds: [] }),
    { code: 'validation_error', message: 'importCandidateIds must contain at least one entry' },
  );
});

test('bulkReviewImportCandidates rejects importCandidateIds exceeding max batch size', async () => {
  const service = createImportCandidateBulkReviewService();
  const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'select', importCandidateIds: ids }),
    { code: 'validation_error', message: 'importCandidateIds must contain 50 entries or less' },
  );
});

test('bulkReviewImportCandidates rejects non-string entries in importCandidateIds', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'select', importCandidateIds: [123] }),
    { code: 'validation_error', message: 'importCandidateIds[0] must be a string' },
  );
});

test('bulkReviewImportCandidates rejects empty string entries in importCandidateIds', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'select', importCandidateIds: ['  '] }),
    { code: 'validation_error', message: 'importCandidateIds[0] must not be empty' },
  );
});

test('bulkReviewImportCandidates rejects missing action', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ importCandidateIds: ['id-1'] }),
    { code: 'validation_error', message: 'action must be a string' },
  );
});

test('bulkReviewImportCandidates rejects unsupported action', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'delete', importCandidateIds: ['id-1'] }),
    { code: 'validation_error', message: 'action must be one of: select, hold, reject, reopen' },
  );
});

test('bulkReviewImportCandidates rejects non-string reason', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'select', importCandidateIds: ['id-1'], reason: 123 }),
    { code: 'validation_error', message: 'reason must be a string' },
  );
});

test('bulkReviewImportCandidates rejects reason exceeding 400 characters', async () => {
  const service = createImportCandidateBulkReviewService();
  await assert.rejects(
    () => service.bulkReviewImportCandidates({ action: 'select', importCandidateIds: ['id-1'], reason: 'x'.repeat(401) }),
    { code: 'validation_error', message: 'reason must be 400 characters or less' },
  );
});

test('bulkReviewImportCandidates applies select action to all candidates', async () => {
  const select = createRecordedHandler('select');
  const service = createImportCandidateBulkReviewService({ selectImportCandidate: select.handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'select',
    actorUserId: 'admin-1',
    importCandidateIds: ['cand-1', 'cand-2'],
    reason: 'Looks good',
    requestMetadata: { ipAddress: '127.0.0.1' },
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.action, 'select');
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[0].importCandidateId, 'cand-1');
  assert.equal(result.results[1].ok, true);
  assert.equal(result.results[1].importCandidateId, 'cand-2');
  assert.equal(select.calls.length, 2);
  assert.equal(select.calls[0].actorUserId, 'admin-1');
  assert.equal(select.calls[0].reason, 'Looks good');
  assert.equal(select.calls[0].importCandidateId, 'cand-1');
});

test('bulkReviewImportCandidates applies reject action', async () => {
  const reject = createRecordedHandler('reject');
  const service = createImportCandidateBulkReviewService({ rejectImportCandidate: reject.handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'reject',
    actorUserId: 'admin-1',
    importCandidateIds: ['cand-1'],
  });

  assert.equal(result.total, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.action, 'reject');
  assert.equal(reject.calls.length, 1);
  assert.equal(reject.calls[0].reason, null);
});

test('bulkReviewImportCandidates applies hold action', async () => {
  const hold = createRecordedHandler('hold');
  const service = createImportCandidateBulkReviewService({ holdImportCandidate: hold.handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'hold',
    actorUserId: 'admin-1',
    importCandidateIds: ['cand-1'],
  });

  assert.equal(result.action, 'hold');
  assert.equal(result.succeeded, 1);
  assert.equal(hold.calls.length, 1);
});

test('bulkReviewImportCandidates applies reopen action', async () => {
  const reopen = createRecordedHandler('reopen');
  const service = createImportCandidateBulkReviewService({ reopenImportCandidate: reopen.handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'reopen',
    actorUserId: 'admin-1',
    importCandidateIds: ['cand-1'],
  });

  assert.equal(result.action, 'reopen');
  assert.equal(result.succeeded, 1);
  assert.equal(reopen.calls.length, 1);
});

test('bulkReviewImportCandidates handles partial failures', async () => {
  const handler = async ({ importCandidateId }) => {
    if (importCandidateId === 'cand-fail') {
      const error = new Error('Status conflict');
      error.code = 'conflict';
      error.status = 409;
      throw error;
    }
    return { importCandidateId, selected: true };
  };

  const service = createImportCandidateBulkReviewService({ selectImportCandidate: handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'select',
    importCandidateIds: ['cand-1', 'cand-fail', 'cand-3'],
  });

  assert.equal(result.total, 3);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[1].ok, false);
  assert.equal(result.results[1].error.code, 'conflict');
  assert.equal(result.results[1].error.status, 409);
  assert.equal(result.results[2].ok, true);
});

test('bulkReviewImportCandidates handles all failures', async () => {
  const handler = async () => {
    const error = new Error('Not found');
    error.code = 'not_found';
    error.status = 404;
    throw error;
  };

  const service = createImportCandidateBulkReviewService({ rejectImportCandidate: handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'reject',
    importCandidateIds: ['cand-1', 'cand-2'],
  });

  assert.equal(result.total, 2);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 2);
  assert.equal(result.results[0].ok, false);
  assert.equal(result.results[1].ok, false);
});

test('bulkReviewImportCandidates action is case-insensitive', async () => {
  const select = createRecordedHandler('select');
  const service = createImportCandidateBulkReviewService({ selectImportCandidate: select.handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'SELECT',
    importCandidateIds: ['cand-1'],
  });

  assert.equal(result.action, 'select');
  assert.equal(result.succeeded, 1);
});

test('bulkReviewImportCandidates trims whitespace from reason', async () => {
  const select = createRecordedHandler('select');
  const service = createImportCandidateBulkReviewService({ selectImportCandidate: select.handler });

  await service.bulkReviewImportCandidates({
    action: 'select',
    importCandidateIds: ['cand-1'],
    reason: '  valid reason  ',
  });

  assert.equal(select.calls[0].reason, 'valid reason');
});

test('bulkReviewImportCandidates treats null reason as null', async () => {
  const select = createRecordedHandler('select');
  const service = createImportCandidateBulkReviewService({ selectImportCandidate: select.handler });

  await service.bulkReviewImportCandidates({
    action: 'select',
    importCandidateIds: ['cand-1'],
    reason: null,
  });

  assert.equal(select.calls[0].reason, null);
});

test('bulkReviewImportCandidates handles unexpected errors gracefully', async () => {
  const handler = async () => {
    throw new Error('Unexpected');
  };

  const service = createImportCandidateBulkReviewService({ selectImportCandidate: handler });

  const result = await service.bulkReviewImportCandidates({
    action: 'select',
    importCandidateIds: ['cand-1'],
  });

  assert.equal(result.total, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].error.code, 'unknown_error');
  assert.equal(result.results[0].error.status, 500);
});

test('bulkReviewImportCandidates handles max batch size of 50', async () => {
  const select = createRecordedHandler('select');
  const service = createImportCandidateBulkReviewService({ selectImportCandidate: select.handler });

  const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
  const result = await service.bulkReviewImportCandidates({
    action: 'select',
    importCandidateIds: ids,
  });

  assert.equal(result.total, 50);
  assert.equal(result.succeeded, 50);
});
